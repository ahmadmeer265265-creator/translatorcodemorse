import { describe, expect, it } from 'vitest';
import { buildTimeline, encodeWav, timelineDuration } from './morse-audio';
import { encode } from './morse';

const paris = encode('PARIS PARIS').output;

function total(morse: string, wpm: number, farnsworthWpm?: number): number {
  return timelineDuration(buildTimeline(morse, { wpm, farnsworthWpm }));
}

describe('buildTimeline', () => {
  it('plays E as one 60 ms tone at 20 WPM', () => {
    expect(buildTimeline('.', { wpm: 20 })).toEqual([{ on: true, ms: 60 }]);
  });

  it('plays T as one 180 ms tone at 20 WPM', () => {
    expect(buildTimeline('-', { wpm: 20 })).toEqual([{ on: true, ms: 180 }]);
  });

  it('times PARIS PARIS at 20 and 12 WPM', () => {
    expect(total(paris, 20)).toBe(5580);
    expect(total(paris, 12)).toBe(9300);
  });

  it('stretches only the gaps when Farnsworth is slower', () => {
    const letters = buildTimeline('. .', { wpm: 20, farnsworthWpm: 10 });
    const words = buildTimeline('. / .', { wpm: 20, farnsworthWpm: 10 });
    expect(Math.abs(letters[1].ms - 653.7)).toBeLessThanOrEqual(1);
    expect(Math.abs(words[1].ms - 1525.3)).toBeLessThanOrEqual(1);
    expect(Math.abs(total(paris, 20, 10) - 10474.7)).toBeLessThanOrEqual(1);
  });

  it('clamps speed and treats a faster Farnsworth setting as standard timing', () => {
    expect(buildTimeline('.', { wpm: 100 })[0].ms).toBe(30);
    expect(buildTimeline('.', { wpm: 1 })[0].ms).toBe(240);
    expect(buildTimeline('. .', { wpm: 20, farnsworthWpm: 40 })[1].ms).toBe(180);
  });

  it('returns nothing for empty input and skips # groups without extra gaps', () => {
    expect(buildTimeline('', { wpm: 20 })).toEqual([]);
    expect(buildTimeline('   /   ', { wpm: 20 })).toEqual([]);
    expect(buildTimeline('#', { wpm: 20 })).toEqual([]);
    expect(buildTimeline('# .', { wpm: 20 })).toEqual([{ on: true, ms: 60 }]);
    expect(buildTimeline('. #', { wpm: 20 })).toEqual([{ on: true, ms: 60 }]);
  });

  it('does not emit a leading or trailing gap', () => {
    const timeline = buildTimeline(paris, { wpm: 20 });
    expect(timeline[0].on).toBe(true);
    expect(timeline[timeline.length - 1].on).toBe(true);
  });
});

describe('encodeWav', () => {
  it('writes a PCM WAV whose edges are silent and whose length matches the timeline', () => {
    const timeline = buildTimeline('.-', { wpm: 20 });
    const wav = encodeWav(timeline, { frequency: 600, volume: 1, sampleRate: 44100 });
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 12, 4)).toBe('fmt ');
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16);
    const dataBytes = view.getUint32(40, true);
    const samples = dataBytes / 2;
    expect(dataBytes).toBe(samples * 2);
    const expected = Math.round((timelineDuration(timeline) / 1000) * 44100);
    expect(Math.abs(samples - expected)).toBeLessThanOrEqual(1);

    let peak = 0;
    const edges: number[] = [];
    let cursor = 0;
    for (const segment of timeline) {
      const start = Math.round((cursor / 1000) * 44100);
      cursor += segment.ms;
      const end = Math.round((cursor / 1000) * 44100);
      if (!segment.on || end <= start) continue;
      edges.push(view.getInt16(44 + start * 2, true), view.getInt16(44 + (end - 1) * 2, true));
    }
    for (let index = 0; index < samples; index += 1) {
      peak = Math.max(peak, Math.abs(view.getInt16(44 + index * 2, true)));
    }
    expect(peak).toBeLessThanOrEqual(32767);
    expect(peak).toBeGreaterThan(1000);
    for (const edge of edges) expect(Math.abs(edge)).toBeLessThanOrEqual(1);
  });
});

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
