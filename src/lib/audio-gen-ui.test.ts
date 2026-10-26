import { describe, expect, it } from 'vitest';
import {
  canGenerate,
  clampGenForm,
  genFormToAudioSettings,
  genValidationMessage,
  validateGenText,
  GEN_DEFAULTS,
  GEN_LIMITS,
} from './audio-gen-ui';

describe('generator form model', () => {
  it('clamps speed via the shared clampSpeed (farnsworth cannot exceed speed)', () => {
    const form = clampGenForm({ ...GEN_DEFAULTS, wpm: 99, farnsworthWpm: 99 });
    expect(form.wpm).toBe(GEN_LIMITS.wpm.max);
    expect(form.farnsworthWpm).toBe(GEN_LIMITS.wpm.max);
    const low = clampGenForm({ ...GEN_DEFAULTS, wpm: 1, farnsworthWpm: 1 });
    expect(low.wpm).toBe(GEN_LIMITS.wpm.min);
  });

  it('clamps frequency and volume to the control ranges', () => {
    const form = clampGenForm({ ...GEN_DEFAULTS, frequency: 5000, volume: 2 });
    expect(form.frequency).toBe(GEN_LIMITS.frequency.max);
    expect(form.volume).toBe(1);
    const low = clampGenForm({ ...GEN_DEFAULTS, frequency: 10, volume: -1 });
    expect(low.frequency).toBe(GEN_LIMITS.frequency.min);
    expect(low.volume).toBe(0);
  });

  it('maps to the player AudioSettings shape (repeat/flash/vibration off)', () => {
    const settings = genFormToAudioSettings({ ...GEN_DEFAULTS, text: 'SOS' });
    expect(settings).toMatchObject({
      wpm: 20,
      farnsworthWpm: 20,
      frequency: 700,
      volume: 0.5,
      soundType: 'cw',
      waveform: 'sine',
      repeat: false,
      flash: false,
      vibration: false,
    });
  });
});

describe('generator validation', () => {
  it('rejects empty and whitespace-only text', () => {
    expect(validateGenText('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateGenText('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(canGenerate({ ...GEN_DEFAULTS, text: '' })).toBe(false);
  });

  it('rejects text with no encodable characters', () => {
    expect(validateGenText('🙂🙂')).toEqual({ ok: false, reason: 'unsupported' });
    expect(canGenerate({ ...GEN_DEFAULTS, text: '🙂' })).toBe(false);
    expect(genValidationMessage('unsupported')).toContain('Morse');
  });

  it('accepts plain text', () => {
    expect(validateGenText('SOS')).toEqual({ ok: true });
    expect(validateGenText('abc 123 .,?!')).toEqual({ ok: true });
    expect(canGenerate({ ...GEN_DEFAULTS, text: 'SOS' })).toBe(true);
  });
});

describe('parity with homepage modules (duplicated by design)', () => {
  it('ENCODABLE_CHAR covers every character MORSE_ALPHABET can encode', async () => {
    const { MORSE_ALPHABET } = await import('./morse');
    const { validateGenText } = await import('./audio-gen-ui');
    for (const entry of MORSE_ALPHABET) {
      expect(validateGenText(entry.char).ok, `char ${entry.char}`).toBe(true);
    }
  });

  it('clampSpeedLocal matches clampSpeed across the range', async () => {
    const { clampSpeed } = await import('./morse-audio');
    const { clampGenForm, GEN_DEFAULTS } = await import('./audio-gen-ui');
    for (const wpm of [0, 5, 12, 20, 33, 40, 99, NaN]) {
      for (const fs of [0, 5, 12, 20, 60, NaN]) {
        const expected = clampSpeed(wpm, fs);
        const actual = clampGenForm({ ...GEN_DEFAULTS, wpm, farnsworthWpm: fs });
        expect([actual.wpm, actual.farnsworthWpm]).toEqual([expected.wpm, expected.farnsworthWpm]);
      }
    }
  });
});
