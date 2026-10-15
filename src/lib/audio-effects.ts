import type { Segment } from './morse-audio';

export const AUTOPLAY_DELAY_MS = 800;
export const VIBRATE_CHUNK_MAX = 20;
export const TELEGRAPH_KEY_DOWN_MS = 8;
export const TELEGRAPH_KEY_UP_MS = 6;
export const CW_RAMP_MS = 5;

/** Word gap of exactly 7 timing units (ms). */
export function repeatGapMs(wpm: number): number {
  return (7 * 1200) / wpm;
}

export type FlashState = 'on' | 'off';

export function flashStateAt(timeline: readonly Segment[], elapsedMs: number): FlashState {
  let cursor = 0;
  for (const segment of timeline) {
    const end = cursor + segment.ms;
    if (elapsedMs >= cursor && elapsedMs < end) return segment.on ? 'on' : 'off';
    cursor = end;
  }
  return 'off';
}

/**
 * Build vibration pattern alternating vibrate/pause durations (ms).
 * Chunked into arrays of at most VIBRATE_CHUNK_MAX entries.
 * Starts from elapsedMs offset into the timeline.
 */
export function buildVibrationChunks(
  timeline: readonly Segment[],
  elapsedMs = 0,
  chunkSize = VIBRATE_CHUNK_MAX,
): number[][] {
  // navigator.vibrate pattern: [vibrate, pause, vibrate, pause, ...]
  const pattern: number[] = [];
  let cursor = 0;
  let started = false;
  for (const segment of timeline) {
    const start = cursor;
    const end = cursor + segment.ms;
    cursor = end;
    if (end <= elapsedMs) continue;
    const duration = Math.round(end - Math.max(start, elapsedMs));
    if (duration <= 0) continue;
    if (!started) {
      if (!segment.on) pattern.push(0);
      started = true;
    }
    pattern.push(duration);
  }

  const chunks: number[][] = [];
  for (let i = 0; i < pattern.length; i += chunkSize) {
    chunks.push(pattern.slice(i, i + chunkSize));
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

export function cancelVibrationPattern(): number[] {
  return [0];
}

export type AutoplayController = {
  schedule: (run: () => void) => void;
  cancel: () => void;
};

export function createAutoplayController(
  delayMs = AUTOPLAY_DELAY_MS,
  setTimer: (fn: () => void, ms: number) => number = (fn, ms) => window.setTimeout(fn, ms),
  clearTimer: (id: number) => void = (id) => window.clearTimeout(id),
): AutoplayController {
  let timer = 0;
  return {
    schedule(run) {
      if (timer) clearTimer(timer);
      timer = setTimer(() => {
        timer = 0;
        run();
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimer(timer);
      timer = 0;
    },
  };
}

export type TelegraphClick = {
  kind: 'down' | 'up';
  /** Offset from signal start in ms */
  atMs: number;
  durationMs: number;
};

/** Key-down at signal start, key-up at signal end (so interval = signal length). */
export function telegraphClicksForSignal(signalMs: number): TelegraphClick[] {
  return [
    { kind: 'down', atMs: 0, durationMs: TELEGRAPH_KEY_DOWN_MS },
    { kind: 'up', atMs: Math.max(0, signalMs - TELEGRAPH_KEY_UP_MS), durationMs: TELEGRAPH_KEY_UP_MS },
  ];
}

export function canAutoplayMorse(morse: string): boolean {
  const trimmed = morse.trim();
  if (!trimmed) return false;
  // Only "#" groups / separators → nothing playable
  if (!/[.-]/.test(trimmed.replace(/[·•–—−]/g, (ch) => (ch === '·' || ch === '•' ? '.' : '-')))) {
    return false;
  }
  return /[.-·•–—−]/.test(trimmed);
}
