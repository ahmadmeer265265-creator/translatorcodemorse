import { MORSE_ALPHABET } from './morse';

/** Press shorter than this is a dot; >= this is a dash. */
export const DOT_MAX_MS = 200;
/** Idle gap after release that closes the current letter. */
export const LETTER_GAP_MS = 800;
/** Idle gap after release that inserts a word space (after any letter decode). */
export const WORD_GAP_MS = 2000;

const MORSE_TO_CHAR = new Map(MORSE_ALPHABET.map((entry) => [entry.code, entry.char]));

export type TapClock = {
  now: () => number;
};

export type TapAnnouncement = {
  kind: 'letter' | 'word';
  text: string;
};

export type TapSnapshot = {
  marks: string;
  text: string;
  morse: string;
  announcement: TapAnnouncement | null;
};

export type TapEngine = {
  press: (durationMs: number) => TapSnapshot;
  tick: () => TapSnapshot;
  wordBreak: () => TapSnapshot;
  undoMark: () => TapSnapshot;
  clear: () => TapSnapshot;
  snapshot: () => TapSnapshot;
};

export function createTapEngine(clock: TapClock, showSlash = true): TapEngine {
  let marks: Array<'.' | '-'> = [];
  let text = '';
  /** Words as arrays of Morse letter codes */
  let words: string[][] = [[]];
  let lastReleaseMs: number | null = null;
  let announcement: TapAnnouncement | null = null;
  let letterFlushedForRelease = false;
  let wordFlushedForRelease = false;

  const wordSep = showSlash ? ' / ' : '   ';

  const rebuildMorse = () =>
    words
      .map((word) => word.join(' '))
      .filter((word) => word.length > 0)
      .join(wordSep);

  const snap = (): TapSnapshot => ({
    marks: marks.join(''),
    text,
    morse: rebuildMorse(),
    announcement,
  });

  const appendLetter = (code: string): TapAnnouncement => {
    const char = MORSE_TO_CHAR.get(code) ?? '#';
    const word = words[words.length - 1]!;
    word.push(code);
    text += char;
    return { kind: 'letter', text: char };
  };

  const appendWordSpace = (): TapAnnouncement | null => {
    if (text.length === 0 || text.endsWith(' ')) return null;
    words.push([]);
    text += ' ';
    return { kind: 'word', text: ' ' };
  };

  const flushLetter = () => {
    if (marks.length === 0) return;
    const code = marks.join('');
    marks = [];
    announcement = appendLetter(code);
    letterFlushedForRelease = true;
  };

  return {
    press(durationMs) {
      announcement = null;
      const now = clock.now();

      if (lastReleaseMs !== null) {
        const gap = now - lastReleaseMs;
        if (marks.length > 0 && gap >= LETTER_GAP_MS) {
          flushLetter();
        }
        if (marks.length === 0 && gap >= WORD_GAP_MS) {
          const wordAnn = appendWordSpace();
          if (wordAnn) announcement = wordAnn;
        }
      }

      const mark: '.' | '-' = durationMs < DOT_MAX_MS ? '.' : '-';
      marks.push(mark);
      lastReleaseMs = now;
      letterFlushedForRelease = false;
      wordFlushedForRelease = false;
      return snap();
    },

    tick() {
      announcement = null;
      if (lastReleaseMs === null) return snap();
      const now = clock.now();
      const gap = now - lastReleaseMs;

      if (marks.length > 0 && gap >= LETTER_GAP_MS && !letterFlushedForRelease) {
        flushLetter();
      }

      if (
        marks.length === 0 &&
        gap >= WORD_GAP_MS &&
        !wordFlushedForRelease &&
        text.length > 0 &&
        !text.endsWith(' ')
      ) {
        const wordAnn = appendWordSpace();
        if (wordAnn) {
          announcement = wordAnn;
          wordFlushedForRelease = true;
        }
      }

      return snap();
    },

    wordBreak() {
      announcement = null;
      if (marks.length > 0) flushLetter();
      const wordAnn = appendWordSpace();
      if (wordAnn) announcement = wordAnn;
      lastReleaseMs = clock.now();
      letterFlushedForRelease = true;
      wordFlushedForRelease = true;
      return snap();
    },

    undoMark() {
      announcement = null;
      if (marks.length > 0) marks.pop();
      return snap();
    },

    clear() {
      marks = [];
      text = '';
      words = [[]];
      lastReleaseMs = null;
      announcement = null;
      letterFlushedForRelease = false;
      wordFlushedForRelease = false;
      return snap();
    },

    snapshot: snap,
  };
}

/** Deterministic helper: press durations and gaps between releases. */
export function runTapSequence(
  events: Array<{ pressMs: number; gapAfterMs: number } | { wordBreak: true } | { undo: true }>,
  showSlash = true,
): TapSnapshot {
  let time = 0;
  const engine = createTapEngine({ now: () => time }, showSlash);
  let last = engine.snapshot();
  for (const event of events) {
    if ('wordBreak' in event) {
      last = engine.wordBreak();
      continue;
    }
    if ('undo' in event) {
      last = engine.undoMark();
      continue;
    }
    last = engine.press(event.pressMs);
    if (event.gapAfterMs <= 0) continue;
    const steps = Math.max(1, Math.ceil(event.gapAfterMs / 25));
    const step = event.gapAfterMs / steps;
    for (let i = 0; i < steps; i += 1) {
      time += step;
      last = engine.tick();
    }
  }
  return last;
}
