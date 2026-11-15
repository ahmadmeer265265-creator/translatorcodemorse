import { machineTiming } from './morse-machine-timing';
import type { MorseMark } from './morse-key-events';

export const SIDETONE_PITCH_MIN = 400;
export const SIDETONE_PITCH_MAX = 1000;
export const DEFAULT_SIDETONE_PITCH = 600;
export const SIDETONE_VOLUME_MIN = 0;
export const SIDETONE_VOLUME_MAX = 100;
export const DEFAULT_SIDETONE_VOLUME = 70;
export const SIDETONE_RAMP_SEC = 0.005;

export type SidetoneSegment = {
  on: boolean;
  ms: number;
};

export type SidetoneSettings = {
  /** Live keying tone. Listen & Guess playback uses volume/pitch even when this is off. */
  enabled: boolean;
  volume: number;
  frequency: number;
};

export type SidetoneToneCall = {
  start: number;
  duration: number;
  frequency: number;
  peak: number;
};

type GainNodeLike = {
  gain: {
    value: number;
    setValueAtTime: (value: number, time: number) => void;
    linearRampToValueAtTime: (value: number, time: number) => void;
    cancelScheduledValues: (time: number) => void;
  };
  connect: (dest: unknown) => void;
};

type OscillatorLike = {
  type: string;
  frequency: { value: number };
  connect: (dest: unknown) => void;
  start: (time?: number) => void;
  stop: (time?: number) => void;
};

export type SidetoneAudio = {
  currentTime: number;
  state: string;
  destination: unknown;
  resume: () => Promise<void>;
  createOscillator: () => OscillatorLike;
  createGain: () => GainNodeLike;
};

export function clampSidetonePitch(hz: number): number {
  if (!Number.isFinite(hz)) return DEFAULT_SIDETONE_PITCH;
  return Math.min(SIDETONE_PITCH_MAX, Math.max(SIDETONE_PITCH_MIN, hz));
}

export function clampSidetoneVolume(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_SIDETONE_VOLUME;
  return Math.min(SIDETONE_VOLUME_MAX, Math.max(SIDETONE_VOLUME_MIN, percent));
}

export function sidetonePeak(volumePercent: number): number {
  return clampSidetoneVolume(volumePercent) / 100;
}

export function markDurationMs(mark: MorseMark, wpm: number): number {
  const timing = machineTiming(wpm);
  return mark === '.' ? timing.ditMs : timing.dashMs;
}

/** PARIS on/off segments for a Morse string at Machine WPM. */
export function sidetoneTimeline(morse: string, wpm: number): SidetoneSegment[] {
  const timing = machineTiming(wpm);
  const marked = morse.replace(/\|/g, '/').replace(/ {3,}/g, ' / ').trim();
  if (!marked) return [];
  const words = marked
    .split('/')
    .map((word) => word.trim().split(/\s+/).filter((token) => /^[.-]+$/.test(token)))
    .filter((word) => word.length > 0);

  const timeline: SidetoneSegment[] = [];
  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) timeline.push({ on: false, ms: timing.wordGapMs });
    word.forEach((code, letterIndex) => {
      if (letterIndex > 0) timeline.push({ on: false, ms: timing.letterGapMs });
      for (let i = 0; i < code.length; i += 1) {
        if (i > 0) timeline.push({ on: false, ms: timing.elementGapMs });
        timeline.push({ on: true, ms: code[i] === '-' ? timing.dashMs : timing.ditMs });
      }
    });
  });
  return timeline;
}

export function timelineDurationMs(timeline: readonly SidetoneSegment[]): number {
  return timeline.reduce((sum, segment) => sum + segment.ms, 0);
}

function armTone(ctx: SidetoneAudio, start: number, durationSec: number, frequency: number, peak: number): OscillatorLike {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const attack = Math.min(SIDETONE_RAMP_SEC, durationSec / 2);
  const release = Math.min(SIDETONE_RAMP_SEC, durationSec / 2);
  const end = start + durationSec;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
  gain.gain.linearRampToValueAtTime(0, end);
  osc.start(start);
  osc.stop(end);
  return osc;
}

