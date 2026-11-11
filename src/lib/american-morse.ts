/**
 * American Morse (Railroad Morse) text ↔ typed-notation engine.
 *
 * Isolated from the International Morse tables in morse.ts. Nothing here
 * imports the homepage translator, the audio/image pages, or the DOM.
 *
 * Typed notation (encode output is decode input):
 *   `.`   dot
 *   `-`   regular dash
 *   `=`   long dash, letter L only
 *   `_`   extra-long dash, digit 0 only
 *   ` `   intra-letter gap inside C, O, R, Y, Z, &, and semicolon
 *   `/`   gap between two letters
 *   `//`  gap between two words
 *
 * Decode also accepts Wikipedia-style dashes: ⸺ (U+2E3A) as L, ⸻ (U+2E3B)
 * as 0, plus en-dash/minus as a regular dash and em-dash as L.
 *
 * Unmappable characters encode as `#` (not thrown, not dropped).
 *
 * Character-table conflicts found while implementing are listed in
 * AMERICAN_MORSE_TABLE_NOTES — they are not silently “fixed” beyond the
 * two collisions that cannot round-trip if taken literally (see notes).
 */

export type MorseGroup = 'letter' | 'digit' | 'mark';

export type MorseEntry = {
  char: string;
  code: string;
  group: MorseGroup;
};

/** Canonical long-dash token (letter L). */
export const LONG_DASH = '=';
/** Canonical extra-long-dash token (digit 0). */
export const EXTRA_LONG_DASH = '_';
/** Wikipedia two-em dash, accepted as an L alias on decode. */
export const LONG_DASH_UNICODE = '\u2E3A';
/** Wikipedia three-em dash, accepted as a 0 alias on decode. */
export const EXTRA_LONG_DASH_UNICODE = '\u2E3B';
/** Close-quote character so open and close quotes can round-trip separately. */
export const CLOSE_QUOTE = '\u201D';

/**
 * Ground-truth alphabet for this engine.
 *
 * Letters and digits match Wikipedia, Morse Code World, and the Stage 1
 * brief. Punctuation mark *sequences* follow the brief’s concatenated
 * forms so each symbol is a single lookup token (see TABLE NOTES).
 */
export const AMERICAN_MORSE_ALPHABET: readonly MorseEntry[] = [
  { char: 'A', code: '.-', group: 'letter' },
  { char: 'B', code: '-...', group: 'letter' },
  { char: 'C', code: '.. .', group: 'letter' },
  { char: 'D', code: '-..', group: 'letter' },
  { char: 'E', code: '.', group: 'letter' },
  { char: 'F', code: '.-.', group: 'letter' },
  { char: 'G', code: '--.', group: 'letter' },
  { char: 'H', code: '....', group: 'letter' },
  { char: 'I', code: '..', group: 'letter' },
  { char: 'J', code: '-.-.', group: 'letter' },
  { char: 'K', code: '-.-', group: 'letter' },
  { char: 'L', code: LONG_DASH, group: 'letter' },
  { char: 'M', code: '--', group: 'letter' },
  { char: 'N', code: '-.', group: 'letter' },
  { char: 'O', code: '. .', group: 'letter' },
  { char: 'P', code: '.....', group: 'letter' },
  { char: 'Q', code: '..-.', group: 'letter' },
  { char: 'R', code: '. ..', group: 'letter' },
  { char: 'S', code: '...', group: 'letter' },
  { char: 'T', code: '-', group: 'letter' },
  { char: 'U', code: '..-', group: 'letter' },
  { char: 'V', code: '...-', group: 'letter' },
  { char: 'W', code: '.--', group: 'letter' },
  { char: 'X', code: '.-..', group: 'letter' },
  { char: 'Y', code: '.. ..', group: 'letter' },
  { char: 'Z', code: '... .', group: 'letter' },
  { char: '1', code: '.--.', group: 'digit' },
  { char: '2', code: '..-..', group: 'digit' },
  { char: '3', code: '...-.', group: 'digit' },
  { char: '4', code: '....-', group: 'digit' },
  { char: '5', code: '---', group: 'digit' },
  { char: '6', code: '......', group: 'digit' },
  { char: '7', code: '--..', group: 'digit' },
  { char: '8', code: '-....', group: 'digit' },
  { char: '9', code: '-..-', group: 'digit' },
  { char: '0', code: EXTRA_LONG_DASH, group: 'digit' },
  { char: '.', code: '..--..', group: 'mark' },
  { char: ',', code: '.-.-', group: 'mark' },
  { char: '?', code: '-..-.', group: 'mark' },
  { char: '!', code: '---.', group: 'mark' },
  { char: '/', code: '..--', group: 'mark' },
  { char: '-', code: '.......-..', group: 'mark' },
  { char: '&', code: '. ...', group: 'mark' },
  { char: ':', code: '-.-..', group: 'mark' },
  { char: ';', code: '... ..', group: 'mark' },
  { char: "'", code: '..-..-..', group: 'mark' },
  { char: '(', code: '.....-.', group: 'mark' },
  { char: ')', code: '.........', group: 'mark' },
  { char: '"', code: '..-.-.', group: 'mark' },
  { char: CLOSE_QUOTE, code: '..-.-.-.', group: 'mark' },
];

