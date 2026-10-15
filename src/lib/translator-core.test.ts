import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_PHRASES,
  HASH_MAX_LENGTH,
  buildPuzzleHash,
  buildShareHash,
  buildTxtFile,
  characterCountLabel,
  convertWordSeparators,
  countCharacters,
  countSignals,
  modeAnnouncement,
  parseTranslatorHash,
  pickRandomExample,
  signalCountLabel,
  swapMode,
  unsupportedNotice,
  wordSeparatorFor,
} from './translator-core';

describe('mode swap', () => {
  it('swaps between text and Morse modes', () => {
    expect(swapMode('text-to-morse')).toBe('morse-to-text');
    expect(swapMode('morse-to-text')).toBe('text-to-morse');
  });

  it('announces the top panel after a mode change', () => {
    expect(modeAnnouncement('morse-to-text')).toContain('Morse to Text');
    expect(modeAnnouncement('text-to-morse')).toContain('Text to Morse');
  });
});

describe('counters', () => {
  it('counts Unicode code points including spaces and line breaks', () => {
    expect(countCharacters('Hi😀')).toBe(3);
    expect(countCharacters('a b\n')).toBe(4);
    expect(characterCountLabel(0)).toBe('0 characters');
    expect(characterCountLabel(1)).toBe('1 character');
    expect(characterCountLabel(2)).toBe('2 characters');
  });

  it('counts only dots and dashes as signals', () => {
    expect(countSignals('... --- ...')).toBe(9);
    expect(countSignals('... --- ... / .-')).toBe(11);
    expect(countSignals('#')).toBe(0);
    expect(countSignals('··· ———')).toBe(6);
    expect(signalCountLabel(1)).toBe('1 signal');
    expect(signalCountLabel(2)).toBe('2 signals');
  });
});

describe('word separators', () => {
  it('returns the separator for the slash setting', () => {
    expect(wordSeparatorFor(true)).toBe(' / ');
    expect(wordSeparatorFor(false)).toBe('   ');
  });

  it('converts word separators in place without touching letter gaps', () => {
    const withSlash = '... --- ... / .-';
    const withSpaces = convertWordSeparators(withSlash, false);
    expect(withSpaces).toBe('... --- ...   .-');
    expect(convertWordSeparators(withSpaces, true)).toBe(withSlash);
  });
});

describe('random example', () => {
  it('picks only from the fixed list and avoids an immediate repeat', () => {
    const first = pickRandomExample(() => 0);
    expect(EXAMPLE_PHRASES).toContain(first);
    const second = pickRandomExample(() => 0, first);
    expect(second).not.toBe(first);
    expect(EXAMPLE_PHRASES).toContain(second);
  });

  it('uses the injected RNG', () => {
    expect(pickRandomExample(() => 0.99)).toBe(EXAMPLE_PHRASES[EXAMPLE_PHRASES.length - 1]);
  });
});

describe('export TXT', () => {
  it('builds UTF-8 body with a trailing newline and fixed filename', () => {
    const file = buildTxtFile('... --- ...');
    expect(file.filename).toBe('morse-code.txt');
    expect(file.body).toBe('... --- ...\n');
    expect(file.notice).toBe('TXT saved (12 characters).');
  });

  it('does not double the trailing newline', () => {
    expect(buildTxtFile('.\n').body).toBe('.\n');
  });
});

describe('hash build and parse', () => {
  it('builds share and puzzle hashes', () => {
    expect(buildShareHash('Hi')).toBe('text=Hi');
    expect(buildPuzzleHash('... --- ...')).toBe(`morse=${encodeURIComponent('... --- ...')}&hide=1`);
  });

  it('parses text, morse, and hide', () => {
    expect(parseTranslatorHash('#text=Hello')).toEqual({ text: 'Hello' });
    expect(parseTranslatorHash(`#morse=${encodeURIComponent('... --- ...')}&hide=1`)).toEqual({
      morse: '... --- ...',
      hide: true,
    });
    expect(parseTranslatorHash('#hide=1')).toEqual({ hide: true });
  });

  it('ignores empty and unsupported keys', () => {
    expect(parseTranslatorHash('')).toBeNull();
    expect(parseTranslatorHash('#foo=bar')).toBeNull();
  });

  it('rejects oversized values', () => {
    const huge = 'a'.repeat(HASH_MAX_LENGTH + 1);
    expect(parseTranslatorHash(`#text=${huge}`)).toBeNull();
    expect(parseTranslatorHash(`#morse=${huge}`)).toBeNull();
  });
});

describe('unsupported notice', () => {
  it('handles singular and plural', () => {
    expect(unsupportedNotice(0)).toBe('');
    expect(unsupportedNotice(1)).toBe('1 character could not be translated and appears as #.');
    expect(unsupportedNotice(2)).toBe('2 characters could not be translated and appear as #.');
  });
});

describe('autoplay helpers', () => {
  it('rejects empty and hash-only Morse', async () => {
    const { canAutoplayMorse, createAutoplayController, AUTOPLAY_DELAY_MS } = await import('./translator-core');
    expect(canAutoplayMorse('')).toBe(false);
    expect(canAutoplayMorse('#')).toBe(false);
    expect(canAutoplayMorse('...')).toBe(true);
    const runs: number[] = [];
    const timers = new Map<number, { fn: () => void; due: number }>();
    let now = 0;
    let id = 1;
    const c = createAutoplayController(
      AUTOPLAY_DELAY_MS,
      (fn, ms) => {
        const n = id++;
        timers.set(n, { fn, due: now + ms });
        return n;
      },
      (n) => {
        timers.delete(n);
      },
    );
    c.schedule(() => runs.push(1));
    now = 100;
    c.schedule(() => runs.push(2));
    now = 100 + AUTOPLAY_DELAY_MS;
    for (const t of timers.values()) if (t.due <= now) t.fn();
    expect(runs).toEqual([2]);
  });
});
