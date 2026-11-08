/**
 * Unit-agnostic Morse run classification.
 *
 * A mark/gap length is the same problem in milliseconds (microphone) and in
 * pixels (a photographed line of Morse): compare each length to a dot-unit
 * using the CW ratios dot:dash = 1:3 and gaps of 1 / 3 / 7. Nothing in this
 * file knows about time, pixels, or the DOM.
 *
 * The streaming tracker is the one the microphone decoder already used.
 * Batch callers (a whole image at once) estimate a unit themselves and then
 * call the same classifyMark / classifyGap functions.
 */

/**
 * Rolling window of recent marks used to re-estimate the dot unit.
 * ~12 marks is roughly 3–4 letters, enough to adapt without overreacting.
 */
export const UNIT_WINDOW = 12;

/**
 * A mark is a dash when it is at least this multiple of the current dot
 * estimate (dot = 1, dash = 3, midpoint = 2).
 */
export const DASH_RATIO = 2;

export type GapClass = 'intra' | 'letter' | 'word';

export type RunKind = 'mark' | 'space';

export type LengthRun = {
  type: RunKind;
  length: number;
};

/**
 * Adaptive timing tracker. The dot unit is the shortest recent mark:
 * dashes only ever inflate an average, whereas the minimum tracks the true
 * dot. A bootstrap rule relates the very first mark to the seed so a first
 * dash is not mistaken for a dot. As marks arrive the estimate follows the
 * sender's speed up and down. Gaps are classified against this same unit
 * using the 1 / 3 / 7 CW ratios.
 */
export function createLengthTracker(initial: number, locked = false) {
  const marks: number[] = [];
  let markUnit = initial;

  const min = (list: readonly number[]) => (list.length === 0 ? 0 : Math.min(...list));

  const learnMark = (length: number): number => {
    // Locked unit (manual override): never adapt to observed marks.
    if (locked) return markUnit;
    if (marks.length === 0) {
      // Bootstrap: relate the first mark to the seed before deciding.
      if (length >= markUnit * DASH_RATIO) markUnit = length / 3;
      else if (length * DASH_RATIO <= markUnit) markUnit = length;
    }
    marks.push(length);
    if (marks.length > UNIT_WINDOW) marks.shift();
    // Dot unit tracks the shortest recent mark (dashes only inflate).
    markUnit = min(marks);
    return markUnit;
  };

  return {
    learnMark,
    mark: () => markUnit,
    reset: () => {
      marks.length = 0;
      markUnit = initial;
    },
  };
}

/** Classify one mark length as dot or dash against the current unit. */
export function classifyMark(length: number, unit: number): '.' | '-' {
  return length >= unit * DASH_RATIO ? '-' : '.';
}

/**
 * Classify one space length against the current unit. Nominal gaps are
 * 1 / 3 / 7 units; the intra/letter boundary sits at 2x (midpoint of 1 and 3)
 * and the letter/word boundary at 5x (midpoint of 3 and 7). A 2x letter floor
 * tolerates AnalyserNode / tone-ramp bleed that shortens measured gaps, which
 * a 2.5x floor mistook for intra-element spacing on real mic audio. Image
 * decoding uses the same boundaries so the two paths cannot drift apart.
 */
export function classifyGap(length: number, unit: number): GapClass {
  if (length >= unit * 5) return 'word';
  if (length >= unit * 2) return 'letter';
  return 'intra';
}

/**
 * How close a mark may sit to the dot/dash boundary (ratio 2) before it is
 * flagged ambiguous, measured in dot-units.
 *
 * Prototypes are 1 (dot) and 3 (dash); the decision boundary is their
 * midpoint, 2. A band of ±0.25 stays clear of ordinary ±20% width jitter
 * (a jittered dash lands near 2.4, a jittered dot near 1.2) and still flags
 * a mark within a quarter-unit of the boundary, i.e. ratio 1.75–2.25.
 * The nearest class is still returned; the flag only says "do not trust it".
 */
export const AMBIGUITY_BAND = 0.25;

export type ClassifiedMark = {
  symbol: '.' | '-';
  /** length / unit. */
  ratio: number;
  ambiguous: boolean;
};

/** Nearest dot/dash class, plus a flag when the length is too close to the boundary. */
export function classifyMarkDetailed(length: number, unit: number): ClassifiedMark {
  const safeUnit = unit > 0 ? unit : 1;
  const ratio = length / safeUnit;
  return {
    symbol: classifyMark(length, safeUnit),
    ratio,
    ambiguous: Math.abs(ratio - DASH_RATIO) <= AMBIGUITY_BAND,
  };
}

/**
 * Collapse adjacent samples of the same kind into runs.
 * `length` is milliseconds for audio envelopes and 1 per column for an image.
 */
export function collapseLabeledRuns(items: readonly LengthRun[]): LengthRun[] {
  const runs: LengthRun[] = [];
  for (const item of items) {
    if (item.length <= 0) continue;
    const last = runs[runs.length - 1];
    if (last && last.type === item.type) last.length += item.length;
    else runs.push({ type: item.type, length: item.length });
  }
  return runs;
}

/** Boolean column (or sample) flags → mark/space runs. True is a mark. */
export function collapseFlags(flags: readonly boolean[]): LengthRun[] {
  return collapseLabeledRuns(flags.map((on) => ({ type: on ? 'mark' : 'space', length: 1 })));
}

/**
 * Site Morse formatting: letters separated by a space, words by ` / `
 * (the same join `encode` uses). Empty words are dropped.
 */
export function formatMorseTokens(
  words: readonly (readonly string[])[],
  wordSeparator = ' / ',
): string {
  return words
    .map((word) => word.join(' '))
    .filter((word) => word.length > 0)
    .join(wordSeparator);
}
