import { describe, expect, it } from 'vitest';
import { heatColor, normalizeMagnitudes, stftSpectrogram } from './audio-spectrogram';
import { synthesizeMorsePcm } from './audio-synth';

const SR = 44100;

describe('stftSpectrogram', () => {
  it('produces time-ordered frames with a clear tone line', () => {
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, frequency: 700, sampleRate: SR });
    const spec = stftSpectrogram(pcm, SR);
    expect(spec.frames.length).toBeGreaterThan(20);
    expect(spec.bins).toBe(Math.ceil(2000 / spec.binHz));
    // The 700 Hz row must light up during marks and go dark during gaps.
    const toneBin = Math.round(700 / spec.binHz);
    const col = spec.frames.map((f) => f[toneBin]!);
    expect(Math.max(...col)).toBeGreaterThan(0.9); // normalized peak present
    expect(Math.min(...col)).toBeLessThan(0.05); // dark during silence
    // Both bright and dark columns exist (on/off structure captured).
    const bright = col.filter((v) => v > 0.5).length;
    const dark = col.filter((v) => v < 0.05).length;
    expect(bright).toBeGreaterThan(5);
    expect(dark).toBeGreaterThan(5);
  });

  it('caps frame count and still spans the whole file', () => {
    const { pcm } = synthesizeMorsePcm('... --- ... / ... --- ...', { wpm: 8, sampleRate: SR });
    const spec = stftSpectrogram(pcm, SR, { maxFrames: 50 });
    expect(spec.frames.length).toBeLessThanOrEqual(50);
    expect(spec.frames.length).toBeGreaterThan(10);
  });

  it('handles empty input without crashing', () => {
    const spec = stftSpectrogram(new Float32Array(0), SR);
    expect(spec.frames.length).toBe(1);
    expect([...spec.frames[0]!].every((v) => v === 0)).toBe(true);
  });
});

describe('normalizeMagnitudes + heatColor', () => {
  it('normalizes to 0–1 with log compression and survives silence', () => {
    const norm = normalizeMagnitudes(Float64Array.from([0, 0.5, 1]));
    expect(norm[2]).toBeCloseTo(1, 5);
    expect(norm[0]).toBe(0);
    expect(norm[1]!).toBeGreaterThan(0.5); // log curve lifts mid values
    expect([...normalizeMagnitudes(new Float32Array(4))].every((v) => v === 0)).toBe(true);
  });

  it('heatColor runs dark panel to amber accent', () => {
    expect(heatColor(0)).toEqual([0x14, 0x11, 0x0e]);
    expect(heatColor(1)).toEqual([0xf0, 0xa9, 0x4e]);
    expect(heatColor(-1)[0]).toBe(0x14);
    expect(heatColor(2)[2]).toBe(0x4e);
  });
});
