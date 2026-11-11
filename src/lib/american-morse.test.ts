import { describe, expect, it } from 'vitest';
import {
  AMERICAN_MORSE_ALPHABET,
  AMERICAN_MORSE_TABLE_NOTES,
  CLOSE_QUOTE,
  EXTRA_LONG_DASH,
  EXTRA_LONG_DASH_UNICODE,
  LONG_DASH,
  LONG_DASH_UNICODE,
  decode,
  encode,
} from './american-morse';

const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  ['A', '.-'],
  ['B', '-...'],
  ['C', '.. .'],
  ['D', '-..'],
  ['E', '.'],
  ['F', '.-.'],
  ['G', '--.'],
  ['H', '....'],
  ['I', '..'],
  ['J', '-.-.'],
  ['K', '-.-'],
  ['L', LONG_DASH],
  ['M', '--'],
  ['N', '-.'],
  ['O', '. .'],
  ['P', '.....'],
  ['Q', '..-.'],
  ['R', '. ..'],
  ['S', '...'],
  ['T', '-'],
  ['U', '..-'],
  ['V', '...-'],
  ['W', '.--'],
  ['X', '.-..'],
  ['Y', '.. ..'],
  ['Z', '... .'],
  ['0', EXTRA_LONG_DASH],
  ['1', '.--.'],
  ['2', '..-..'],
  ['3', '...-.'],
  ['4', '....-'],
  ['5', '---'],
  ['6', '......'],
  ['7', '--..'],
  ['8', '-....'],
  ['9', '-..-'],
  ['.', '..--..'],
  [',', '.-.-'],
  ['?', '-..-.'],
  ['!', '---.'],
  ['/', '..--'],
  ['-', '.......-..'],
  ['&', '. ...'],
  [':', '-.-..'],
  [';', '... ..'],
  ["'", '..-..-..'],
  ['(', '.....-.'],
  [')', '.........'],
  ['"', '..-.-.'],
  [CLOSE_QUOTE, '..-.-.-.'],
];

describe('American Morse table', () => {
  it('lists the notation conflicts instead of hiding them', () => {
    expect(AMERICAN_MORSE_TABLE_NOTES.length).toBeGreaterThan(0);
    expect(AMERICAN_MORSE_TABLE_NOTES.some((note) => note.includes('semicolon'))).toBe(true);
    expect(AMERICAN_MORSE_TABLE_NOTES.some((note) => note.includes('ampersand'))).toBe(true);
  });

  it('keeps every alphabet code unique so decode is deterministic', () => {
    const codes = AMERICAN_MORSE_ALPHABET.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('encode / decode round-trip', () => {
  it.each(EXPECTED)('round-trips %s as %s', (char, code) => {
    expect(encode(char).output).toBe(code);
    expect(encode(char).unsupported).toEqual([]);
    expect(decode(code)).toEqual({ output: char, unknown: 0 });
  });

  it('round-trips the whole alphabet as one word', () => {
    const text = EXPECTED.map(([char]) => char).join('');
    const morse = EXPECTED.map(([, code]) => code).join('/');
    expect(encode(text).output).toBe(morse);
    expect(decode(morse).output).toBe(text);
  });
});

describe('internal-gap letters vs adjacent letters', () => {
  it('does not read C, O, R, Y, Z, or & as two letters', () => {
    expect(decode('.. .').output).toBe('C');
    expect(decode('. .').output).toBe('O');
    expect(decode('. ..').output).toBe('R');
    expect(decode('.. ..').output).toBe('Y');
    expect(decode('... .').output).toBe('Z');
    expect(decode('. ...').output).toBe('&');
  });

  it('still reads the genuine two-letter strings that share the same marks', () => {
    expect(encode('IE').output).toBe('../.');
    expect(decode('../.').output).toBe('IE');
    expect(encode('EE').output).toBe('./.');
    expect(decode('./.').output).toBe('EE');
    expect(encode('EI').output).toBe('./..');
    expect(decode('./..').output).toBe('EI');
    expect(encode('II').output).toBe('../..');
    expect(decode('../..').output).toBe('II');
    expect(encode('SE').output).toBe('.../.');
    expect(decode('.../.').output).toBe('SE');
    expect(encode('ES').output).toBe('./...');
    expect(decode('./...').output).toBe('ES');
  });

  it('keeps HOME and HOG apart (hog-Morse)', () => {
    expect(encode('HOME').output).toBe('..../. ./--/.');
    expect(encode('HOG').output).toBe('..../. ./--.');
    expect(decode(encode('HOME').output).output).toBe('HOME');
    expect(decode(encode('HOG').output).output).toBe('HOG');
    expect(encode('HOME').output).not.toBe(encode('HOG').output);
  });
});

describe('long dash and extra-long dash tokens', () => {
  it('encodes L as = and 0 as _', () => {
    expect(encode('L').output).toBe('=');
    expect(encode('0').output).toBe('_');
    expect(encode('L0').output).toBe('=/_');
  });

  it('accepts Wikipedia ⸺ / ⸻ on decode', () => {
    expect(decode(LONG_DASH_UNICODE).output).toBe('L');
    expect(decode(EXTRA_LONG_DASH_UNICODE).output).toBe('0');
    expect(decode(`${LONG_DASH_UNICODE}/${EXTRA_LONG_DASH_UNICODE}`).output).toBe('L0');
  });
});

describe('edge cases', () => {
  it('returns empty results for empty or whitespace input', () => {
    expect(encode('')).toEqual({ output: '', unsupported: [] });
    expect(encode('   ')).toEqual({ output: '', unsupported: [] });
    expect(decode('')).toEqual({ output: '', unknown: 0 });
    expect(decode('  \n  ')).toEqual({ output: '', unknown: 0 });
  });

  it('encodes unmappable characters as # and lists them', () => {
    const result = encode('OK😀');
    expect(result.output).toBe('. ./-.-/#');
    expect(result.unsupported).toEqual(['😀']);
    expect(decode(result.output).output).toBe('OK#');
  });

  it('treats mixed case like uppercase', () => {
    expect(encode('Hello World').output).toBe(encode('HELLO WORLD').output);
    expect(decode(encode('Hello World').output).output).toBe('HELLO WORLD');
  });

  it('collapses extra whitespace in typed Morse and around slashes', () => {
    expect(decode('  .. .  /  -.  //  ...  ').output).toBe('CN S');
    expect(decode('..  .').output).toBe('C');
  });

  it('collapses multiple word spaces on encode', () => {
    expect(encode('SOS  SOS').output).toBe('.../. ./...//.../. ./...');
  });

  it('preserves line breaks', () => {
    expect(encode('A\nB').output).toBe('.-\n-...');
    expect(decode('.-\n-...').output).toBe('A\nB');
  });

  it('round-trips trailing punctuation', () => {
    expect(decode(encode('OK?').output).output).toBe('OK?');
    expect(decode(encode('WAIT.').output).output).toBe('WAIT.');
    expect(decode(encode("DON'T").output).output).toBe("DON'T");
  });

  it('decodes a literal # group to # without counting it unknown', () => {
    expect(decode('#')).toEqual({ output: '#', unknown: 0 });
    expect(decode('.-/#').output).toBe('A#');
  });

  it('counts truly unknown Morse groups', () => {
    expect(decode('.-.-.-')).toEqual({ output: '#', unknown: 1 });
  });

  it('encodes curly open quote as the open-quote sequence', () => {
    expect(encode('\u201C').output).toBe('..-.-.');
    expect(decode('..-.-.').output).toBe('"');
  });
});
