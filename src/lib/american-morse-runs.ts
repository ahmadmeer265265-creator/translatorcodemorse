/**
 * Unit-agnostic American Morse run classification.
 *
 * International Morse (morse-runs.ts) splits marks into 2 buckets (dot/dash)
 * and gaps into 3 (intra / letter / word) using fixed CW ratios against an
 * adaptive dot unit. American Morse needs four mark lengths (dot, dash, L’s
 * long dash, 0’s extra-long dash) and four gap lengths (element, intra-letter
 * pause inside C/O/R/Y/Z/&, inter-letter, inter-word).
 *
 * Sources agree only on *ordering*, not millisecond ratios, so this file:
 *   1. Tracks the sender’s own dot unit (shortest recent mark), same idea as
 *      createLengthTracker.
 *   2. Classifies with 1D clustering (Jenks / exact 1D k-means, Otsu-style
 *      SSE partitions) once the window has distinct groups.
 *   3. Falls back to unit-relative midpoints that encode only that ordering,
 *      never a fixed millisecond schedule.
 *
 * GapClass includes `element` (the shortest intra-mark gap, typed as
 * concatenation) plus the three structural tiers the brief named: internal,
 * letter, word.
 */

import {
  EXTRA_LONG_DASH,
  LONG_DASH,
} from './american-morse';

export const MARK_WINDOW = 24;
export const GAP_WINDOW = 24;

/**
 * Fallback mark boundaries as multiples of the current dot unit. Used only
 * when the running window has not yet formed enough clusters. Not a
 * historical standard — dash≈2, L≈4, 0≈5–8 appear in different manuals.
 */
export const FALLBACK_MARK_BOUNDS = { dash: 1.5, long: 3, zero: 4.7 } as const;

/**
 * Fallback gap boundaries as multiples of the current dot unit.
 * element≈1, internal≈2, letter≈3–3.5, word≈6–7 in the synth model.
 */
export const FALLBACK_GAP_BOUNDS = { internal: 1.45, letter: 2.6, word: 5 } as const;

export type MarkSymbol = '.' | '-' | '=' | '_';
export type GapClass = 'element' | 'internal' | 'letter' | 'word';
export type RunKind = 'mark' | 'space';

export type LengthRun = {
  type: RunKind;
  length: number;
};

const MARK_BY_INDEX: readonly MarkSymbol[] = ['.', '-', LONG_DASH, EXTRA_LONG_DASH];
const GAP_BY_INDEX: readonly GapClass[] = ['element', 'internal', 'letter', 'word'];

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/**
 * Greedy 1D groups: consecutive sorted samples whose ratio is within
 * `relativeGap` of the cluster mean stay together.
 */
export function clusterSorted(values: readonly number[], relativeGap = 0.38): number[][] {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const value of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last) {
      clusters.push([value]);
      continue;
    }
    const center = mean(last);
    const lo = Math.min(center, value);
    const hi = Math.max(center, value);
    if (lo > 0 && hi / lo <= 1 + relativeGap) last.push(value);
    else clusters.push([value]);
  }
  return clusters;
}

/**
 * Exact 1D k-class partition minimizing within-class SSE (Jenks / 1D
 * k-means). Returns centroids in ascending order, or fewer if there are
 * not enough samples.
 */
export function partition1D(values: readonly number[], kWanted: number): number[] {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [];
  const k = Math.max(1, Math.min(kWanted, n));
  if (k === 1) return [mean(sorted)];

  const ss = new Array<number>(n + 1).fill(0);
  const sq = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i += 1) {
    ss[i + 1] = ss[i]! + sorted[i]!;
    sq[i + 1] = sq[i]! + sorted[i]! * sorted[i]!;
  }
  const cost = (lo: number, hi: number) => {
    const count = hi - lo + 1;
    const sum = ss[hi + 1]! - ss[lo]!;
    const sumSq = sq[hi + 1]! - sq[lo]!;
    return sumSq - (sum * sum) / count;
  };

  const inf = Number.POSITIVE_INFINITY;
  const dp: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n).fill(inf));
  const prev: number[][] = Array.from({ length: k + 1 }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i += 1) dp[1]![i] = cost(0, i);

  for (let c = 2; c <= k; c += 1) {
    for (let i = c - 1; i < n; i += 1) {
      for (let t = c - 2; t < i; t += 1) {
        const total = dp[c - 1]![t]! + cost(t + 1, i);
        if (total < dp[c]![i]!) {
          dp[c]![i] = total;
          prev[c]![i] = t;
        }
      }
    }
  }

  const centroids: number[] = [];
  let end = n - 1;
  for (let c = k; c >= 1; c -= 1) {
    const start = c === 1 ? 0 : prev[c]![end]! + 1;
    centroids.push(mean(sorted.slice(start, end + 1)));
    end = start - 1;
  }
  return centroids.reverse();
}

