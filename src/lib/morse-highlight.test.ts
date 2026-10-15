import { describe, expect, it } from 'vitest';
import { parseMorseGroups, renderHighlightedHtml, textLetterSpans } from './morse-highlight';
import { decode } from './morse';

describe('parseMorseGroups', () => {
  it('maps SOS groups to Morse and text UTF-16 offsets', () => {
    const morse = '... --- ...';
    const groups = parseMorseGroups(morse);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ code: '...', char: 'S', morseStart: 0, morseEnd: 3, textStart: 0, textEnd: 1 });
    expect(groups[1]).toMatchObject({ code: '---', char: 'O', textStart: 1, textEnd: 2 });
    expect(groups[2]).toMatchObject({ code: '...', char: 'S', textStart: 2, textEnd: 3 });
    expect(decode(morse).output).toBe('SOS');
  });

  it('handles slash word breaks, three spaces, line breaks, and #', () => {
    const withSlash = parseMorseGroups('.- / -...');
    expect(withSlash.map((g) => g.char).join('')).toBe('AB');
    expect(withSlash[1]!.textStart).toBe(2);

    const withSpaces = parseMorseGroups('.-   -...');
    expect(withSpaces.map((g) => g.char).join('')).toBe('AB');

    const withHash = parseMorseGroups('.... .. #');
    expect(withHash.map((g) => g.char)).toEqual(['H', 'I', '#']);
  });

  it('normalizes lookalike marks', () => {
    expect(parseMorseGroups('···').map((g) => g.char)).toEqual(['S']);
  });
});

describe('textLetterSpans', () => {
  it('counts emoji as one code point with UTF-16 offsets', () => {
    const spans = textLetterSpans('Hi😀');
    expect(spans).toHaveLength(3);
    expect(spans[2]).toEqual({ start: 2, end: 4 });
  });
});

describe('renderHighlightedHtml', () => {
  it('wraps the active span in mark', () => {
    expect(renderHighlightedHtml('SOS', 1, 2)).toBe('S<mark>O</mark>S');
    expect(renderHighlightedHtml('A&B', 1, 2)).toBe('A<mark>&amp;</mark>B');
  });
});
