/**
 * Automatic Morse tone-frequency detection on raw PCM samples.
 *
 * Pure JavaScript (no AudioContext) so it is unit-testable in Node and can be
 * fed from any source: a decoded AudioBuffer's channel data, or — in a later
 * task — live AnalyserNode time-domain chunks from the homepage's mic mode.
 * Only loud ("mark") regions are analyzed; silence and noise-only stretches
 * are skipped, so quiet gaps cannot pull the estimate toward 0 Hz.
 *
 * Algorithm: windowed RMS finds loud regions; each region is Hann-windowed,
 * zero-padded, and run through a small radix-2 FFT; the magnitude spectra are
 * summed and the peak bin inside the plausible CW band is refined with
 * parabolic interpolation for sub-bin accuracy.
 */

export type FrequencyDetectOptions = {
  /** Plausible tone band, Hz. Defaults to the CW-relevant 200–1500 Hz. */
  minHz?: number;
  maxHz?: number;
  /** RMS window used to find loud regions. Default 5 ms. */
  windowMs?: number;
  /** Loud threshold this many dB below the peak window. Default 12 dB. */
  thresholdDb?: number;
  /** Shorter loud runs are treated as noise blips. Default 25 ms. */
  minMarkMs?: number;
  /** Per-region FFT input cap (samples). Default 4096. */
  maxRegionSamples?: number;
  /** Tonal prominence required (peak / median band magnitude). Default 3. */
  prominence?: number;
};

export type FrequencyPeak = {
  frequencyHz: number;
  /** Peak-to-median magnitude ratio in the search band. */
  prominence: number;
  /** Number of loud regions that contributed spectra. */
  regions: number;
};

/** In-place iterative radix-2 FFT. re/im must be the same power-of-2 length. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j |= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cRe = 1;
      let cIm = 0;
      for (let j = 0; j < half; j += 1) {
        const uRe = re[i + j]!;
        const uIm = im[i + j]!;
        const vRe = re[i + j + half]! * cRe - im[i + j + half]! * cIm;
        const vIm = re[i + j + half]! * cIm + im[i + j + half]! * cRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nRe;
      }
    }
  }
}

/** Magnitude spectrum of a real signal, Hann-windowed and zero-padded. */
export function fftMagnitudes(samples: Float64Array | Float32Array, fftSize?: number): Float64Array {
  let n = 1;
  const target = fftSize ?? nextPow2(samples.length);
  n = Math.max(target, 2);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const len = Math.min(samples.length, n);
  for (let i = 0; i < len; i += 1) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (len - 1 || 1)));
    re[i] = samples[i]! * w;
  }
  fftInPlace(re, im);
  const half = n >> 1;
  const mag = new Float64Array(half);
  for (let i = 0; i < half; i += 1) {
    mag[i] = Math.hypot(re[i]!, im[i]!);
  }
  return mag;
}

function nextPow2(value: number): number {
  let n = 1;
  while (n < value) n <<= 1;
  return n;
}

function rms(slice: Float64Array | Float32Array): number {
  if (slice.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < slice.length; i += 1) sum += slice[i]! * slice[i]!;
  return Math.sqrt(sum / slice.length);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Contiguous loud regions as sample offsets, skipping silence/noise-only runs. */
export function loudRegions(
  samples: Float32Array,
  sampleRate: number,
  options: FrequencyDetectOptions = {},
): Array<{ start: number; end: number }> {
  const windowMs = options.windowMs ?? 5;
  const thresholdDb = options.thresholdDb ?? 12;
  const minMarkMs = options.minMarkMs ?? 25;

  const win = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  const windows = Math.floor(samples.length / win);
  if (windows === 0) return [];

  const levels = new Float64Array(windows);
  let peak = 0;
  for (let w = 0; w < windows; w += 1) {
    const level = rms(samples.subarray(w * win, (w + 1) * win));
    levels[w] = level;
    if (level > peak) peak = level;
  }
  if (peak < 1e-5) return [];

  const thr = peak * Math.pow(10, -thresholdDb / 20);
  const minLen = Math.max(1, Math.round((minMarkMs / windowMs)));

  const regions: Array<{ start: number; end: number }> = [];
  let run = 0;
  for (let w = 0; w <= windows; w += 1) {
    const loud = w < windows && levels[w]! >= thr;
    if (loud) {
      run += 1;
      continue;
    }
    if (run >= minLen) regions.push({ start: (w - run) * win, end: w * win });
    run = 0;
  }
  return regions;
}

/**
 * Dominant tone frequency during loud regions, or null when no tonal peak
 * stands out (silence, or broadband noise with no carrier). Parabolic
 * interpolation on the peak bin gives ~±1–2 Hz at 44.1 kHz with 4096-sample
 * regions even though the raw bin width is ~10.8 Hz.
 */
export function detectDominantFrequency(
  samples: Float32Array,
  sampleRate: number,
  options: FrequencyDetectOptions = {},
): FrequencyPeak | null {
  const minHz = options.minHz ?? 200;
  const maxHz = options.maxHz ?? 1500;
  const maxRegionSamples = options.maxRegionSamples ?? 4096;
  const prominenceMin = options.prominence ?? 3;

  const regions = loudRegions(samples, sampleRate, options);
  if (regions.length === 0) return null;

  // Shared FFT size across regions so their spectra are directly summable.
  const fftSize = Math.min(nextPow2(maxRegionSamples), 16384);
  const spectrum = new Float64Array(fftSize >> 1);
  let used = 0;
  for (const region of regions) {
    const len = region.end - region.start;
    if (len < 64) continue;
    // Trim 10% at each end to skip attack/release ramps, cap the middle.
    const trim = Math.floor(len * 0.1);
    const spanStart = region.start + trim;
    const spanLen = Math.min(len - trim * 2, maxRegionSamples);
    if (spanLen < 64) continue;
    const center = spanStart + ((len - trim * 2 - spanLen) >> 1);
    const mag = fftMagnitudes(samples.subarray(center, center + spanLen), fftSize);
    for (let i = 0; i < spectrum.length; i += 1) spectrum[i]! += mag[i]!;
    used += 1;
  }
  if (used === 0) return null;

  const df = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(minHz / df));
  const hi = Math.min(spectrum.length - 2, Math.ceil(maxHz / df));
  let peakBin = -1;
  let peakMag = 0;
  for (let i = lo; i <= hi; i += 1) {
    if (spectrum[i]! > peakMag) {
      peakMag = spectrum[i]!;
      peakBin = i;
    }
  }
  if (peakBin < 0 || peakMag <= 0) return null;

  const band = Array.from(spectrum.subarray(lo, hi + 1));
  const prominence = peakMag / (median(band) || 1);
  if (prominence < prominenceMin) return null;

  // Parabolic interpolation around the peak bin.
  const y0 = spectrum[peakBin - 1]!;
  const y1 = spectrum[peakBin]!;
  const y2 = spectrum[peakBin + 1]!;
  const denom = y0 - 2 * y1 + y2;
  const delta = denom === 0 ? 0 : (0.5 * (y0 - y2)) / denom;
  const frequencyHz = (peakBin + delta) * df;
  return { frequencyHz, prominence, regions: used };
}
