/**
 * American Morse playback timing. Pure: no AudioContext and no DOM.
 *
 * Durations use the same relative ratios as the audio decoder's simulator
 * (dot 1, dash 2, L 4, 0 6; gaps 1 / 2 / 3.5 / 7). Speed only changes the
 * dot unit, so the order stays put at every setting.
 */
import { SYNTH_RATIOS, tokenizeAmericanMorse, type GapClass, type MarkSymbol } from './american-mic-decode';

export type PlaybackMode = 'sounder' | 'cw';

export type TimedSpan = {
  on: boolean;
  ms: number;
  /** Set on marks. Gaps leave this empty. */
  symbol?: MarkSymbol;
  gap?: GapClass;
};

export const SPEED_LIMITS = { min: 5, max: 40 } as const;
export const VOLUME_LIMITS = { min: 0, max: 100 } as const;
export const PITCH_LIMITS = { min: 200, max: 1200 } as const;
export const DEFAULT_SPEED = 15;
export const DEFAULT_VOLUME = 70;
export const DEFAULT_PITCH = 700;

const MARK_RATIO: Record<MarkSymbol, number> = {
  '.': SYNTH_RATIOS.dot,
  '-': SYNTH_RATIOS.dash,
  '=': SYNTH_RATIOS.long,
  _: SYNTH_RATIOS.zero,
};

const GAP_RATIO: Record<GapClass, number> = {
  element: SYNTH_RATIOS.element,
  internal: SYNTH_RATIOS.internal,
  letter: SYNTH_RATIOS.letter,
  word: SYNTH_RATIOS.word,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampSpeed(speed: number): number {
  return clamp(speed, SPEED_LIMITS.min, SPEED_LIMITS.max);
}

export function clampVolume(volume: number): number {
  return clamp(volume, VOLUME_LIMITS.min, VOLUME_LIMITS.max);
}

export function clampPitch(pitch: number): number {
  return clamp(pitch, PITCH_LIMITS.min, PITCH_LIMITS.max);
}

/** Dot length in milliseconds. Higher speed → shorter unit. */
export function unitMsForSpeed(speed: number): number {
  return 1200 / clampSpeed(speed);
}

export function pitchEnabled(mode: PlaybackMode): boolean {
  return mode === 'cw';
}

export function buildAmericanTimeline(morse: string, speed: number): TimedSpan[] {
  const unit = unitMsForSpeed(speed);
  return tokenizeAmericanMorse(morse).map((token) =>
    token.type === 'mark'
      ? { on: true, ms: unit * MARK_RATIO[token.symbol], symbol: token.symbol }
      : { on: false, ms: unit * GAP_RATIO[token.gap], gap: token.gap },
  );
}

export function timelineDuration(timeline: readonly TimedSpan[]): number {
  return timeline.reduce((sum, span) => sum + span.ms, 0);
}

/** On-span lengths in order. Ratios stay 1 : 2 : 4 : 6 for dot, dash, L, 0. */
export function markLengths(timeline: readonly TimedSpan[]): number[] {
  return timeline.filter((span) => span.on).map((span) => span.ms);
}

export function lampOn(mode: PlaybackMode, timeline: readonly TimedSpan[], elapsedMs: number): boolean {
  if (mode !== 'cw') return false;
  let cursor = 0;
  for (const span of timeline) {
    const end = cursor + span.ms;
    if (elapsedMs >= cursor && elapsedMs < end) return span.on;
    cursor = end;
  }
  return false;
}

export type ToneSpan = { startMs: number; durationMs: number };
export type SounderClick = { atMs: number; edge: 'down' | 'up'; ms: number };

export function cwTones(timeline: readonly TimedSpan[]): ToneSpan[] {
  const tones: ToneSpan[] = [];
  let cursor = 0;
  for (const span of timeline) {
    if (span.on) tones.push({ startMs: cursor, durationMs: span.ms });
    cursor += span.ms;
  }
  return tones;
}

/** A clack when the sounder arm goes down, and a lighter clack when it comes up. */
export function sounderClicks(timeline: readonly TimedSpan[]): SounderClick[] {
  const clicks: SounderClick[] = [];
  let cursor = 0;
  for (const span of timeline) {
    if (span.on) {
      const upAt = cursor + Math.max(0, span.ms - 6);
      clicks.push({ atMs: cursor, edge: 'down', ms: 8 });
      clicks.push({ atMs: upAt, edge: 'up', ms: Math.min(6, span.ms) });
    }
    cursor += span.ms;
  }
  return clicks;
}

export function cuesFor(mode: PlaybackMode, timeline: readonly TimedSpan[]) {
  return {
    tones: mode === 'cw' ? cwTones(timeline) : [],
    clicks: mode === 'sounder' ? sounderClicks(timeline) : [],
    lampFollowsMarks: mode === 'cw',
  };
}

/**
 * Vibration pattern: vibrate, pause, vibrate, pause… Matching the mark/gap
 * timeline. A leading gap becomes a 0 so the first real buzz still lines up.
 */
export function vibrationPattern(timeline: readonly TimedSpan[]): number[] {
  const pattern: number[] = [];
  let started = false;
  for (const span of timeline) {
    const duration = Math.max(1, Math.round(span.ms));
    if (!started) {
      if (!span.on) pattern.push(0);
      started = true;
    }
    pattern.push(duration);
  }
  return pattern;
}

export function startVibration(
  timeline: readonly TimedSpan[],
  vibrate: (pattern: number[]) => boolean | void,
  supported: boolean,
): void {
  if (!supported) return;
  const pattern = vibrationPattern(timeline);
  if (pattern.length > 0) vibrate(pattern);
}

export function stopVibration(vibrate: (pattern: number[]) => boolean | void, supported: boolean): void {
  if (!supported) return;
  vibrate([0]);
}

/** Sine PCM for decode fixtures. 5 ms ramps, silence in the gaps. */
export function renderCwPcm(
  timeline: readonly TimedSpan[],
  options: { frequency?: number; sampleRate?: number; volume?: number } = {},
): Float32Array {
  const sampleRate = options.sampleRate ?? 8000;
  const frequency = options.frequency ?? DEFAULT_PITCH;
  const volume = options.volume ?? 0.6;
  const total = Math.max(1, Math.round((timelineDuration(timeline) / 1000) * sampleRate));
  const pcm = new Float32Array(total);
  const ramp = Math.round(0.005 * sampleRate);
  let cursorMs = 0;
  for (const span of timeline) {
    const start = Math.round((cursorMs / 1000) * sampleRate);
    const count = Math.round((span.ms / 1000) * sampleRate);
    if (span.on) {
      for (let i = 0; i < count; i += 1) {
        const index = start + i;
        if (index >= pcm.length) break;
        const attack = ramp <= 0 ? 1 : Math.min(1, i / ramp);
        const release = ramp <= 0 ? 1 : Math.min(1, (count - 1 - i) / ramp);
        const env = Math.min(attack, release);
        pcm[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * volume * env;
      }
    }
    cursorMs += span.ms;
  }
  return pcm;
}
