/**
 * File-based Morse audio decoding.
 *
 * Reuses the live-mic pipeline from mic-decode.ts (envelope -> threshold ->
 * mark/space segmentation -> adaptive dot/dash/gap classification -> text via
 * morse.ts) but feeds it from pre-recorded PCM instead of a live stream:
 * an AudioBuffer's channel data, an uploaded file decoded with the native
 * AudioContext.decodeAudioData(), or — later — any recorder output.
 *
 * Everything here is pure math on Float32Array samples. No network access
 * exists anywhere in this pipeline: audio never leaves the device.
 */
import {
  MIN_MARK_MS,
  classifyGapWithModel,
  createMicDecoder,
  envelopeToSegments,
  type GapModel,
  type MicDecoderState,
  type Segment,
} from './mic-decode';
import { detectDominantFrequency } from './audio-frequency';

/** Raw decoded audio: one Float32Array per channel plus the sample rate. */
export type PcmSource = {
  channels: readonly (Float32Array | number[])[];
  sampleRate: number;
};

export type DecodeAudioOptions = {
  /** Manual noise floor (dBFS). Default: measured floor of the envelope. */
  minVolumeDb?: number;
  /** Manual signal peak (dBFS). Default: measured peak of the envelope. */
  maxVolumeDb?: number;
  /** Threshold this many dB below the peak. Default 12. */
  volumeThresholdDb?: number;
  /** Manual tone frequency; enables band-pass filtering before the envelope. */
  frequencyHz?: number;
  /** Band-pass Q used with the effective frequency. Default 8. */
  filterQ?: number;
  /** Manual speed: locks the dot unit at 1200/wpmRate (no adaptation). */
  wpmRate?: number;
  /**
   * Manual Farnsworth overall speed. Together with wpmRate this pins the
   * expected intra/letter/word gap durations, overriding adaptive ratios.
   */
  farnsworthWpm?: number;
  /**
   * When true (and the default when no manual frequency is given) the tone
   * frequency is auto-detected from the audio, ignoring any manual value.
   * Set false to force a manual frequencyHz.
   */
  automaticFrequencyTracking?: boolean;
  /** RMS window for the envelope. Default 5 ms. */
  windowMs?: number;
};

export type DecodeAudioResult = {
  detected: boolean;
  text: string;
  morse: string;
  marks: string;
  events: MicDecoderState['events'];
  /** Effective tone frequency (detected, or manual when tracking is off). */
  frequencyHz: number | null;
  /** Estimated dot unit from the shortest observed mark, when known. */
  unitMs: number | null;
  peakDb: number;
  floorDb: number;
  thresholdDb: number;
  segments: Segment[];
};

/** RMS window levels of a mono signal, mirroring the live-mic analyser RMS. */
export function pcmToEnvelope(
  samples: Float32Array,
  sampleRate: number,
  windowMs = 5,
): Array<readonly [timeMs: number, amplitude: number]> {
  const win = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  const windows = Math.floor(samples.length / win);
  const out: Array<readonly [number, number]> = [];
  if (windows === 0) return out;
  out.push([0, 0] as const);
  for (let w = 0; w < windows; w += 1) {
    let sum = 0;
    const start = w * win;
    for (let i = start; i < start + win; i += 1) sum += samples[i]! * samples[i]!;
    const level = Math.sqrt(sum / win);
    out.push([((w + 1) * win * 1000) / sampleRate, level] as const);
  }
  return out;
}

/** Average all channels into one mono track (decodeAudioData keeps channels). */
export function downmixMono(source: PcmSource): Float32Array {
  const [first] = source.channels;
  if (!first) return new Float32Array(0);
  if (source.channels.length === 1) return Float32Array.from(first as Float32Array);
  const len = first.length;
  const mono = new Float32Array(len);
  for (const channel of source.channels) {
    for (let i = 0; i < len; i += 1) mono[i]! += channel[i]!;
  }
  const scale = 1 / source.channels.length;
  for (let i = 0; i < len; i += 1) mono[i]! *= scale;
  return mono;
}

export function dbOf(value: number): number {
  return 20 * Math.log10(Math.max(value, 1e-9));
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index]!;
}

