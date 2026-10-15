import { MORSE_ALPHABET } from './morse';

const DOTS = /[·•]/g;
const DASHES = /[–—−]/g;
const MORSE_TO_CHAR = new Map(MORSE_ALPHABET.map((entry) => [entry.code, entry.char]));

export type MorseGroupSpan = {
  /** UTF-16 start offset in the Morse string */
  morseStart: number;
  /** UTF-16 end offset (exclusive) in the Morse string */
  morseEnd: number;
  /** UTF-16 start offset in the Text string */
  textStart: number;
  /** UTF-16 end offset (exclusive) in the Text string */
  textEnd: number;
  /** Decoded character (or "#") */
  char: string;
  /** Raw Morse token */
  code: string;
};

/**
 * Parse Morse into letter groups with UTF-16 offsets in both Morse and decoded Text.
 * Handles "/", "|", three-or-more spaces as word breaks, line breaks, "#", and emoji (one code point).
 */
export function parseMorseGroups(morse: string): MorseGroupSpan[] {
  const groups: MorseGroupSpan[] = [];
  let textOffset = 0;
  let i = 0;

  const pushChar = (code: string, morseStart: number, morseEnd: number) => {
    let char: string;
    if (code === '#') char = '#';
    else char = MORSE_TO_CHAR.get(code) ?? '#';
    const textStart = textOffset;
    textOffset += char.length; // UTF-16 length (BMP chars = 1, emoji may be 2)
    // For emoji we map one Morse # to one code point; char is always BMP "#" or alphabet char here.
    groups.push({ morseStart, morseEnd, textStart, textEnd: textOffset, char, code });
  };

  while (i < morse.length) {
    const ch = morse[i]!;
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      textOffset += 1; // decoded lines join with \n in decode(); keep index aligned for multi-line
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      // Count spaces: 1 = letter gap (skip), 3+ = word break
      let j = i;
      while (j < morse.length && (morse[j] === ' ' || morse[j] === '\t')) j += 1;
      const run = j - i;
      if (run >= 3) {
        textOffset += 1; // space between words in decoded text
      }
      i = j;
      continue;
    }
    if (ch === '/' || ch === '|') {
      textOffset += 1;
      i += 1;
      // skip surrounding spaces already handled; consume optional spaces around slash
      while (i < morse.length && (morse[i] === ' ' || morse[i] === '\t')) i += 1;
      continue;
    }

    // Token: dots, dashes, or #
    const start = i;
    if (ch === '#') {
      i += 1;
      pushChar('#', start, i);
      continue;
    }
    while (i < morse.length && /[.\-·•–—−]/.test(morse[i]!)) i += 1;
    if (i === start) {
      i += 1;
      continue;
    }
    const raw = morse.slice(start, i);
    const normalized = raw.replace(DOTS, '.').replace(DASHES, '-');
    pushChar(normalized, start, i);
  }

  return groups;
}

/** Find the group active at a given playback time (ms from start), using per-group durations. */
export function groupAtTime(
  groupStartsMs: readonly number[],
  groupDurationsMs: readonly number[],
  elapsedMs: number,
): number {
  for (let index = 0; index < groupStartsMs.length; index += 1) {
    const start = groupStartsMs[index]!;
    const end = start + groupDurationsMs[index]!;
    if (elapsedMs >= start && elapsedMs < end) return index;
  }
  return -1;
}

/** UTF-16 spans for each non-whitespace code point in text (spaces/tabs/newlines skipped). */
export function textLetterSpans(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let utf16 = 0;
  for (const ch of Array.from(text)) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      utf16 += ch.length;
      continue;
    }
    spans.push({ start: utf16, end: utf16 + ch.length });
    utf16 += ch.length;
  }
  return spans;
}

export function renderHighlightedHtml(value: string, start: number, end: number): string {
  if (start < 0 || end <= start || start >= value.length) {
    return escapeHtml(value);
  }
  const before = escapeHtml(value.slice(0, start));
  const mid = escapeHtml(value.slice(start, end));
  const after = escapeHtml(value.slice(end));
  return `${before}<mark>${mid}</mark>${after}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
