import { describe, expect, it } from 'vitest';
import { decode, encode } from './morse';
import {
  classifyTapGap,
  classifyTapMark,
  eventsToMorse,
  eventsToText,
  morseStringToEvents,
  tapPressesToEvents,
} from './morse-key-events';
import { DOT_MAX_MS, LETTER_GAP_MS, WORD_GAP_MS, runTapSequence } from './tap-timing';

describe('classifyTapMark', () => {
  it('treats a press shorter than 200ms as a dot', () => {
    expect(classifyTapMark(0)).toBe('.');
    expect(classifyTapMark(1)).toBe('.');
    expect(classifyTapMark(DOT_MAX_MS - 1)).toBe('.');
  });

  it('treats 200ms and slower holds as a dash', () => {
    expect(classifyTapMark(DOT_MAX_MS)).toBe('-');
    expect(classifyTapMark(5_000)).toBe('-');
    expect(classifyTapMark(1_000_000)).toBe('-');
  });

  it('treats a negative duration as a dot (same < 200 rule as the homepage pad)', () => {
    expect(classifyTapMark(-1)).toBe('.');
  });
});

describe('classifyTapGap', () => {
  it('keeps sub-letter pauses as element gaps', () => {
    expect(classifyTapGap(0)).toBe('element');
    expect(classifyTapGap(1)).toBe('element');
    expect(classifyTapGap(LETTER_GAP_MS - 1)).toBe('element');
  });

  it('closes a letter at 800ms and a word at 2000ms', () => {
    expect(classifyTapGap(LETTER_GAP_MS)).toBe('letter');
    expect(classifyTapGap(1_500)).toBe('letter');
    expect(classifyTapGap(WORD_GAP_MS - 1)).toBe('letter');
    expect(classifyTapGap(WORD_GAP_MS)).toBe('word');
    expect(classifyTapGap(10_000)).toBe('word');
  });
});

describe('tapPressesToEvents', () => {
  it('matches the homepage tap engine on SOS', () => {
    const presses = [
      { durationMs: 50, gapAfterMs: 40 },
      { durationMs: 50, gapAfterMs: 40 },
      { durationMs: 50, gapAfterMs: LETTER_GAP_MS },
      { durationMs: 250, gapAfterMs: 40 },
      { durationMs: 250, gapAfterMs: 40 },
      { durationMs: 250, gapAfterMs: LETTER_GAP_MS },
      { durationMs: 50, gapAfterMs: 40 },
      { durationMs: 50, gapAfterMs: 40 },
      { durationMs: 50, gapAfterMs: LETTER_GAP_MS },
    ];
    const tap = runTapSequence(
      presses.map((press) => ({ pressMs: press.durationMs, gapAfterMs: press.gapAfterMs })),
    );
    const events = tapPressesToEvents(presses);
    expect(eventsToText(events).output).toBe(tap.text.trim());
    expect(eventsToMorse(events)).toBe(tap.morse);
  });

  it('matches the homepage tap engine on a very fast S (1ms dits, 1ms gaps)', () => {
    const presses = [
      { durationMs: 1, gapAfterMs: 1 },
      { durationMs: 1, gapAfterMs: 1 },
      { durationMs: 1, gapAfterMs: LETTER_GAP_MS },
    ];
    expect(
      runTapSequence(presses.map((press) => ({ pressMs: press.durationMs, gapAfterMs: press.gapAfterMs })))
        .text,
    ).toBe('S');
    expect(eventsToText(tapPressesToEvents(presses)).output).toBe('S');
  });

  it('matches the homepage tap engine on a very slow O (long dashes)', () => {
    const presses = [
      { durationMs: 5_000, gapAfterMs: 50 },
      { durationMs: 5_000, gapAfterMs: 50 },
      { durationMs: 5_000, gapAfterMs: LETTER_GAP_MS },
    ];
    expect(
      runTapSequence(presses.map((press) => ({ pressMs: press.durationMs, gapAfterMs: press.gapAfterMs })))
        .text,
    ).toBe('O');
    expect(eventsToText(tapPressesToEvents(presses)).output).toBe('O');
  });

  it('treats an 800ms gap as a letter break and a 2000ms gap as a word break', () => {
    const letter = tapPressesToEvents([
      { durationMs: 50, gapAfterMs: LETTER_GAP_MS },
      { durationMs: 250, gapAfterMs: LETTER_GAP_MS },
    ]);
    expect(eventsToText(letter).output).toBe('ET');

    const word = tapPressesToEvents([
      { durationMs: 50, gapAfterMs: WORD_GAP_MS },
      { durationMs: 250, gapAfterMs: LETTER_GAP_MS },
    ]);
    expect(eventsToText(word).output).toBe('E T');
    expect(eventsToMorse(word)).toBe('. / -');
  });

  it('inserts a word gap on an explicit word break', () => {
    const events = tapPressesToEvents([
      { durationMs: 50, gapAfterMs: 0 },
      { wordBreak: true },
      { durationMs: 250, gapAfterMs: 0 },
    ]);
    expect(eventsToText(events).output).toBe('E T');
  });
});

describe('morseStringToEvents', () => {
  it('round-trips through the homepage encode/decode engine', () => {
    const samples = ['SOS', 'HELLO WORLD', 'K', 'ET', '109'];
    for (const sample of samples) {
      const morse = encode(sample).output;
      const events = morseStringToEvents(morse);
      expect(eventsToMorse(events)).toBe(morse);
      expect(eventsToText(events).output).toBe(decode(morse).output);
    }
  });

  it('returns an empty stream for blank Morse', () => {
    expect(morseStringToEvents('')).toEqual([]);
    expect(morseStringToEvents('   ')).toEqual([]);
  });
});
