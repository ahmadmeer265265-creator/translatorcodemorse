export type MorseGroup = 'letter' | 'digit' | 'mark';

export type MorseEntry = {
  char: string;
  code: string;
  group: MorseGroup;
};

/**
 * International Morse from ITU-R M.1677-1, plus four signs the recommendation
 * does not assign (! ; _ $) and ampersand on the Wait pattern (.-...).
 */
export const MORSE_ALPHABET: readonly MorseEntry[] = [
  { char: 'A', code: '.-', group: 'letter' },
  { char: 'B', code: '-...', group: 'letter' },
  { char: 'C', code: '-.-.', group: 'letter' },
  { char: 'D', code: '-..', group: 'letter' },
  { char: 'E', code: '.', group: 'letter' },
  { char: 'F', code: '..-.', group: 'letter' },
  { char: 'G', code: '--.', group: 'letter' },
  { char: 'H', code: '....', group: 'letter' },
  { char: 'I', code: '..', group: 'letter' },
  { char: 'J', code: '.---', group: 'letter' },
  { char: 'K', code: '-.-', group: 'letter' },
  { char: 'L', code: '.-..', group: 'letter' },
  { char: 'M', code: '--', group: 'letter' },
  { char: 'N', code: '-.', group: 'letter' },
  { char: 'O', code: '---', group: 'letter' },
  { char: 'P', code: '.--.', group: 'letter' },
  { char: 'Q', code: '--.-', group: 'letter' },
  { char: 'R', code: '.-.', group: 'letter' },
  { char: 'S', code: '...', group: 'letter' },
  { char: 'T', code: '-', group: 'letter' },
  { char: 'U', code: '..-', group: 'letter' },
  { char: 'V', code: '...-', group: 'letter' },
  { char: 'W', code: '.--', group: 'letter' },
  { char: 'X', code: '-..-', group: 'letter' },
  { char: 'Y', code: '-.--', group: 'letter' },
  { char: 'Z', code: '--..', group: 'letter' },
  { char: '1', code: '.----', group: 'digit' },
  { char: '2', code: '..---', group: 'digit' },
  { char: '3', code: '...--', group: 'digit' },
  { char: '4', code: '....-', group: 'digit' },
  { char: '5', code: '.....', group: 'digit' },
  { char: '6', code: '-....', group: 'digit' },
  { char: '7', code: '--...', group: 'digit' },
  { char: '8', code: '---..', group: 'digit' },
  { char: '9', code: '----.', group: 'digit' },
  { char: '0', code: '-----', group: 'digit' },
  { char: '.', code: '.-.-.-', group: 'mark' },
  { char: ',', code: '--..--', group: 'mark' },
  { char: '?', code: '..--..', group: 'mark' },
  { char: "'", code: '.----.', group: 'mark' },
  { char: '!', code: '-.-.--', group: 'mark' },
  { char: '/', code: '-..-.', group: 'mark' },
  { char: '(', code: '-.--.', group: 'mark' },
  { char: ')', code: '-.--.-', group: 'mark' },
  { char: '&', code: '.-...', group: 'mark' },
  { char: ':', code: '---...', group: 'mark' },
  { char: ';', code: '-.-.-.', group: 'mark' },
  { char: '=', code: '-...-', group: 'mark' },
  { char: '+', code: '.-.-.', group: 'mark' },
  { char: '-', code: '-....-', group: 'mark' },
  { char: '_', code: '..--.-', group: 'mark' },
  { char: '"', code: '.-..-.', group: 'mark' },
  { char: '$', code: '...-..-', group: 'mark' },
  { char: '@', code: '.--.-.', group: 'mark' },
];

const CHAR_TO_MORSE = new Map(MORSE_ALPHABET.map((entry) => [entry.char, entry.code]));
const MORSE_TO_CHAR = new Map(MORSE_ALPHABET.map((entry) => [entry.code, entry.char]));

export type EncodeResult = {
  output: string;
  unsupported: string[];
};

export type DecodeResult = {
  output: string;
  unknown: number;
};

const DOTS = /[·•]/g;
const DASHES = /[–—−]/g;

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
    const code = CHAR_TO_MORSE.get(char.toUpperCase());
    if (code) {
      current.push(code);
      continue;
    }
    unsupported.push(char);
  }
  flush();

  return words.map((word) => word.join(' ')).join(' / ');
}

function decodeLine(line: string): { text: string; unknown: number } {
  const normalized = line.replace(DOTS, '.').replace(DASHES, '-').trim();
  if (!normalized) return { text: '', unknown: 0 };

  let unknown = 0;
  const marked = normalized.replace(/\|/g, '/').replace(/ {3,}/g, ' / ');
  const words = marked
    .split('/')
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  const text = words
    .map((word) =>
      word
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .map((token) => {
          const char = MORSE_TO_CHAR.get(token);
          if (char) return char;
          unknown += 1;
          return '?';
        })
        .join(''),
    )
    .join(' ');

  return { text, unknown };
}
