/**
 * Synthetic Morse audio builder for tests and future diagnostics.
 *
 * Renders real PCM through the SAME tested encoder the site ships
 * (morse-audio.ts encodeWav), then strips the WAV container — so decode-side
 * tests exercise the exact tone/envelope characteristics of production audio,
 * including the 5 ms CW attack/release ramps.
 */
import { buildTimeline, encodeWav, type Segment } from './morse-audio';
import { pcmFromWavBytes } from './wav-pcm';

export type SynthOptions = {
  /** Character speed. Default 20 WPM. */
  wpm?: number;
  /** Farnsworth overall speed (stretched gaps). Default = wpm. */
  farnsworthWpm?: number;
  /** Tone frequency. Default 700 Hz. */
  frequency?: number;
  /** 0–1 peak. Default 0.8. */
  volume?: number;
  /** Default 44100. */
  sampleRate?: number;
  /**
   * Per-symbol dot-unit override (ms) to simulate a sender whose speed
   * drifts. Replaces the fixed WPM timing for every symbol.
   */
  unitFn?: (index: number) => number;
};

/**
 * Build an on/off segment timeline from a Morse string with a constant or
 * drifting dot unit — the same symbol-to-timing mapping mic-decode.ts's
 * decodeMorseEnvelope uses (dash = 3u, intra = 1u, letter gap = 3u total,
 * word gap = 7u total).
 */
export function morseTimelineWithUnits(morse: string, unitFn: (index: number) => number): Segment[] {
  const timeline: Segment[] = [];
  let index = 0;
  for (const char of morse) {
    const unit = unitFn(index);
    if (char === '.' || char === '-') {
      timeline.push({ on: true, ms: char === '-' ? 3 * unit : unit });
      timeline.push({ on: false, ms: unit });
    } else if (char === ' ') {
      timeline.push({ on: false, ms: 2 * unit }); // intra already +1 → total 3
    } else if (char === '/') {
      timeline.push({ on: false, ms: 4 * unit }); // total 7
    }
    if (char === '.' || char === '-' || char === ' ' || char === '/') index += 1;
  }
  return timeline;
}

/** Render a Morse string to mono PCM through the production WAV renderer. */
export function synthesizeMorsePcm(
  morse: string,
  options: SynthOptions = {},
): { pcm: Float32Array; sampleRate: number } {
  const sampleRate = options.sampleRate ?? 44100;
  const timeline = options.unitFn
    ? morseTimelineWithUnits(morse, options.unitFn)
    : buildTimeline(morse, { wpm: options.wpm ?? 20, farnsworthWpm: options.farnsworthWpm });
  const wav = encodeWav(timeline, {
    frequency: options.frequency ?? 700,
    volume: options.volume ?? 0.8,
    sampleRate,
  });
  const { channels } = pcmFromWavBytes(wav);
  return { pcm: channels[0]!, sampleRate };
}

/** Deterministic white noise (LCG, same family as morse-audio's telegraph). */
export function addNoise(pcm: Float32Array, amplitude: number, seed = 123456789): Float32Array {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  const out = Float32Array.from(pcm);
  for (let i = 0; i < out.length; i += 1) {
    state = (state * 16807) % 2147483647;
    out[i]! += ((state / 2147483647) * 2 - 1) * amplitude;
  }
  return out;
}
