/**
 * MP3 download encoding for the audio-translator page.
 *
 * PCM comes from the SAME tested morse-audio.ts renderer used for WAV
 * downloads (tone synthesis is not reimplemented); this module only swaps the
 * container: WAV header stripped, int16 -> float32, then the pure-JavaScript
 * `audiobox/mp3` encoder produces the MP3 bitstream.
 *
 * This file is imported DYNAMICALLY and only when the user asks for an MP3 —
 * never on page view and never for a WAV download — so the ~19 KB (gzip)
 * encoder lands in its own lazy chunk.
 */
import { encodeWav, timelineDuration, WAV_LIMIT_MS, type Segment, type WavOptions } from './morse-audio';
import { encodeMp3Channels } from 'audiobox/mp3';
import { pcmFromWavBytes } from './wav-pcm';

/** Sample rates MPEG-1 Layer III supports (the encoder rejects others). */
export const MP3_SAMPLE_RATES = [44100, 48000, 32000] as const;

export type Mp3EncodeOptions = {
  /** CBR bitrate in kbps. Default 96 — plenty for a pure tone. */
  bitrate?: number;
};

/**
 * Encode a Morse timeline to an MP3 file (same WAV_LIMIT_MS guard the
 * homepage applies to WAV downloads).
 */
export function encodeMp3FromTimeline(
  timeline: readonly Segment[],
  wavOptions: WavOptions,
  mp3Options: Mp3EncodeOptions = {},
): Uint8Array {
  if (timelineDuration(timeline) > WAV_LIMIT_MS) {
    throw new RangeError(`Audio is too long to download (limit ${WAV_LIMIT_MS / 60000} minutes).`);
  }
  const sampleRate = wavOptions.sampleRate ?? 44100;
  if (!MP3_SAMPLE_RATES.includes(sampleRate as (typeof MP3_SAMPLE_RATES)[number])) {
    throw new RangeError(`MP3 needs a 32000/44100/48000 Hz sample rate, got ${sampleRate}.`);
  }
  const wav = encodeWav(timeline, { ...wavOptions, sampleRate });
  const { channels } = pcmFromWavBytes(wav);
  return encodeMp3Channels(channels, sampleRate, { bitrate: mp3Options.bitrate ?? 96 });
}
