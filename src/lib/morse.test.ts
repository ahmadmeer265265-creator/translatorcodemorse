import { describe, expect, it } from 'vitest';
import { buildTimeline } from './morse-audio';
import { MORSE_ALPHABET, decode, encode } from './morse';

describe('encode', () => {
  it('encodes SOS', () => {
    expect(encode('SOS').output).toBe('... --- ...');
    expect(encode('SOS').unsupported).toEqual([]);
  });

  it('encodes HELLO WORLD with a slash between words', () => {
    expect(encode('HELLO WORLD').output).toBe('.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  });

  it('encodes with three spaces when slash is off', () => {
    expect(encode('HELLO WORLD', { wordSeparator: '   ' }).output).toBe(
      '.... . .-.. .-.. ---   .-- --- .-. .-.. -..',
    );
  });

  it('encodes digits', () => {
    expect(encode('109').output).toBe('.---- ----- ----.');
  });

  it('encodes punctuation', () => {
    expect(encode('OK?').output).toBe('--- -.- ..--..');
    expect(encode('A/B').output).toBe('.- -..-. -...');
    expect(encode('1+1=2').output).toBe('.---- .-.-. .---- -...- ..---');
  });

  it('treats mixed case like uppercase', () => {
    expect(encode('Hello World').output).toBe(encode('HELLO WORLD').output);
  });

  it('collapses multiple spaces into one word gap', () => {
    expect(encode('SOS  SOS').output).toBe('... --- ... / ... --- ...');
  });

  it('preserves line breaks', () => {
    expect(encode('A\nB').output).toBe('.-' + '\n' + '-...');
  });

  it('returns an empty result for empty input', () => {
    expect(encode('')).toEqual({ output: '', unsupported: [] });
    expect(encode('   ')).toEqual({ output: '', unsupported: [] });
  });

  it('places # for unsupported characters and lists them', () => {
    const result = encode('SOS😀');
    expect(result.output).toBe('... --- ... #');
    expect(result.unsupported).toEqual(['😀']);
  });

  it('places one # per code point including accented letters', () => {
    const result = encode('café');
    expect(result.output).toBe('-.-. .- ..-. #');
    expect(result.unsupported).toEqual(['é']);
  });
});

describe('decode', () => {
  it('decodes SOS', () => {
    expect(decode('... --- ...')).toEqual({ output: 'SOS', unknown: 0 });
  });

  it('decodes a slash or a pipe as a word break', () => {
    expect(decode('.... . .-.. .-.. --- / .-- --- .-. .-.. -..').output).toBe('HELLO WORLD');
    expect(decode('.... . | .').output).toBe('HE E');
  });

  it('treats three or more spaces as a word break', () => {
    expect(decode('... --- ...   ... --- ...').output).toBe('SOS SOS');
  });

  it('normalizes unicode dots and dashes', () => {
    expect(decode('··· ——— ···').output).toBe('SOS');
    expect(decode('•–').output).toBe('A');
    expect(decode('−').output).toBe('T');
  });

  it('ignores leading and trailing whitespace', () => {
    expect(decode('   ... --- ...   ').output).toBe('SOS');
  });

  it('replaces unknown sequences with # and counts them', () => {
    expect(decode('........')).toEqual({ output: '#', unknown: 1 });
    expect(decode('.- ........')).toEqual({ output: 'A#', unknown: 1 });
  });

  it('decodes a literal # group to #', () => {
    expect(decode('#')).toEqual({ output: '#', unknown: 0 });
    expect(decode('... --- ... #')).toEqual({ output: 'SOS#', unknown: 0 });
  });

  it('returns an empty result for empty input', () => {
    expect(decode('')).toEqual({ output: '', unknown: 0 });
    expect(decode('  \n  ')).toEqual({ output: '', unknown: 0 });
  });
});

describe('round trip', () => {
  it('recovers uppercase text from Morse', () => {
    const samples = ['SOS', 'HELLO WORLD', '109', 'OK?', 'A/B', '1+1=2', 'AT @ HOME'];
    for (const sample of samples) {
      expect(decode(encode(sample).output).output).toBe(sample);
    }
  });

  it('turns emoji into # on a round trip', () => {
    expect(decode(encode('Hi😀').output).output).toBe('HI#');
  });

  it('uses a unique Morse pattern for every character', () => {
    const codes = MORSE_ALPHABET.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('audio timeline skips #', () => {
  it('ignores # groups when building a timeline', () => {
    const withHash = buildTimeline('... --- ... #', { wpm: 20 });
    const without = buildTimeline('... --- ...', { wpm: 20 });
    expect(withHash).toEqual(without);
  });
});
