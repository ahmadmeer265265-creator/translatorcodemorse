/**
 * DOM-free UI helpers for the American Morse translator page.
 * Conversion and audio classification stay in the Stage 1 engine.
 */
import { decode, encode, type DecodeResult, type EncodeResult } from './american-morse';
import {
  decodeAmericanSegments,
  envelopeToSegments,
  type AmericanMicDecoderState,
} from './american-mic-decode';

export const AMERICAN_PAGE_PATH = '/american-morse-code-translator/';
export const LONG_DASH_TOKEN = '=';
export const EXTRA_LONG_DASH_TOKEN = '_';
export const LONG_DASH_LABEL = 'L long dash';
export const EXTRA_LONG_DASH_LABEL = '0 extra-long dash';

/**
 * Live-mic gate. Sensitivity 100 is the most sensitive (0.02 RMS) and
 * 0 is the strictest (0.12). 70 matches the old fixed 0.05 gate.
 */
export function micThresholdFor(sensitivity: number): number {
  const value = Number.isFinite(sensitivity) ? Math.min(100, Math.max(0, sensitivity)) : 70;
  return 0.02 + ((100 - value) / 100) * 0.1;
}

/** Default gate at sensitivity 70. */
export const MIC_RMS_THRESHOLD = micThresholdFor(70);

export const AUDIO_FILE_EXTENSIONS = ['.wav', '.mp3', '.ogg'] as const;
export const AUDIO_FILE_ACCEPT = '.wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg';

const NOTATION_CHARS = new Set([
  '.',
  '-',
  '=',
  '_',
  ' ',
  '\t',
  '\n',
  '\r',
  '/',
  '#',
  '·',
  '•',
  '–',
  '−',
  '—',
  '\u2E3A',
  '\u2E3B',
]);

export function convertText(text: string): EncodeResult {
  return encode(text);
}

export function convertMorse(morse: string): DecodeResult {
  return decode(morse);
}

export function insertToken(
  value: string,
  start: number | null,
  end: number | null,
  token: typeof LONG_DASH_TOKEN | typeof EXTRA_LONG_DASH_TOKEN,
): { value: string; cursor: number } {
  const from = clampIndex(value, start);
  const to = Math.max(from, clampIndex(value, end ?? start));
  const before = from > 0 ? value[from - 1] : '';
  const followsMark = before === '.' || before === '-' || before === '=' || before === '_';
  const inserted = followsMark ? `/${token}` : token;
  return {
    value: value.slice(0, from) + inserted + value.slice(to),
    cursor: from + inserted.length,
  };
}

function clampIndex(value: string, index: number | null): number {
  if (index == null || Number.isNaN(index)) return value.length;
  return Math.max(0, Math.min(value.length, index));
}

/** Characters outside the typed American Morse alphabet. */
export function illegalNotationChars(morse: string): string[] {
  const seen: string[] = [];
  for (const char of Array.from(morse)) {
    if (!NOTATION_CHARS.has(char) && !seen.includes(char)) seen.push(char);
  }
  return seen;
}

export function notationWarning(morse: string): string {
  const illegal = illegalNotationChars(morse);
  if (illegal.length === 0) return '';
  return `Not American Morse notation: ${illegal.join(' ')}. Those characters decode as #.`;
}

export function unsupportedWarning(chars: readonly string[]): string {
  if (chars.length === 0) return '';
  return `No American Morse code for ${chars.join(' ')}. Shown as #.`;
}

export type MicErrorKind = 'denied' | 'insecure' | 'unsupported' | 'no-device' | 'busy' | 'unknown';

export function micErrorKind(errorName: string): MicErrorKind {
  if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorName === 'SecurityError') {
    return 'denied';
  }
  if (errorName === 'NotFoundError' || errorName === 'OverconstrainedError') return 'no-device';
  if (errorName === 'NotReadableError' || errorName === 'AbortError') return 'busy';
  return 'unknown';
}

export function micErrorMessage(kind: MicErrorKind): string {
  switch (kind) {
    case 'denied':
      return 'Microphone access was denied. Allow microphone access for this site in your browser’s site settings, then press Start listening again.';
    case 'insecure':
      return 'The microphone needs a secure connection (https). Open the https version of this page and try again.';
    case 'unsupported':
      return 'This browser does not support microphone input. Try a current version of Chrome, Edge, Firefox, or Safari.';
    case 'no-device':
      return 'No microphone was found on this device. Plug one in or check your system sound settings.';
    case 'busy':
      return 'Could not start the microphone. Another app may be using it — close that app and try again.';
    case 'unknown':
      return 'Could not start the microphone. Check your browser’s site settings and try again.';
  }
}

export function isAudioFileName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return AUDIO_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function fileErrorMessage(reason: 'type' | 'decode', fileName: string): string {
  if (reason === 'type') {
    return `${fileName || 'That file'} is not a WAV, MP3, or OGG file.`;
  }
  return `Could not read ${fileName || 'that audio file'}. Try a WAV, MP3, or OGG recording.`;
}

/** RMS windows, same shape the Stage 1 envelope decoder expects. */
export function pcmToEnvelope(
  samples: ArrayLike<number>,
  sampleRate: number,
  windowMs = 5,
): Array<readonly [timeMs: number, amplitude: number]> {
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

export function envelopeThreshold(envelope: ReadonlyArray<readonly [number, number]>): number {
  let peak = 0;
  for (const [, amplitude] of envelope) peak = Math.max(peak, amplitude);
  return peak * 0.45;
}

export function decodeEnvelope(
  envelope: ReadonlyArray<readonly [number, number]>,
  threshold = envelopeThreshold(envelope),
): AmericanMicDecoderState {
  return decodeAmericanSegments(envelopeToSegments(envelope, threshold));
}

export function decodePcm(samples: ArrayLike<number>, sampleRate: number): AmericanMicDecoderState {
  return decodeEnvelope(pcmToEnvelope(samples, sampleRate));
}
