import { describe, expect, it } from 'vitest';
import { decode, encode, MORSE_ALPHABET } from './morse';
import { morseStringToEvents, tapPressesToEvents } from './morse-key-events';
import { LETTER_GAP_MS } from './tap-timing';
import {
  generateListenAndGuess,
  LISTEN_AND_GUESS_CHARACTERS,
  LISTEN_AND_GUESS_WORDS,
  scoreMorseTheLetter,
} from './morse-machine-practice';
import { runIambicScript, iambicUnitMs } from './iambic-keyer';

describe('generateListenAndGuess', () => {
  it('returns a single International Morse character at character difficulty', () => {
    const prompt = generateListenAndGuess('character', () => 0);
    expect(prompt.difficulty).toBe('character');
    expect(prompt.text).toBe(LISTEN_AND_GUESS_CHARACTERS[0]);
    expect(prompt.text).toHaveLength(1);
    expect(prompt.morse).toBe(encode(prompt.text).output);
    expect(decode(prompt.morse).output).toBe(prompt.text);
    expect(prompt.group === 'letter' || prompt.group === 'digit').toBe(true);
  });

  it('returns a short beginner word at word difficulty', () => {
    const prompt = generateListenAndGuess('word', () => 0);
    expect(prompt.difficulty).toBe('word');
    expect(prompt.text).toBe(LISTEN_AND_GUESS_WORDS[0]);
    expect(prompt.group).toBe('word');
    expect(prompt.morse).toBe(encode(prompt.text).output);
    expect(decode(prompt.morse).output).toBe(prompt.text);
  });

  it('covers every built-in character and word with a valid homepage round trip', () => {
    for (const char of LISTEN_AND_GUESS_CHARACTERS) {
      const encoded = encode(char);
      expect(encoded.unsupported).toEqual([]);
      expect(decode(encoded.output).output).toBe(char);
    }
    for (const word of LISTEN_AND_GUESS_WORDS) {
      expect(word.length).toBeGreaterThanOrEqual(2);
      expect(word.length).toBeLessThanOrEqual(4);
      const encoded = encode(word);
      expect(encoded.unsupported).toEqual([]);
      expect(decode(encoded.output).output).toBe(word);
    }
    expect(LISTEN_AND_GUESS_CHARACTERS).toEqual(
      MORSE_ALPHABET.filter((entry) => entry.group === 'letter' || entry.group === 'digit').map(
        (entry) => entry.char,
      ),
    );
  });

  it('only ever returns items from the built-in lists', () => {
    const chars = new Set<string>();
    const words = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      chars.add(generateListenAndGuess('character', () => i / 500).text);
      words.add(generateListenAndGuess('word', () => i / 500).text);
    }
    for (const char of chars) expect(LISTEN_AND_GUESS_CHARACTERS).toContain(char);
    for (const word of words) expect(LISTEN_AND_GUESS_WORDS).toContain(word);
    expect(chars.size).toBe(LISTEN_AND_GUESS_CHARACTERS.length);
    expect(words.size).toBe(LISTEN_AND_GUESS_WORDS.length);
  });

  it('clamps a random() of 1 to the last list item', () => {
    expect(generateListenAndGuess('character', () => 1).text).toBe(
      LISTEN_AND_GUESS_CHARACTERS[LISTEN_AND_GUESS_CHARACTERS.length - 1],
    );
    expect(generateListenAndGuess('word', () => 1).text).toBe(
      LISTEN_AND_GUESS_WORDS[LISTEN_AND_GUESS_WORDS.length - 1],
    );
  });
});

describe('scoreMorseTheLetter', () => {
  it('scores a correct letter from a Morse event stream', () => {
    const score = scoreMorseTheLetter('K', morseStringToEvents('-.-'));
    expect(score).toMatchObject({
      target: 'K',
      sent: 'K',
      sentMorse: '-.-',
      match: true,
      mismatches: [],
    });
  });

  it('is case-insensitive and trims the target', () => {
    const score = scoreMorseTheLetter('  sos  ', morseStringToEvents(encode('SOS').output));
    expect(score.match).toBe(true);
    expect(score.target).toBe('SOS');
    expect(score.sent).toBe('SOS');
  });

  it('names the wrong character when the sent letter does not match', () => {
    const score = scoreMorseTheLetter('K', morseStringToEvents('.-'));
    expect(score.match).toBe(false);
    expect(score.sent).toBe('A');
    expect(score.mismatches).toEqual([{ index: 0, expected: 'K', actual: 'A' }]);
  });

  it('names every wrong character in a short word', () => {
    const score = scoreMorseTheLetter('CAT', morseStringToEvents(encode('COT').output));
    expect(score.match).toBe(false);
    expect(score.sent).toBe('COT');
    expect(score.mismatches).toEqual([{ index: 1, expected: 'A', actual: 'O' }]);
  });

  it('reports missing and extra characters', () => {
    const missing = scoreMorseTheLetter('HI', morseStringToEvents(encode('H').output));
    expect(missing.mismatches).toEqual([{ index: 1, expected: 'I', actual: '' }]);

    const extra = scoreMorseTheLetter('HI', morseStringToEvents(encode('HIT').output));
    expect(extra.mismatches).toEqual([{ index: 2, expected: '', actual: 'T' }]);
  });

  it('does not treat an empty send of an empty target as a pass', () => {
    const score = scoreMorseTheLetter('', []);
    expect(score.match).toBe(false);
    expect(score.sent).toBe('');
    expect(score.mismatches).toEqual([]);
  });

  it('scores a correct letter keyed on the homepage tap timing rules', () => {
    const events = tapPressesToEvents([
      { durationMs: 250, gapAfterMs: 40 },
      { durationMs: 50, gapAfterMs: 40 },
      { durationMs: 250, gapAfterMs: LETTER_GAP_MS },
    ]);
    const score = scoreMorseTheLetter('K', events);
    expect(score.match).toBe(true);
    expect(score.sent).toBe('K');
  });

  it('scores a correct letter keyed with the iambic paddle', () => {
    const unit = iambicUnitMs(20);
    const events = runIambicScript(
      [
        { t: 0, action: 'set', dot: true, dash: true },
        { t: 2 * unit, action: 'set', dot: false, dash: false },
      ],
      { wpm: 20, until: 8 * unit },
    );
    const score = scoreMorseTheLetter('A', events);
    expect(score.match).toBe(true);
    expect(score.sent).toBe('A');
    expect(score.sentMorse).toBe('.-');
  });

  it('flags unknown Morse as # against the target letter', () => {
    const score = scoreMorseTheLetter('E', morseStringToEvents('......'));
    expect(score.match).toBe(false);
    expect(score.sent).toBe('#');
    expect(score.mismatches).toEqual([{ index: 0, expected: 'E', actual: '#' }]);
  });
});
