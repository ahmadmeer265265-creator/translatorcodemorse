/**
 * Form model for the Text to Audio mode of /morse-code-audio-translator/.
 * Pure and DOM-free. All synthesis/playback math stays in the homepage's
 * tested modules (morse-audio.ts, morse-player.ts) — this maps form state
 * into their AudioSettings shape and validates input.
 */
import type { SoundType, Waveform } from './morse-audio';
import type { AudioSettings } from './morse-player';

/**
 * Characters the canonical Morse map can encode (mirrors MORSE_ALPHABET's
 * coverage). Kept as a local constant — NOT a static morse.ts import — so
 * this page's entry script never re-homes homepage modules into shared
 * chunks. audio-gen-ui.test.ts asserts parity against MORSE_ALPHABET.
 */
const ENCODABLE_CHAR = /[A-Za-z0-9.,?'!()\/:;=+\-_"$@&]/;

/**
 * Local mirror of morse-audio.ts's clampSpeed (same 5–40 range and
 * farnsworth ≤ speed rule). Duplicated deliberately: a static import would
 * drag morse-audio into this page's eager graph and reshuffle the homepage's
 * chunk split. Parity asserted in tests.
 */
function clampSpeedLocal(wpm: number, farnsworthWpm?: number): { wpm: number; farnsworthWpm: number } {
  const clamp = (value: number, min: number, max: number) =>
    !Number.isFinite(value) ? min : Math.min(max, Math.max(min, value));
  const speed = clamp(wpm, 5, 40);
  const raw = farnsworthWpm === undefined || !Number.isFinite(farnsworthWpm) ? speed : farnsworthWpm;
  return { wpm: speed, farnsworthWpm: clamp(raw, 5, speed) };
}

export type GenFormState = {
  text: string;
  wpm: number;
  farnsworthWpm: number;
  frequency: number;
  /** 0–1 */
  volume: number;
  soundType: SoundType;
  waveform: Waveform;
};

export const GEN_DEFAULTS: GenFormState = {
  text: '',
  wpm: 20,
  farnsworthWpm: 20,
  frequency: 700,
  volume: 0.5,
  soundType: 'cw',
  waveform: 'sine',
};

export const GEN_LIMITS = {
  wpm: { min: 5, max: 40 },
  frequency: { min: 400, max: 1000 },
  volume: { min: 0, max: 1 },
} as const;

/** Download formats this page offers. */
export type GenDownloadFormat = 'wav' | 'mp3';

export function clampGenForm(form: GenFormState): GenFormState {
  const { wpm, farnsworthWpm } = clampSpeedLocal(form.wpm, form.farnsworthWpm);
  const frequency = Math.min(
    GEN_LIMITS.frequency.max,
    Math.max(GEN_LIMITS.frequency.min, Math.round(form.frequency)),
  );
  const volume = Math.min(GEN_LIMITS.volume.max, Math.max(GEN_LIMITS.volume.min, form.volume));
  return { ...form, wpm, farnsworthWpm, frequency, volume };
}

/** Map the clamped form to the player/WAV settings shape. */
export function genFormToAudioSettings(form: GenFormState): AudioSettings {
  const clamped = clampGenForm(form);
  return {
    wpm: clamped.wpm,
    farnsworthWpm: clamped.farnsworthWpm,
    frequency: clamped.frequency,
    volume: clamped.volume,
    soundType: clamped.soundType,
    waveform: clamped.waveform,
    repeat: false,
    flash: false,
    vibration: false,
  };
}

export type GenValidation = { ok: true } | { ok: false; reason: 'empty' | 'unsupported' };

/**
 * Validate input text for generation: it must contain at least one
 * encodable character. The actual Morse string is produced lazily by the
 * player/encoder path (morse.ts is imported dynamically there), so this
 * stays a cheap synchronous enablement check.
 */
export function validateGenText(text: string): GenValidation {
  if (text.trim().length === 0) return { ok: false, reason: 'empty' };
  if (!ENCODABLE_CHAR.test(text)) return { ok: false, reason: 'unsupported' };
  return { ok: true };
}

/** Button enablement: Play/Download only make sense with encodable text. */
export function canGenerate(form: GenFormState): boolean {
  return validateGenText(form.text).ok;
}

export function genValidationMessage(reason: 'empty' | 'unsupported'): string {
  return reason === 'empty'
    ? 'Type some text first.'
    : 'None of those characters can be turned into Morse code. Try letters, numbers, or punctuation.';
}