/**
 * Conflicts and notation choices — flagged, not silently papered over.
 *
 * 1. Ampersand. The brief wrote `....` plus “internal gap”. That mark
 *    string without a gap is H. Wikipedia, Morse Code World, and
 *    morse-code.info all give ES with the special intra-letter pause:
 *    `. ...`. That is what this table uses.
 *
 * 2. Semicolon. The brief wrote `.....`, which is also P. Morse Code
 *    World / morse-code.info give `... ..` (SI with an internal pause).
 *    Wikipedia lists SI as two letters (letter-gap). Pope (1881, §157)
 *    gives `.-.-.`. This table uses `... ..` so `;` and `P` both
 *    round-trip. Resolve before Stage 2 if the article needs the brief’s
 *    five-dot form.
 *
 * 3. Digraph punctuation. Wikipedia/Coe send several marks as letter
 *    groups with an *inter-letter* gap (apostrophe QX, hyphen HX, slash
 *    UT, colon KEE, parens PN / PII, quotes QN / QJ). Using `/` for those
 *    would make encode('-') identical to encode('HX'). The brief’s
 *    concatenated sequences are stored as *one* token so punctuation
 *    round-trips. Morse Code World instead writes some of those with
 *    internal spaces (`..- -`, `... .-..`, `-.- . .`, `..-. .-..`) and
 *    gives hyphen as SX (`... .-..`) not HX.
 *
 * 4. Close parenthesis. Brief `.........` (nine dots). Wikipedia PII is
 *    `..... .. ..` with letter gaps.
 *
 * 5. L and 0 dash length. Sources agree on ordering (dash < L < 0) but
 *    not ratios: Morse Code World uses 2 / 4 / 5 units; Wikipedia’s 0
 *    glyph is drawn much longer. Timing lives in american-morse-runs.ts.
 *
 * 6. ASCII `"` encodes as the open-quote sequence. Close quote is `”`
 *    (U+201D) so the two sequences stay distinct.
 */
export const AMERICAN_MORSE_TABLE_NOTES = [
  'ampersand: brief `....` (internal gap) vs Wikipedia/World `. ...` (using `. ...`)',
  'semicolon: brief `.....` collides with P; World `... ..`; Pope `.-.-.` (using `... ..`)',
  'hyphen/slash/colon/quotes/parens: brief concatenates digraphs; Wikipedia uses letter gaps',
  'hyphen: World `... .-..` (SX) vs brief/Wikipedia-HX concatenated `.......-..`',
  'close parenthesis: brief nine dots vs Wikipedia PII with letter gaps',
  'L/0 duration ratios are not standardized across sources',
] as const;

const CHAR_TO_MORSE = new Map(AMERICAN_MORSE_ALPHABET.map((entry) => [entry.char, entry.code]));
CHAR_TO_MORSE.set('\u201C', '..-.-.');

const MORSE_TO_CHAR = new Map(AMERICAN_MORSE_ALPHABET.map((entry) => [entry.code, entry.char]));

export type EncodeResult = {
  output: string;
  unsupported: string[];
};

export type DecodeResult = {
  output: string;
  unknown: number;
};

const DOTS = /[·•]/g;
const REGULAR_DASHES = /[–−]/g;

/** Map typed/pasted Morse onto the canonical `. - = _` alphabet. */
export function normalizeAmericanMarks(morse: string): string {
  return morse
    .replace(DOTS, '.')
    .replaceAll(LONG_DASH_UNICODE, LONG_DASH)
    .replaceAll(EXTRA_LONG_DASH_UNICODE, EXTRA_LONG_DASH)
    .replaceAll('\u2014', LONG_DASH)
    .replace(REGULAR_DASHES, '-');
}

export function encode(text: string): EncodeResult {
  const unsupported: string[] = [];
  const lines = text.split(/\r\n|\n|\r/);
  const output = lines.map((line) => encodeLine(line, unsupported)).join('\n');
  return { output, unsupported };
}

export function decode(morse: string): DecodeResult {
  const trimmed = morse.trim();
  if (!trimmed) return { output: '', unknown: 0 };

  let unknown = 0;
  const lines = trimmed.split(/\r\n|\n|\r/);
  const output = lines
    .map((line) => {
      const decoded = decodeLine(line);
      unknown += decoded.unknown;
      return decoded.text;
    })
    .join('\n');

  return { output, unknown };
}

function encodeLine(line: string, unsupported: string[]): string {
  const words: string[][] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    words.push(current);
    current = [];
  };

  for (const char of Array.from(line)) {
    if (char === ' ' || char === '\t') {
      flush();
      continue;
    }
    const upper = char.toUpperCase();
    const code = CHAR_TO_MORSE.get(char) ?? CHAR_TO_MORSE.get(upper);
    if (code) {
      current.push(code);
      continue;
    }
    unsupported.push(char);
    current.push('#');
  }
  flush();

  return words.map((word) => word.join('/')).join('//');
}

function decodeLine(line: string): { text: string; unknown: number } {
  const normalized = normalizeAmericanMarks(line).trim();
  if (!normalized) return { text: '', unknown: 0 };

  let unknown = 0;
  const letters: string[] = [];
  let pendingWord = false;

  for (const raw of normalized.split('/')) {
    const token = raw.trim().replace(/\s+/g, ' ');
    if (token.length === 0) {
      pendingWord = letters.length > 0;
      continue;
    }
    if (pendingWord) {
      letters.push(' ');
      pendingWord = false;
    }
    if (token === '#') {
      letters.push('#');
      continue;
    }
    const char = MORSE_TO_CHAR.get(token);
    if (char) {
      letters.push(char);
      continue;
    }
    unknown += 1;
    letters.push('#');
  }

  return { text: letters.join(''), unknown };
}
