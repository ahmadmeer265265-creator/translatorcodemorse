/**
 * Uploaded-audio decode for American Morse.
 *
 * A loudness gate treats broadband noise as marks. This path finds the
 * dominant tone, band-passes around it, then hands the envelope to the
 * Stage 1 segment decoder. It does not import the International decoder.
 */
import { decodeAmericanSegments, envelopeToSegments, type AmericanMicDecoderState } from './american-mic-decode';

export type FilteredDecode = AmericanMicDecoderState & {
  frequencyHz: number | null;
};

const EMPTY: FilteredDecode = { marks: '', text: '', morse: '', events: [], frequencyHz: null };

/** Goertzel power at one frequency. */
function goertzelPower(samples: ArrayLike<number>, sampleRate: number, frequencyHz: number): number {
  const n = samples.length;
  if (n < 8) return 0;
  const w = (2 * Math.PI * frequencyHz) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i += 1) {
    const s0 = (samples[i] ?? 0) + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Peak in the CW band, measured on loud windows only. Prominence is the
 * peak power divided by the median power across the band, so a neighbor
 * bin leaking from a pure sine does not hide the tone.
 */
export function detectToneHz(samples: ArrayLike<number>, sampleRate: number): number | null {
  const window = Math.max(1, Math.round(sampleRate * 0.02));
  const windows = Math.floor(samples.length / window);
  if (windows < 2) return null;
  const levels: number[] = [];
  let peak = 0;
  for (let w = 0; w < windows; w += 1) {
    let sum = 0;
    const start = w * window;
    for (let i = 0; i < window; i += 1) {
      const sample = samples[start + i] ?? 0;
      sum += sample * sample;
    }
    const level = Math.sqrt(sum / window);
    levels.push(level);
    peak = Math.max(peak, level);
  }
  if (peak < 0.01) return null;
  const gate = peak * 10 ** (-12 / 20);
  const loud: number[] = [];
  for (let w = 0; w < windows && loud.length < 4096; w += 1) {
    if ((levels[w] ?? 0) < gate) continue;
    const start = w * window;
    for (let i = 0; i < window && loud.length < 4096; i += 1) loud.push(samples[start + i] ?? 0);
  }
  if (loud.length < 64) return null;
  const powers: number[] = [];
  let bestHz = 0;
  let best = 0;
  for (let hz = 250; hz <= 1400; hz += 10) {
    const power = goertzelPower(loud, sampleRate, hz);
    powers.push(power);
    if (power > best) {
      best = power;
      bestHz = hz;
    }
  }
  const floor = median(powers);
  if (bestHz === 0 || floor <= 0 || best < floor * 3) return null;
  return bestHz;
}

/** RBJ constant-peak band-pass. */
export function bandpass(
  samples: ArrayLike<number>,
  sampleRate: number,
  frequencyHz: number,
  q = 8,
): Float32Array {
  const w0 = (2 * Math.PI * frequencyHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw = Math.cos(w0);
  const b0 = alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw;
  const a2 = 1 - alpha;
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i] ?? 0;
    const y0 = (b0 / a0) * x0 + (0 / a0) * x1 + (-b0 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

function envelopeOf(samples: ArrayLike<number>, sampleRate: number, windowMs = 5) {
  const win = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  const windows = Math.floor(samples.length / win);
  if (windows === 0) return [];
  const out: Array<readonly [number, number]> = [[0, 0]];
  for (let w = 0; w < windows; w += 1) {
    let sum = 0;
    const start = w * win;
    for (let i = start; i < start + win; i += 1) {
      const sample = samples[i] ?? 0;
      sum += sample * sample;
    }
    out.push([((w + 1) * win * 1000) / sampleRate, Math.sqrt(sum / win)]);
  }
  return out;
}

export function decodeFilteredPcm(samples: ArrayLike<number>, sampleRate: number): FilteredDecode {
  if (samples.length === 0 || sampleRate <= 0) return { ...EMPTY };
  const frequencyHz = detectToneHz(samples, sampleRate);
  const filtered = frequencyHz === null ? samples : bandpass(samples, sampleRate, frequencyHz);
  const envelope = envelopeOf(filtered, sampleRate);
  if (envelope.length < 2) return { ...EMPTY, frequencyHz };
  let peak = 0;
  for (const [, amplitude] of envelope) peak = Math.max(peak, amplitude);
  if (peak < 0.01) return { ...EMPTY, frequencyHz };
  const threshold = peak * 10 ** (-12 / 20);
  const state = decodeAmericanSegments(envelopeToSegments(envelope, threshold));
  return { ...state, frequencyHz };
}
