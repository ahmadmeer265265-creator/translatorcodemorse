/**
 * Spectrogram data for the Audio Decoder panel.
 *
 * A real frequency-over-time view (not a fake level bar), because Stage 1
 * already ships the FFT: offline, an STFT of the decoded PCM uses
 * fftMagnitudes from audio-frequency.ts; live, the browser's AnalyserNode
 * computes the same magnitudes on the audio graph and only the normalizer +
 * palette from this module are needed. Loaded in a lazy chunk — decorative,
 * never on first paint.
 */
import { fftMagnitudes } from './audio-frequency';

export type SpectrogramOptions = {
  /** STFT window. Default 512 samples (~11.6 ms @ 44.1 kHz). */
  fftSize?: number;
  /** Hop between windows. Default = fftSize / 2. */
  hopSize?: number;
  /** Cap columns so a long file cannot blow memory. Default 600. */
  maxFrames?: number;
  /** Only keep bins up to this frequency. Default 2000 Hz. */
  maxHz?: number;
};

/** One column of the spectrogram: normalized 0–1 magnitudes, low bin first. */
export type SpectrogramFrame = Float32Array;

export type Spectrogram = {
  frames: SpectrogramFrame[];
  /** Hz between adjacent bins. */
  binHz: number;
  /** Bins kept per frame (after maxHz cropping). */
  bins: number;
  sampleRate: number;
};

/**
 * Short-time Fourier transform magnitudes, normalized per-frame to 0–1 with
 * a soft log curve so the tone line stays visible next to quiet noise.
 */
export function stftSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  options: SpectrogramOptions = {},
): Spectrogram {
  const fftSize = options.fftSize ?? 512;
  const hop = options.hopSize ?? Math.max(1, fftSize >> 1);
  const maxFrames = options.maxFrames ?? 600;
  const maxHz = options.maxHz ?? 2000;

  const binHz = sampleRate / fftSize;
  const bins = Math.max(1, Math.min(fftSize >> 1, Math.ceil(maxHz / binHz)));
  const total = samples.length;
  const count = total <= fftSize ? 1 : Math.min(maxFrames, 1 + Math.floor((total - fftSize) / hop));
  // Re-space hops when the cap kicks in so the whole file still fits.
  const stride = count <= 1 ? hop : Math.max(1, Math.floor((total - fftSize) / (count - 1)));

  const frames: SpectrogramFrame[] = [];
  for (let f = 0; f < count; f += 1) {
    const start = Math.min(f * stride, Math.max(0, total - fftSize));
    const slice = samples.subarray(start, Math.min(total, start + fftSize));
    const mag = fftMagnitudes(slice, fftSize);
    frames.push(normalizeMagnitudes(mag.subarray(0, bins)));
  }
  return { frames, binHz, bins, sampleRate };
}

/** Normalize raw magnitudes to 0–1 (peak-relative, gentle log compression). */
export function normalizeMagnitudes(mags: Float64Array | Float32Array): SpectrogramFrame {
  const out = new Float32Array(mags.length);
  let peak = 0;
  for (let i = 0; i < mags.length; i += 1) if (mags[i]! > peak) peak = mags[i]!;
  if (peak <= 0) return out;
  for (let i = 0; i < mags.length; i += 1) {
    const v = mags[i]! / peak;
    out[i] = Math.log1p(10 * v) / Math.log1p(10);
  }
  return out;
}

/**
 * Brand heat palette: the spectrogram strip is a fixed dark panel in both
 * themes (same approach as the demo-video poster), running from the dark
 * surface to the copper/amber accent so it reads in light and dark mode.
 */
export function heatColor(value: number): [r: number, g: number, b: number] {
  const v = Math.min(1, Math.max(0, value));
  // Dark charcoal (#14110e) -> copper amber (#f0a94e).
  const r = Math.round(0x14 + (0xf0 - 0x14) * v);
  const g = Math.round(0x11 + (0xa9 - 0x11) * v);
  const b = Math.round(0x0e + (0x4e - 0x0e) * v);
  return [r, g, b];
}