/** RBJ band-pass biquad (constant 0 dB peak gain) to isolate the tone. */
export function bandpassFilter(
  samples: Float32Array,
  sampleRate: number,
  frequencyHz: number,
  q = 8,
): Float32Array {
  const w0 = (2 * Math.PI * frequencyHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw = Math.cos(w0);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw;
  const a2 = 1 - alpha;
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i]!;
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

/**
 * Farnsworth gap in ms for a given character speed and overall speed.
 * Same ARRL relation used by morse-audio.ts's private farnsworthGapMs
 * (deliberately mirrored, not imported, so the homepage's lazy audio chunk
 * stays byte-identical). audio-decode-file.test.ts asserts numerical
 * equivalence with buildTimeline so the two copies cannot drift apart.
 */
export function farnsworthGapMs(wpm: number, farnsworthWpm: number, units: number): number {
  const ta = (60 * wpm - 37.2 * farnsworthWpm) / (19 * wpm * farnsworthWpm);
  return units * ta * 1000;
}

/** Build the manual gap model from a fixed WPM plus Farnsworth speed. */
export function gapModelFor(wpmRate: number, farnsworthWpm?: number): GapModel | undefined {
  if (!Number.isFinite(wpmRate) || wpmRate <= 0) return undefined;
  const unit = 1200 / wpmRate;
  const fs = farnsworthWpm !== undefined && Number.isFinite(farnsworthWpm) ? farnsworthWpm : wpmRate;
  if (fs >= wpmRate) return undefined; // standard 1/3/7 ratios — adaptive path is fine
  return {
    intraMs: unit,
    letterMs: farnsworthGapMs(wpmRate, fs, 3),
    wordMs: farnsworthGapMs(wpmRate, fs, 7),
  };
}

const EMPTY_RESULT: DecodeAudioResult = {
  detected: false,
  text: '',
  morse: '',
  marks: '',
  events: [],
  frequencyHz: null,
  unitMs: null,
  peakDb: -Infinity,
  floorDb: -Infinity,
  thresholdDb: -Infinity,
  segments: [],
};

/**
 * Decode Morse from pre-recorded PCM. Fully synchronous and side-effect
 * free; the browser file wrapper below is a thin decodeAudioData shim that
 * calls this.
 */
export function decodeMorsePcm(source: PcmSource, options: DecodeAudioOptions = {}): DecodeAudioResult {
  const mono = downmixMono(source);
  if (mono.length === 0) return { ...EMPTY_RESULT };

  const tracking = options.automaticFrequencyTracking ?? options.frequencyHz === undefined;
  let frequencyHz: number | null = null;
  if (tracking) {
    frequencyHz = detectDominantFrequency(mono, source.sampleRate)?.frequencyHz ?? null;
  } else if (options.frequencyHz !== undefined && options.frequencyHz > 0) {
    frequencyHz = options.frequencyHz;
  }

  // Optional band-pass around the effective frequency to reject off-band noise.
  const work =
    frequencyHz !== null
      ? bandpassFilter(mono, source.sampleRate, frequencyHz, options.filterQ ?? 8)
      : mono;

  const envelope = pcmToEnvelope(work, source.sampleRate, options.windowMs ?? 5);
  if (envelope.length === 0) return { ...EMPTY_RESULT, frequencyHz };

  const dbs = envelope.map(([, amp]) => dbOf(amp)).sort((a, b) => a - b);
  const floorDb = options.minVolumeDb ?? percentile(dbs, 10);
  const peakDb = options.maxVolumeDb ?? dbs[dbs.length - 1]!;
  const thresholdDb = peakDb - (options.volumeThresholdDb ?? 12);

  // Absolute-silence guard: a barely-there peak means "nothing detected".
  if (peakDb < -45) return { ...EMPTY_RESULT, frequencyHz, peakDb, floorDb, thresholdDb };

  const threshold = Math.pow(10, thresholdDb / 20);
  const segments = envelopeToSegments(envelope, threshold);
  if (!segments.some((segment) => segment.type === 'mark' && segment.durationMs >= MIN_MARK_MS)) {
    return { ...EMPTY_RESULT, frequencyHz, peakDb, floorDb, thresholdDb, segments };
  }

  const decoder = createMicDecoder({
    lockUnitMs: options.wpmRate !== undefined && options.wpmRate > 0 ? 1200 / options.wpmRate : undefined,
    gapModel:
      options.wpmRate !== undefined && options.wpmRate > 0
        ? gapModelFor(options.wpmRate, options.farnsworthWpm)
        : undefined,
  });
  for (const segment of segments) decoder.push(segment);
  const state = decoder.flush();

  let unitMs: number | null = null;
  for (const segment of segments) {
    if (segment.type === 'mark' && segment.durationMs >= MIN_MARK_MS) {
      unitMs = unitMs === null ? segment.durationMs : Math.min(unitMs, segment.durationMs);
    }
  }

  return {
    detected: state.text.length > 0 || state.marks.length > 0,
    text: state.text,
    morse: state.morse,
    marks: state.marks,
    events: state.events,
    frequencyHz,
    unitMs,
    peakDb,
    floorDb,
    thresholdDb,
    segments,
  };
}

/**
 * Browser wrapper: decode an uploaded audio file entirely locally with the
 * native AudioContext.decodeAudioData() (no library, no network), then run
 * the pure PCM pipeline. Rejects with a friendly error for unsupported or
 * corrupt files (codec/container failures surface as decodeAudioData errors).
 */
export async function decodeAudioFileBytes(
  bytes: ArrayBuffer,
  options: DecodeAudioOptions = {},
): Promise<DecodeAudioResult> {
  const AudioCtx =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('This browser does not support the Web Audio API needed to read audio files.');
  }
  const ctx = new AudioCtx();
  try {
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
      channels.push(buffer.getChannelData(ch));
    }
    return decodeMorsePcm({ channels, sampleRate: buffer.sampleRate }, options);
  } catch (error) {
    if (error instanceof Error && error.name === 'EncodingError') {
      throw new Error('Could not decode this audio file. Try a WAV, MP3, or OGG file.');
    }
    throw error;
  } finally {
    void ctx.close().catch(() => {});
  }
}

/** classifyGapWithModel re-export so page stages get one import surface. */
export { classifyGapWithModel };
