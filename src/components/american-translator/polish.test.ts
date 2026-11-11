import { describe, expect, it } from 'vitest';
import { encode } from '../../lib/american-morse';
import { buildAmericanTimeline, cuesFor } from '../../lib/american-playback';
import {
  AMERICAN_EXAMPLES,
  clearedPair,
  cwToneSample,
  cwWaveformFor,
  dockFlashOn,
  examplePair,
  pickAmericanExample,
  textToCopy,
} from './polish';

describe('copy, clear, and random example', () => {
  it('copies the requested box, clears both, and encodes a fresh example', () => {
    const fields = { text: 'SOS', morse: encode('SOS').output };
    expect(textToCopy('text', fields)).toBe('SOS');
    expect(textToCopy('morse', fields)).toBe(fields.morse);
    expect(clearedPair()).toEqual({ text: '', morse: '' });
    const first = pickAmericanExample(() => 0);
    const next = pickAmericanExample(() => 0, first);
    expect(next).not.toBe(first);
    expect(AMERICAN_EXAMPLES).toContain(next);
    const pair = examplePair(next);
    expect(pair).toEqual({ text: next, morse: encode(next).output });
    expect(pair.morse.length).toBeGreaterThan(0);
  });
});

describe('waveform and dock flash', () => {
  const timeline = buildAmericanTimeline(encode('E').output, 15);

  it('square changes the CW sample and the sounder gets no waveform', () => {
    const angle = Math.PI / 5;
    expect(cwToneSample('square', angle)).not.toBeCloseTo(cwToneSample('sine', angle));
    expect(cwWaveformFor('cw', 'square')).toBe('square');
    expect(cwWaveformFor('cw', 'sine')).toBe('sine');
    expect(cwWaveformFor('cw', 'other')).toBe('sine');
    expect(cwWaveformFor('sounder', 'square')).toBeNull();
    expect(cuesFor('sounder', timeline).tones).toEqual([]);
  });

  it('pulses the dock border on CW marks only', () => {
    expect(dockFlashOn('cw', timeline, 1)).toBe(true);
    expect(dockFlashOn('cw', timeline, cuesFor('cw', timeline).tones[0]!.durationMs + 1)).toBe(false);
    expect(dockFlashOn('sounder', timeline, 1)).toBe(false);
  });
});
