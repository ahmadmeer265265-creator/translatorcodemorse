import type { WordSeparator } from './morse';

export type TranslatorMode = 'text-to-morse' | 'morse-to-text';

export const EXAMPLE_PHRASES = [
  'SOS',
  'Hello world',
  'Good morning',
  'Thank you',
  'I love you',
  'Help me',
  'Morse code',
  'Happy birthday',
  'See you soon',
  'Good luck',
  'Welcome',
  'Have a nice day',
  'How are you',
  'Nice to meet you',
  'Practice makes perfect',
] as const;

export type ExamplePhrase = (typeof EXAMPLE_PHRASES)[number];

export const HASH_MAX_LENGTH = 2000;

export type HashPayload = {
  text?: string;
  morse?: string;
  hide?: boolean;
};

export function swapMode(mode: TranslatorMode): TranslatorMode {
  return mode === 'text-to-morse' ? 'morse-to-text' : 'text-to-morse';
}

export function modeAnnouncement(mode: TranslatorMode): string {
  return mode === 'morse-to-text'
    ? 'Morse to Text. Type Morse code in the top box.'
    : 'Text to Morse. Type text in the top box.';
}

export function wordSeparatorFor(showSlash: boolean): WordSeparator {
  return showSlash ? ' / ' : '   ';
}

/** Convert only word separators in place; leave letter spacing and content alone. */
export function convertWordSeparators(morse: string, showSlash: boolean): string {
  if (showSlash) {
    return morse.replace(/ {3,}/g, ' / ');
  }
  return morse.replace(/\s*[/|]\s*/g, '   ');
}

export function countCharacters(text: string): number {
  return Array.from(text).length;
}

export function characterCountLabel(count: number): string {
  return count === 1 ? '1 character' : `${count} characters`;
}

/** Count dots and dashes only after normalizing lookalike marks. */
export function countSignals(morse: string): number {
  const normalized = morse.replace(/[·•]/g, '.').replace(/[–—−]/g, '-');
  let count = 0;
  for (const char of normalized) {
    if (char === '.' || char === '-') count += 1;
  }
  return count;
}

export function signalCountLabel(count: number): string {
  return count === 1 ? '1 signal' : `${count} signals`;
}

export function unsupportedNotice(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? '1 character could not be translated and appears as #.'
    : `${count} characters could not be translated and appear as #.`;
}

export function unknownMorseNotice(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? '1 Morse group could not be translated and appears as #.'
    : `${count} Morse groups could not be translated and appear as #.`;
}

export function pickRandomExample(rng: () => number, last?: string | null): ExamplePhrase {
  const pool =
    last && EXAMPLE_PHRASES.includes(last as ExamplePhrase)
      ? EXAMPLE_PHRASES.filter((phrase) => phrase !== last)
      : [...EXAMPLE_PHRASES];
  const index = Math.floor(rng() * pool.length) % pool.length;
  return pool[index]!;
}

export function parseTranslatorHash(hash: string): HashPayload | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }

  const payload: HashPayload = {};
  if (params.has('text')) {
    const text = params.get('text') ?? '';
    if ([...text].length > HASH_MAX_LENGTH) return null;
    payload.text = text;
  }
  if (params.has('morse')) {
    const morse = params.get('morse') ?? '';
    if ([...morse].length > HASH_MAX_LENGTH) return null;
    payload.morse = morse;
  }
  if (params.has('hide')) {
    const hide = params.get('hide');
    payload.hide = hide === '1' || hide === 'true';
  }

  if (payload.text === undefined && payload.morse === undefined && payload.hide === undefined) {
    return null;
  }
  return payload;
}

export function buildShareHash(text: string): string {
  if (!text) return '';
  return `text=${encodeURIComponent(text)}`;
}

export function buildPuzzleHash(morse: string): string {
  return `morse=${encodeURIComponent(morse)}&hide=1`;
}

export function buildShareUrl(originHref: string, text: string): string {
  const url = new URL(originHref);
  url.search = '';
  url.hash = buildShareHash(text);
  return url.href;
}

export function buildPuzzleUrl(originHref: string, morse: string): string {
  const url = new URL(originHref);
  url.search = '';
  url.hash = buildPuzzleHash(morse);
  return url.href;
}

export function txtExportNotice(characterCount: number): string {
  return `TXT saved (${characterCount} characters).`;
}

export function buildTxtFile(morse: string): { filename: string; body: string; notice: string } {
  const body = morse.endsWith('\n') ? morse : `${morse}\n`;
  return {
    filename: 'morse-code.txt',
    body,
    notice: txtExportNotice(countCharacters(body)),
  };
}
