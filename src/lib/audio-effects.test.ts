import { describe, expect, it } from 'vitest';
import {
  AUTOPLAY_DELAY_MS,
  VIBRATE_CHUNK_MAX,
  buildVibrationChunks,
  canAutoplayMorse,
  createAutoplayController,
  flashStateAt,
  repeatGapMs,
  telegraphClicksForSignal,
} from './audio-effects';
import { buildTimeline } from './morse-audio';
import { encode } from './morse';

describe('repeat gap', () => {
  it('is exactly 7 units', () => {
    expect(repeatGapMs(20)).toBe(7 * 60);
    expect(repeatGapMs(10)).toBe(7 * 120);
  });
});

describe('flash state', () => {
  it('follows the timeline', () => {
    const timeline = [
      { on: true, ms: 60 },
      { on: false, ms: 60 },
      { on: true, ms: 180 },
    ];
    expect(flashStateAt(timeline, 0)).toBe('on');
    expect(flashStateAt(timeline, 60)).toBe('off');
    expect(flashStateAt(timeline, 120)).toBe('on');
    expect(flashStateAt(timeline, 400)).toBe('off');
  });
});

describe('vibration chunks', () => {
  it('chunks patterns to at most 20 entries and supports cancel', () => {
    const timeline = buildTimeline(encode('PARIS PARIS PARIS').output, { wpm: 20 });
    const chunks = buildVibrationChunks(timeline, 0, VIBRATE_CHUNK_MAX);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(VIBRATE_CHUNK_MAX);
  });
});

describe('telegraph clicks', () => {
  it('places key-down at start and key-up at end of the signal', () => {
    const clicks = telegraphClicksForSignal(180);
    expect(clicks[0]).toMatchObject({ kind: 'down', atMs: 0, durationMs: 8 });
    expect(clicks[1]).toMatchObject({ kind: 'up', atMs: 174, durationMs: 6 });
  });
});

describe('autoplay debounce', () => {
  it('waits 800 ms and restarts the timer on a new schedule', () => {
    const runs: number[] = [];
    const timers = new Map<number, { fn: () => void; ms: number }>();
    let nextId = 1;
    let now = 0;
    const controller = createAutoplayController(
      AUTOPLAY_DELAY_MS,
      (fn, ms) => {
        const id = nextId++;
        timers.set(id, { fn, ms: now + ms });
        return id;
      },
      (id) => {
        timers.delete(id);
      },
    );
    controller.schedule(() => runs.push(1));
    now = 400;
    controller.schedule(() => runs.push(2));
    now = 400 + AUTOPLAY_DELAY_MS - 1;
    expect(runs).toEqual([]);
    now = 400 + AUTOPLAY_DELAY_MS;
    for (const entry of [...timers.values()]) {
      if (entry.ms <= now) entry.fn();
    }
    expect(runs).toEqual([2]);
  });
});

describe('canAutoplayMorse', () => {
  it('rejects empty and hash-only Morse', () => {
    expect(canAutoplayMorse('')).toBe(false);
    expect(canAutoplayMorse('# #')).toBe(false);
    expect(canAutoplayMorse('... --- ...')).toBe(true);
  });
});
