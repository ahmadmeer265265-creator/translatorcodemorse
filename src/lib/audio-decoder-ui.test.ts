import { describe, expect, it } from 'vitest';
import {
  configToDecodeOptions,
  decoderStateLabel,
  DECODER_CONFIG_DEFAULTS,
  fileErrorMessage,
  frequencyInputEnabled,
  isAudioFileName,
  micErrorKind,
  micErrorMessage,
  reduceDecoderState,
  type DecoderUiState,
} from './audio-decoder-ui';
import { decodeMorsePcm } from './audio-decode-file';
import { synthesizeMorsePcm } from './audio-synth';

describe('decoder state machine', () => {
  it('walks idle -> listening -> decoding -> result', () => {
    let s: DecoderUiState = 'idle';
    s = reduceDecoderState(s, { type: 'start' });
    expect(s).toBe('listening');
    s = reduceDecoderState(s, { type: 'first-letter' });
    expect(s).toBe('decoding');
    s = reduceDecoderState(s, { type: 'finish', hasText: true });
    expect(s).toBe('result');
    expect(decoderStateLabel(s)).toBe('Translation ready');
  });

  it('finish with no text returns to idle, not result', () => {
    let s = reduceDecoderState('listening', { type: 'finish', hasText: false });
    expect(s).toBe('idle');
    s = reduceDecoderState('decoding', { type: 'finish', hasText: false });
    expect(s).toBe('idle');
  });

  it('fail leads to error from active states, and start recovers', () => {
    expect(reduceDecoderState('listening', { type: 'fail' })).toBe('error');
    expect(reduceDecoderState('decoding', { type: 'fail' })).toBe('error');
    expect(reduceDecoderState('error', { type: 'start' })).toBe('listening');
  });

  it('reset always returns to idle', () => {
    for (const s of ['listening', 'decoding', 'result', 'error'] as const) {
      expect(reduceDecoderState(s, { type: 'reset' })).toBe('idle');
    }
  });
});

describe('config mapping to Stage 1 engine options', () => {
  it('defaults mean full auto-detection (fields omitted)', () => {
    const options = configToDecodeOptions(DECODER_CONFIG_DEFAULTS);
    expect(options.automaticFrequencyTracking).toBe(true);
    expect(options.frequencyHz).toBeUndefined();
    expect(options.wpmRate).toBeUndefined();
    expect(options.farnsworthWpm).toBeUndefined();
    expect(options.minVolumeDb).toBeUndefined();
    expect(options.maxVolumeDb).toBeUndefined();
    expect(options.filterQ).toBe(8);
  });

  it('automaticFrequencyTracking drops a manually entered frequency', () => {
    const options = configToDecodeOptions({
      ...DECODER_CONFIG_DEFAULTS,
      automaticFrequencyTracking: true,
      frequencyHz: 500,
    });
    expect(options.frequencyHz).toBeUndefined();
    const manual = configToDecodeOptions({
      ...DECODER_CONFIG_DEFAULTS,
      automaticFrequencyTracking: false,
      frequencyHz: 500,
    });
    expect(manual.frequencyHz).toBe(500);
    expect(manual.automaticFrequencyTracking).toBe(false);
  });

  it('clamps out-of-range values and only passes farnsworth with wpmRate', () => {
    const options = configToDecodeOptions({
      ...DECODER_CONFIG_DEFAULTS,
      wpmRate: 99,
      farnsworthWpm: 99,
      filterQ: 100,
    });
    expect(options.wpmRate).toBe(40);
    expect(options.farnsworthWpm).toBe(40);
    expect(options.filterQ).toBe(30);
    const noWpm = configToDecodeOptions({ ...DECODER_CONFIG_DEFAULTS, farnsworthWpm: 12 });
    expect(noWpm.farnsworthWpm).toBeUndefined();
  });

  it('mapped manual overrides actually steer the engine (integration)', () => {
    // 12 WPM audio decoded with the mapped 20 WPM override must differ from
    // the mapped auto defaults — the same contract Stage 1 proved, driven
    // through the UI config layer.
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 12, frequency: 700 });
    const auto = decodeMorsePcm({ channels: [pcm], sampleRate: 44100 }, configToDecodeOptions(DECODER_CONFIG_DEFAULTS));
    expect(auto.text).toBe('SOS');
    const manual = decodeMorsePcm(
      { channels: [pcm], sampleRate: 44100 },
      configToDecodeOptions({ ...DECODER_CONFIG_DEFAULTS, wpmRate: 20 }),
    );
    expect(manual.text).not.toBe('SOS');
  });

  it('frequencyInputEnabled mirrors the AFT checkbox', () => {
    expect(frequencyInputEnabled({ ...DECODER_CONFIG_DEFAULTS, automaticFrequencyTracking: true })).toBe(false);
    expect(frequencyInputEnabled({ ...DECODER_CONFIG_DEFAULTS, automaticFrequencyTracking: false })).toBe(true);
  });
});

describe('file + mic error handling', () => {
  it('accepts .wav/.mp3/.ogg case-insensitively, rejects others', () => {
    expect(isAudioFileName('clip.WAV')).toBe(true);
    expect(isAudioFileName('song.mp3')).toBe(true);
    expect(isAudioFileName('sound.ogg')).toBe(true);
    expect(isAudioFileName('notes.txt')).toBe(false);
    expect(isAudioFileName('archive.zip')).toBe(false);
  });

  it('file errors name the file and the actual problem', () => {
    expect(fileErrorMessage('type', 'a.txt')).toContain('.wav, .mp3, or .ogg');
    expect(fileErrorMessage('type', 'a.txt')).toContain('a.txt');
    expect(fileErrorMessage('decode', 'bad.wav')).toContain('bad.wav');
    expect(fileErrorMessage('decode', 'bad.wav')).toContain('corrupt');
  });

  it('mic errors are specific per failure kind', () => {
    expect(micErrorKind('NotAllowedError')).toBe('denied');
    expect(micErrorKind('NotFoundError')).toBe('no-device');
    expect(micErrorKind('NotReadableError')).toBe('busy');
    expect(micErrorKind('WeirdError')).toBe('unknown');
    expect(micErrorMessage('denied')).toContain('denied');
    expect(micErrorMessage('insecure')).toContain('https');
    expect(micErrorMessage('unsupported')).toContain('does not support');
    expect(micErrorMessage('no-device')).toContain('No microphone');
    expect(micErrorMessage('busy')).toContain('Another app');
  });
});
