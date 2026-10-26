/**
 * UI state + configuration model for the Audio Decoder mode of
 * /morse-code-audio-translator/. Pure and DOM-free so the component layer
 * stays a thin wiring shell and every transition is unit-testable.
 *
 * Decode math is NOT here — this module only maps form state to the Stage 1
 * engine options (audio-decode-file.ts) and models the panel's states.
 */
import type { DecodeAudioOptions } from './audio-decode-file';

export type DecoderSource = 'mic' | 'file';

/** Panel lifecycle: idle -> listening/decoding -> result, or -> error. */
export type DecoderUiState = 'idle' | 'listening' | 'decoding' | 'result' | 'error';

export type DecoderEvent =
  | { type: 'start' }
  | { type: 'first-letter' }
  | { type: 'finish'; hasText: boolean }
  | { type: 'fail' }
  | { type: 'reset' };

/** State machine for the decoder panel (source-agnostic). */
export function reduceDecoderState(state: DecoderUiState, event: DecoderEvent): DecoderUiState {
  if (event.type === 'reset') return 'idle';
  switch (state) {
    case 'idle':
      if (event.type === 'start') return 'listening';
      if (event.type === 'fail') return 'error';
      return state;
    case 'listening':
      if (event.type === 'first-letter') return 'decoding';
      if (event.type === 'finish') return event.hasText ? 'result' : 'idle';
      if (event.type === 'fail') return 'error';
      return state;
    case 'decoding':
      if (event.type === 'finish') return event.hasText ? 'result' : 'idle';
      if (event.type === 'fail') return 'error';
      return state;
    case 'result':
      if (event.type === 'start') return 'listening';
      if (event.type === 'fail') return 'error';
      return state;
    case 'error':
      if (event.type === 'start') return 'listening';
      return state;
  }
}

export type DecoderConfig = {
  /** Manual speed. Empty/undefined = adaptive auto. */
  wpmRate?: number;
  /** Manual Farnsworth overall speed (only meaningful with wpmRate). */
  farnsworthWpm?: number;
  /** Manual tone frequency; ignored while automaticFrequencyTracking is on. */
  frequencyHz?: number;
  /** Band-pass Q around the effective frequency. */
  filterQ: number;
  /** Manual envelope floor/peak overrides (dBFS). */
  minVolumeDb?: number;
  maxVolumeDb?: number;
  /** When true, frequency is auto-detected and the Freq input is disabled. */
  automaticFrequencyTracking: boolean;
};

export const DECODER_CONFIG_DEFAULTS: DecoderConfig = {
  wpmRate: undefined,
  farnsworthWpm: undefined,
  frequencyHz: undefined,
  filterQ: 8,
  minVolumeDb: undefined,
  maxVolumeDb: undefined,
  automaticFrequencyTracking: true,
};

export const DECODER_LIMITS = {
  wpmRate: { min: 5, max: 40 },
  farnsworthWpm: { min: 5, max: 40 },
  frequencyHz: { min: 200, max: 1500 },
  filterQ: { min: 1, max: 30 },
  volumeDb: { min: -90, max: 0 },
} as const;

function clampOpt(value: number | undefined, min: number, max: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

/**
 * Map the form model to Stage 1 engine options. Empty fields are omitted so
 * the engine's auto-detection runs. automaticFrequencyTracking:true always
 * drops frequencyHz, matching the engine's override contract.
 */
export function configToDecodeOptions(config: DecoderConfig): DecodeAudioOptions {
  const wpmRate = clampOpt(config.wpmRate, DECODER_LIMITS.wpmRate.min, DECODER_LIMITS.wpmRate.max);
  const options: DecodeAudioOptions = {
    automaticFrequencyTracking: config.automaticFrequencyTracking,
    filterQ: Math.min(DECODER_LIMITS.filterQ.max, Math.max(DECODER_LIMITS.filterQ.min, config.filterQ)),
    minVolumeDb: clampOpt(config.minVolumeDb, DECODER_LIMITS.volumeDb.min, DECODER_LIMITS.volumeDb.max),
    maxVolumeDb: clampOpt(config.maxVolumeDb, DECODER_LIMITS.volumeDb.min, DECODER_LIMITS.volumeDb.max),
    wpmRate,
  };
  if (wpmRate !== undefined) {
    options.farnsworthWpm = clampOpt(config.farnsworthWpm, DECODER_LIMITS.farnsworthWpm.min, wpmRate);
  }
  if (!config.automaticFrequencyTracking) {
    options.frequencyHz = clampOpt(
      config.frequencyHz,
      DECODER_LIMITS.frequencyHz.min,
      DECODER_LIMITS.frequencyHz.max,
    );
  }
  return options;
}

/** Whether the manual Freq input should be editable (AFT off). */
export function frequencyInputEnabled(config: DecoderConfig): boolean {
  return !config.automaticFrequencyTracking;
}

export type MicErrorKind = 'denied' | 'insecure' | 'unsupported' | 'no-device' | 'busy' | 'unknown';

/** Honest, specific microphone error text — no generic "something failed". */
export function micErrorMessage(kind: MicErrorKind): string {
  switch (kind) {
    case 'denied':
      return 'Microphone access was denied. Allow microphone access for this site in your browser’s site settings, then press Listen again.';
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

/** Map a getUserMedia rejection name to a specific error kind. */
export function micErrorKind(errorName: string): MicErrorKind {
  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') return 'denied';
  if (errorName === 'NotFoundError' || errorName === 'OverconstrainedError') return 'no-device';
  if (errorName === 'NotReadableError' || errorName === 'AbortError') return 'busy';
  return 'unknown';
}

export const AUDIO_FILE_EXTENSIONS = ['.wav', '.mp3', '.ogg'] as const;
export const AUDIO_FILE_ACCEPT = '.wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg';

/** Filename check for the upload control (extension-based, case-insensitive). */
export function isAudioFileName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return AUDIO_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Upload error text: wrong type vs unreadable content. */
export function fileErrorMessage(reason: 'type' | 'decode', fileName: string): string {
  if (reason === 'type') {
    return `“${fileName}” is not a supported audio file. Choose a .wav, .mp3, or .ogg file.`;
  }
  return `Could not decode “${fileName}”. The file may be corrupt or use a codec this browser cannot read — try a .wav, .mp3, or .ogg export.`;
}

/** Human label for the current panel state (status line + tests). */
export function decoderStateLabel(state: DecoderUiState): string {
  switch (state) {
    case 'idle':
      return 'Choose a sound source to begin';
    case 'listening':
      return 'Listening…';
    case 'decoding':
      return 'Decoding…';
    case 'result':
      return 'Translation ready';
    case 'error':
      return 'Something needs attention';
  }
}
