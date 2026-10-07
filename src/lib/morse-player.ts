import { buildTimeline, encodeWav, timelineDuration, WAV_LIMIT_MS, type Segment } from './morse-audio';

export type AudioSettings = {
  wpm: number;
  farnsworthWpm: number;
  frequency: number;
  volume: number;
};

export type AudioUi = {
  status: (message: string) => void;
  setPlaying: (playing: boolean) => void;
};

type GainParam = {
  setValueAtTime: (value: number, time: number) => void;
  linearRampToValueAtTime: (value: number, time: number) => void;
  cancelScheduledValues: (time: number) => void;
};

type ToneNode = {
  stop: (time?: number) => void;
};

const LOOKAHEAD_SEC = 1.5;

export function scheduleAhead(
  timeline: readonly Segment[],
  index: number,
  nextTime: number,
  now: number,
  lookahead = LOOKAHEAD_SEC,
): { index: number; nextTime: number; toneCount: number } {
  const horizon = now + lookahead;
  let time = nextTime;
  let cursor = index;
  let toneCount = 0;
  while (cursor < timeline.length && time < horizon) {
    if (timeline[cursor].on) toneCount += 1;
    time += timeline[cursor].ms / 1000;
    cursor += 1;
  }
  return { index: cursor, nextTime: time, toneCount };
}

export function armTone(
  ctx: AudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  frequency: number,
  peak: number,
): ToneNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(destination);
  const attack = Math.min(0.005, duration / 2);
  const release = Math.min(0.005, duration / 2);
  const end = start + duration;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
  gain.gain.linearRampToValueAtTime(0, end);
  osc.start(start);
  osc.stop(end);
  return osc;
}

export function createPlayback(ctx: AudioContext, timeline: readonly Segment[], settings: AudioSettings, ui: AudioUi) {
  const tones = timeline.filter((segment) => segment.on);
  if (tones.length === 0) {
    ui.status('Nothing to play');
    ui.setPlaying(false);
    return { stop() {} };
  }

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  const peak = Math.min(1, Math.max(0, settings.volume));
  let index = 0;
  let nextTime = ctx.currentTime;
  let timer = 0;
  let finished = false;
  const nodes: ToneNode[] = [];

  const schedule = () => {
    const planned = scheduleAhead(timeline, index, nextTime, ctx.currentTime);
    while (index < planned.index) {
      const segment = timeline[index];
      const seconds = segment.ms / 1000;
      if (segment.on) {
        nodes.push(armTone(ctx, master, nextTime, seconds, settings.frequency, peak));
      }
      nextTime += seconds;
      index += 1;
    }
    if (index < timeline.length) {
      timer = window.setTimeout(schedule, 250);
      return;
    }
    const wait = Math.max(0, (nextTime - ctx.currentTime) * 1000);
    timer = window.setTimeout(() => {
      finished = true;
      ui.setPlaying(false);
      ui.status('Finished');
    }, wait);
  };

  ui.setPlaying(true);
  ui.status('Playing');
  schedule();

  return {
    stop(announce = true) {
      if (finished) return;
      window.clearTimeout(timer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
      for (const node of nodes) {
        try {
          node.stop(ctx.currentTime);
        } catch {
          // Already stopped.
        }
      }
      ui.setPlaying(false);
      if (announce) ui.status('Stopped');
      finished = true;
    },
  };
}

export function playMorse(ctx: AudioContext, morse: string, settings: AudioSettings, ui: AudioUi) {
  return createPlayback(ctx, buildTimeline(morse, settings), settings, ui);
}

export function prepareWav(morse: string, settings: AudioSettings): { bytes: Uint8Array; seconds: number } | { limit: number } | null {
  const timeline = buildTimeline(morse, { wpm: settings.wpm, farnsworthWpm: settings.farnsworthWpm });
  if (!timeline.some((segment) => segment.on)) return null;
  const ms = timelineDuration(timeline);
  if (ms > WAV_LIMIT_MS) return { limit: ms / 1000 };
  return {
    bytes: encodeWav(timeline, {
      frequency: settings.frequency,
      volume: settings.volume,
      sampleRate: 44100,
    }),
    seconds: ms / 1000,
  };
}

let playback: { stop: (announce?: boolean) => void } | null = null;

function readSettings(): AudioSettings {
  const value = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
  return {
    wpm: value('translator-wpm'),
    farnsworthWpm: value('translator-farnsworth'),
    frequency: value('translator-tone'),
    volume: value('translator-volume') / 100,
  };
}

function showStatus(message: string) {
  const node = document.getElementById('translator-audio-status');
  if (node) node.textContent = message;
}

function setPlaying(active: boolean) {
  const play = document.getElementById('translator-play');
  if (!(play instanceof HTMLButtonElement)) return;
  play.textContent = active ? 'Stop' : 'Play';
  play.setAttribute('aria-pressed', active ? 'true' : 'false');
  if (!active) playback = null;
}

export function stopPlayback(announce = false) {
  const current = playback;
  playback = null;
  current?.stop(announce);
}

export function togglePlayback(ctx: AudioContext | null) {
  if (playback) {
    stopPlayback(true);
    return;
  }
  if (!ctx) {
    showStatus('Audio is not available in this browser.');
    return;
  }
  const morse = (document.getElementById('translator-morse') as HTMLTextAreaElement).value;
  const handle = playMorse(ctx, morse, readSettings(), { status: showStatus, setPlaying });
  const play = document.getElementById('translator-play');
  playback = play instanceof HTMLButtonElement && play.getAttribute('aria-pressed') === 'true' ? handle : null;
}

export function downloadCurrent() {
  const morse = (document.getElementById('translator-morse') as HTMLTextAreaElement).value;
  const ready = prepareWav(morse, readSettings());
  if (!ready) {
    showStatus('Nothing to play');
    return;
  }
  if ('limit' in ready) {
    showStatus(`Audio is ${ready.limit.toFixed(1)} s, over the 5 minute limit.`);
    return;
  }
  downloadWav(ready.bytes);
  showStatus(`WAV ready (${ready.seconds.toFixed(1)} s)`);
}

export function downloadWav(bytes: Uint8Array, name = 'morse-code.wav'): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
