import { decode, type DecodeResult, type WordSeparator } from './morse';
import { DOT_MAX_MS, LETTER_GAP_MS, WORD_GAP_MS } from './tap-timing';

export type MorseMark = '.' | '-';
export type MorseGap = 'element' | 'letter' | 'word';

export type MorseKeyEvent =
  | { kind: 'mark'; mark: MorseMark }
  | { kind: 'gap'; gap: MorseGap };

export type TapPressEvent =
  | { durationMs: number; gapAfterMs: number }
  | { wordBreak: true };

/**
 * Same rule the homepage tap pad uses: a press shorter than DOT_MAX_MS (200)
 * is a dot; 200ms or longer is a dash. Works for tap, mouse hold, or keyboard.
 */
export function classifyTapMark(durationMs: number): MorseMark {
  return durationMs < DOT_MAX_MS ? '.' : '-';
}

/**
 * Same idle thresholds as the homepage tap pad: 800ms closes a letter, 2000ms
 * is a word space. Shorter pauses stay inside the current letter.
 */
export function classifyTapGap(gapMs: number): MorseGap {
  if (gapMs >= WORD_GAP_MS) return 'word';
  if (gapMs >= LETTER_GAP_MS) return 'letter';
  return 'element';
}

/** Turn a straight-key / tap / click-hold sequence into the shared event stream. */
export function tapPressesToEvents(presses: readonly TapPressEvent[]): MorseKeyEvent[] {
  const events: MorseKeyEvent[] = [];
  for (const press of presses) {
    if ('wordBreak' in press) {
      events.push({ kind: 'gap', gap: 'word' });
      continue;
    }
    events.push({ kind: 'mark', mark: classifyTapMark(press.durationMs) });
    if (press.gapAfterMs > 0) {
      events.push({ kind: 'gap', gap: classifyTapGap(press.gapAfterMs) });
    }
  }
  return events;
}

/**
 * Parse an International Morse string (homepage notation) into the same
 * dot / dash / gap stream the keyers emit.
 */
export function morseStringToEvents(morse: string): MorseKeyEvent[] {
  const trimmed = morse.trim();
  if (!trimmed) return [];

  const marked = trimmed.replace(/\|/g, '/').replace(/ {3,}/g, ' / ');
  const words = marked
    .split('/')
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  const events: MorseKeyEvent[] = [];
  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) events.push({ kind: 'gap', gap: 'word' });
    const letters = word.split(/\s+/).filter((token) => token.length > 0);
    letters.forEach((token, letterIndex) => {
      if (letterIndex > 0) events.push({ kind: 'gap', gap: 'letter' });
      const marks = Array.from(token) as string[];
      marks.forEach((ch, markIndex) => {
        if (markIndex > 0) events.push({ kind: 'gap', gap: 'element' });
        if (ch === '-' || ch === '.') events.push({ kind: 'mark', mark: ch });
      });
    });
  });
  return events;
}

export function eventsToMorse(
  events: readonly MorseKeyEvent[],
  wordSeparator: WordSeparator = ' / ',
): string {
  const words: string[][] = [[]];
  let current = '';

  const flushLetter = () => {
    if (!current) return;
    words[words.length - 1]!.push(current);
    current = '';
  };

  for (const event of events) {
    if (event.kind === 'mark') {
      current += event.mark;
      continue;
    }
    if (event.gap === 'element') continue;
    flushLetter();
    if (event.gap === 'word' && words[words.length - 1]!.length > 0) {
      words.push([]);
    }
  }
  flushLetter();

  return words
    .map((word) => word.join(' '))
    .filter((word) => word.length > 0)
    .join(wordSeparator);
}

export function eventsToText(events: readonly MorseKeyEvent[]): DecodeResult {
  return decode(eventsToMorse(events));
}
