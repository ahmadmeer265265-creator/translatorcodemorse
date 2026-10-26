import { describe, expect, it } from 'vitest';
import { detectDominantFrequency, fftMagnitudes } from './audio-frequency';
import { addNoise, synthesizeMorsePcm } from './audio-synth';

const SR = 44100;

function tone(frequencyHz: number, seconds = 1, volume = 0.8): Float32Array {
  const n = Math.round(SR * seconds);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i += 1) pcm[i] = volume * Math.sin((2 * Math.PI * frequencyHz * i) / SR);
  return pcm;
}

describe('fftMagnitudes', () => {
  it('peaks at the bin of a pure tone', () => {
    const mag = fftMagnitudes(tone(880, 0.2), 4096);
    let peakBin = 0;
    for (let i = 0; i < mag.length; i += 1) if (mag[i]! > mag[peakBin]!) peakBin = i;
    const binHz = SR / (mag.length * 2);
    expect(Math.abs(peakBin * binHz - 880)).toBeLessThanOrEqual(binHz);
  });
});

describe('detectDominantFrequency', () => {
  it.each([400, 600, 800, 900])('detects a %d Hz Morse tone within 2%%', (frequency) => {
    // Morse bursts (SOS at 20 WPM) — detection must ignore the silent gaps.
    const { pcm } = synthesizeMorsePcm('... --- ...', { frequency, sampleRate: SR });
    const peak = detectDominantFrequency(pcm, SR);
    expect(peak).not.toBeNull();
    expect(Math.abs(peak!.frequencyHz - frequency)).toBeLessThanOrEqual(frequency * 0.02);
  });

  it('detects a constant carrier (no gaps)', () => {
    const peak = detectDominantFrequency(tone(700), SR);
    expect(peak).not.toBeNull();
    expect(Math.abs(peak!.frequencyHz - 700)).toBeLessThanOrEqual(14);
  });

  it.each([400, 700, 900])('detects %d Hz under additive noise', (frequency) => {
    const { pcm } = synthesizeMorsePcm('... --- ...', { frequency, sampleRate: SR });
    const noisy = addNoise(pcm, 0.15);
    const peak = detectDominantFrequency(noisy, SR);
    expect(peak).not.toBeNull();
    expect(Math.abs(peak!.frequencyHz - frequency)).toBeLessThanOrEqual(frequency * 0.02);
  });

  it('returns null for silence', () => {
    expect(detectDominantFrequency(new Float32Array(SR), SR)).toBeNull();
  });

  it('returns null for broadband noise with no carrier', () => {
    const noise = addNoise(new Float32Array(SR), 0.4);
    expect(detectDominantFrequency(noise, SR)).toBeNull();
  });
});
