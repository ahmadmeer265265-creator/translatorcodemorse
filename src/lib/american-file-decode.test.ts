import { describe, expect, it } from 'vitest';
import { encode } from './american-morse';
import { decodeFilteredPcm, detectToneHz } from './american-file-decode';
import { buildAmericanTimeline, renderCwPcm } from './american-playback';
import { decodePcm } from './american-translator-ui';

function addNoise(pcm: Float32Array, amplitude: number, seed = 99): Float32Array {
  let state = seed;
  const out = Float32Array.from(pcm);
  for (let i = 0; i < out.length; i += 1) {
    state = (state * 16807) % 2147483647;
    out[i]! += ((state / 2147483647) * 2 - 1) * amplitude;
  }
  return out;
}

describe('tone-filtered upload decode', () => {
  const morse = encode('SOS').output;
  const timeline = buildAmericanTimeline(morse, 15);
  const clean = renderCwPcm(timeline, { frequency: 700, sampleRate: 8000, volume: 0.55 });

  it('finds the CW pitch and decodes a clean tone', () => {
    expect(detectToneHz(clean, 8000)).toBeGreaterThanOrEqual(680);
    expect(detectToneHz(clean, 8000)).toBeLessThanOrEqual(720);
    expect(decodeFilteredPcm(clean, 8000).text).toBe('SOS');
  });

  it('still reads the message when broadband noise fools the loudness gate', () => {
    const noisy = addNoise(clean, 0.42);
    const gated = decodePcm(noisy, 8000);
    const filtered = decodeFilteredPcm(noisy, 8000);
    expect(gated.text).toBe('#');
    expect(filtered.text).toBe('SOS');
    expect(filtered.frequencyHz).toBeGreaterThanOrEqual(680);
    expect(filtered.frequencyHz).toBeLessThanOrEqual(720);
  });

  it('decodes L and 0 from a filtered tone at another speed', () => {
    const pcm = renderCwPcm(buildAmericanTimeline(encode('L0').output, 6), {
      frequency: 550,
      sampleRate: 8000,
      volume: 0.5,
    });
    expect(decodeFilteredPcm(pcm, 8000).text).toBe('L0');
  });
});