function defaultCreateAudio(): SidetoneAudio | null {
  const Ctor =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctor) return null;
  return new Ctor() as unknown as SidetoneAudio;
}

export function createSidetone(options: {
  getSettings: () => SidetoneSettings;
  createAudio?: () => SidetoneAudio | null;
  sleep?: (ms: number) => Promise<void>;
}): {
  unlocked: () => boolean;
  unlock: () => Promise<boolean>;
  startLive: () => void;
  stopLive: () => void;
  playMark: (mark: MorseMark, wpm: number) => void;
  playMorse: (morse: string, wpm: number) => Promise<void>;
  stopPlayback: () => void;
  isPlaying: () => boolean;
  lastTones: () => SidetoneToneCall[];
} {
  const createAudio = options.createAudio ?? defaultCreateAudio;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms)));
  let ctx: SidetoneAudio | null = null;
  let live: { osc: OscillatorLike; gain: GainNodeLike } | null = null;
  let playToken = 0;
  let playing = false;
  const tones: SidetoneToneCall[] = [];

  const getAudio = (): SidetoneAudio | null => {
    if (!ctx) ctx = createAudio();
    if (ctx?.state === 'suspended') void ctx.resume();
    return ctx;
  };

  const stopLive = () => {
    if (!live || !ctx) {
      live = null;
      return;
    }
    const now = ctx.currentTime;
    try {
      live.gain.gain.cancelScheduledValues(now);
      live.gain.gain.setValueAtTime(live.gain.gain.value, now);
      live.gain.gain.linearRampToValueAtTime(0, now + SIDETONE_RAMP_SEC);
      live.osc.stop(now + SIDETONE_RAMP_SEC);
    } catch {
      // already stopped
    }
    live = null;
  };

  const stopPlayback = () => {
    playToken += 1;
    playing = false;
    stopLive();
  };

  return {
    unlocked: () => ctx !== null,
    async unlock() {
      const audio = getAudio();
      if (!audio) return false;
      if (audio.state === 'suspended') await audio.resume();
      return true;
    },
    startLive() {
      const settings = options.getSettings();
      if (!settings.enabled) return;
      const peak = sidetonePeak(settings.volume);
      if (peak <= 0) return;
      const audio = getAudio();
      if (!audio || live) return;
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = clampSidetonePitch(settings.frequency);
      osc.connect(gain);
      gain.connect(audio.destination);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + SIDETONE_RAMP_SEC);
      osc.start(now);
      live = { osc, gain };
      tones.push({ start: now, duration: Number.POSITIVE_INFINITY, frequency: osc.frequency.value, peak });
    },
    stopLive,
    playMark(mark, wpm) {
      const settings = options.getSettings();
      if (!settings.enabled) return;
      const peak = sidetonePeak(settings.volume);
      if (peak <= 0) return;
      const audio = getAudio();
      if (!audio) return;
      const start = audio.currentTime;
      const duration = markDurationMs(mark, wpm) / 1000;
      const frequency = clampSidetonePitch(settings.frequency);
      armTone(audio, start, duration, frequency, peak);
      tones.push({ start, duration, frequency, peak });
    },
    async playMorse(morse, wpm) {
      const settings = options.getSettings();
      const peak = sidetonePeak(settings.volume);
      const timeline = sidetoneTimeline(morse, wpm);
      if (peak <= 0 || timeline.length === 0) return;
      stopPlayback();
      const token = playToken;
      const audio = getAudio();
      if (!audio || token !== playToken) return;
      if (audio.state === 'suspended') await audio.resume();
      if (token !== playToken) return;
      playing = true;
      const frequency = clampSidetonePitch(settings.frequency);
      let t = audio.currentTime + 0.02;
      for (const segment of timeline) {
        if (segment.on) {
          const duration = segment.ms / 1000;
          armTone(audio, t, duration, frequency, peak);
          tones.push({ start: t, duration, frequency, peak });
        }
        t += segment.ms / 1000;
      }
      const waitMs = Math.max(0, (t - audio.currentTime) * 1000);
      await sleep(waitMs);
      if (token === playToken) playing = false;
    },
    stopPlayback,
    isPlaying: () => playing,
    lastTones: () => tones.slice(),
  };
}