export function nearestIndex(value: number, centroids: readonly number[]): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < centroids.length; i += 1) {
    const dist = Math.abs(value - centroids[i]!);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export function classifyMarkByRatio(length: number, unit: number): MarkSymbol {
  const ratio = length / (unit > 0 ? unit : 1);
  if (ratio >= FALLBACK_MARK_BOUNDS.zero) return EXTRA_LONG_DASH;
  if (ratio >= FALLBACK_MARK_BOUNDS.long) return LONG_DASH;
  if (ratio >= FALLBACK_MARK_BOUNDS.dash) return '-';
  return '.';
}

export function classifyGapByRatio(length: number, unit: number): GapClass {
  const ratio = length / (unit > 0 ? unit : 1);
  if (ratio >= FALLBACK_GAP_BOUNDS.word) return 'word';
  if (ratio >= FALLBACK_GAP_BOUNDS.letter) return 'letter';
  if (ratio >= FALLBACK_GAP_BOUNDS.internal) return 'internal';
  return 'element';
}

function classifyFromFullClusters<T extends string>(
  length: number,
  samples: readonly number[],
  labels: readonly T[],
  fallback: (value: number, unit: number) => T,
  unit: number,
): T {
  const groups = clusterSorted(samples);
  if (groups.length >= labels.length) {
    const centroids = groups.slice(0, labels.length).map(mean);
    return labels[nearestIndex(length, centroids)]!;
  }
  return fallback(length, unit);
}

/**
 * Adaptive timing tracker. The dot unit is the shortest recent mark after a
 * bootstrap that relates the first mark to the seed so an opening dash/L/0
 * is not mistaken for a dot.
 */
export function createAmericanRunTracker(initial: number, locked = false) {
  const marks: number[] = [];
  const gaps: number[] = [];
  let markUnit = initial;

  const minOf = (list: readonly number[]) => (list.length === 0 ? 0 : Math.min(...list));

  const learnMark = (length: number): number => {
    if (locked) return markUnit;
    if (marks.length === 0) {
      const ratio = length / (markUnit > 0 ? markUnit : 1);
      if (ratio >= FALLBACK_MARK_BOUNDS.zero) markUnit = length / 6;
      else if (ratio >= FALLBACK_MARK_BOUNDS.long) markUnit = length / 4;
      else if (ratio >= FALLBACK_MARK_BOUNDS.dash) markUnit = length / 2;
      else markUnit = length;
    }
    marks.push(length);
    if (marks.length > MARK_WINDOW) marks.shift();
    const shortest = minOf(marks);
    // Adopt the shortest mark only when it still looks like a dot. Otherwise
    // an opening dash/L/0 would become the unit and later dashes would read
    // as dots (G → D, L0 → one unknown letter).
    if (shortest < markUnit * FALLBACK_MARK_BOUNDS.dash) markUnit = shortest;
    return markUnit;
  };

  const learnGap = (length: number) => {
    if (locked || length <= 0) return;
    gaps.push(length);
    if (gaps.length > GAP_WINDOW) gaps.shift();
  };

  return {
    learnMark,
    learnGap,
    mark: () => markUnit,
    classifyMark: (length: number): MarkSymbol => {
      if (locked) return classifyMarkByRatio(length, markUnit);
      return classifyFromFullClusters(length, marks, MARK_BY_INDEX, classifyMarkByRatio, markUnit);
    },
    classifyGap: (length: number): GapClass => {
      if (locked) return classifyGapByRatio(length, markUnit);
      return classifyFromFullClusters(length, gaps, GAP_BY_INDEX, classifyGapByRatio, markUnit);
    },
    reset: () => {
      marks.length = 0;
      gaps.length = 0;
      markUnit = initial;
    },
  };
}

export type AmericanRunTracker = ReturnType<typeof createAmericanRunTracker>;

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

export function collapseFlags(flags: readonly boolean[]): LengthRun[] {
  return collapseLabeledRuns(flags.map((on) => ({ type: on ? 'mark' : 'space', length: 1 })));
}

/** Letters joined with `/`, words with `//`. Empty words dropped. */
export function formatAmericanMorse(words: readonly (readonly string[])[]): string {
  return words
    .map((word) => word.join('/'))
    .filter((word) => word.length > 0)
    .join('//');
}
