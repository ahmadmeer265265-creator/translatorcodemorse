import { describe, expect, it } from 'vitest';
import {
  FALLBACK_GAP_BOUNDS,
  FALLBACK_MARK_BOUNDS,
  classifyGapByRatio,
  classifyMarkByRatio,
  clusterSorted,
  createAmericanRunTracker,
  formatAmericanMorse,
  partition1D,
} from './american-morse-runs';

const UNITS = [40, 60, 80, 120, 200] as const;

describe('1D clustering', () => {
  it('partitions four mark buckets at several speeds', () => {
    for (const unit of UNITS) {
      const samples = [1, 1, 1, 2, 2, 2, 4, 4, 6, 6].map((ratio) => ratio * unit);
      const centroids = partition1D(samples, 4);
      expect(centroids).toHaveLength(4);
      expect(centroids[0]!).toBeCloseTo(unit, 0);
      expect(centroids[1]!).toBeCloseTo(2 * unit, 0);
      expect(centroids[2]!).toBeCloseTo(4 * unit, 0);
      expect(centroids[3]!).toBeCloseTo(6 * unit, 0);
    }
  });

  it('keeps natural-break clusters in duration order across speeds', () => {
    for (const unit of UNITS) {
      const groups = clusterSorted([unit, unit * 2, unit * 2.05, unit * 4, unit * 6]);
      expect(groups).toHaveLength(4);
      expect(groups[0]![0]).toBe(unit);
      expect(groups[3]![0]).toBe(unit * 6);
    }
  });
});

describe('ratio fallback (ordering only, not a ms schedule)', () => {
  it('classifies dot / dash / L / 0 at several speeds', () => {
    for (const unit of UNITS) {
      expect(classifyMarkByRatio(unit, unit)).toBe('.');
      expect(classifyMarkByRatio(unit * 2, unit)).toBe('-');
      expect(classifyMarkByRatio(unit * 4, unit)).toBe('=');
      expect(classifyMarkByRatio(unit * 6, unit)).toBe('_');
      expect(classifyMarkByRatio(unit * FALLBACK_MARK_BOUNDS.dash - 1, unit)).toBe('.');
    }
  });

  it('classifies the four gap tiers at several speeds', () => {
    for (const unit of UNITS) {
      expect(classifyGapByRatio(unit, unit)).toBe('element');
      expect(classifyGapByRatio(unit * 2, unit)).toBe('internal');
      expect(classifyGapByRatio(unit * 3.5, unit)).toBe('letter');
      expect(classifyGapByRatio(unit * 7, unit)).toBe('word');
      expect(classifyGapByRatio(unit * FALLBACK_GAP_BOUNDS.internal - 0.01, unit)).toBe('element');
    }
  });

  it('still splits Morse Code World-ish L=4u from 0=5u', () => {
    const unit = 100;
    expect(classifyMarkByRatio(400, unit)).toBe('=');
    expect(classifyMarkByRatio(500, unit)).toBe('_');
  });
});

describe('adaptive tracker', () => {
  it('learns the dot unit from short marks and then classifies a dash', () => {
    const tracker = createAmericanRunTracker(200);
    expect(tracker.classifyMark(80)).toBe('.');
    tracker.learnMark(80);
    expect(tracker.mark()).toBeCloseTo(80, 5);
    expect(tracker.classifyMark(160)).toBe('-');
  });

  it('bootstraps an opening long dash against the seed', () => {
    const tracker = createAmericanRunTracker(80);
    expect(tracker.classifyMark(320)).toBe('=');
    tracker.learnMark(320);
    expect(tracker.classifyMark(80)).toBe('.');
  });

  it('uses clustered mark bounds once all four lengths have been seen', () => {
    const tracker = createAmericanRunTracker(50);
    for (const length of [50, 100, 200, 300, 50, 100, 200, 300]) tracker.learnMark(length);
    expect(tracker.classifyMark(50)).toBe('.');
    expect(tracker.classifyMark(100)).toBe('-');
    expect(tracker.classifyMark(200)).toBe('=');
    expect(tracker.classifyMark(300)).toBe('_');
  });
});

describe('formatAmericanMorse', () => {
  it('joins letters with / and words with //', () => {
    expect(formatAmericanMorse([['....', '.', '='], ['.--']])).toBe('...././=//.--');
  });
});
