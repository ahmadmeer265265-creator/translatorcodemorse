import { MORSE_ALPHABET } from './morse';

/**
 * Pure, injectable Morse decoding logic for microphone input.
 * No AudioContext / DOM access lives here so it is unit-testable with
 * synthetic (timestamp, amplitude) or pre-chunked envelope data.
 *
 * Timing model mirrors the site's CW convention (dash = 3 units, gaps of
 * 1 / 3 / 7 units). The decoder adapts to the sender's actual speed by
 * re-estimating the unit length from the recent mark durations, so no
 * fixed WPM has to be known in advance.
 */

const MORSE_TO_CHAR = new Map(MORSE_ALPHABET.map((entry) => [entry.code, entry.char]));

/** Marks shorter than this are treated as noise and ignored entirely. */
export const MIN_MARK_MS = 20;
/**
 * Rolling window of recent marks used to re-estimate the dot unit.
 * ~12 marks is roughly 3–4 letters, enough to adapt without overreacting.
 */
export const UNIT_WINDOW = 12;
/**
 * A mark is a dash when it lasts at least this multiple of the current dot
 * estimate (dot = 1, dash = 3, midpoint ≈ 2).
 */
export const DASH_RATIO = 2;
/**
 * Adaptive threshold for the very first marks, before any dot estimate
 * exists. 200ms is a common slow-sender dot; shorter sends are re-learned.
 */
export const INITIAL_UNIT_MS = 200;

export type SegmentKind = 'mark' | 'space';

export type Segment = {
  type: SegmentKind;
  durationMs: number;
};

export type GapClass = 'intra' | 'letter' | 'word';

/**
 * Absolute gap expectations in ms, used when the operator overrides speed
 * manually (e.g. fixed WPM plus a Farnsworth overall speed). Boundaries sit
 * at the geometric midpoints: intra/letter at (intra+letter)/2 and
 * letter/word at (letter+word)/2, mirroring classifyGap's ratio midpoints.
 */
export type GapModel = {
  intraMs: number;
  letterMs: number;
  wordMs: number;
};

export type DecodedLetter = {
  code: string;
  char: string;
};

export type MicEvent =
  | { kind: 'mark'; mark: '.' | '-' }
  | { kind: 'letter'; letter: DecodedLetter }
  | { kind: 'word' };

export type MicDecoderState = {
  /** Live dot/dash run for the letter currently being built. */
  marks: string;
  /** Decoded plain text so far. */
  text: string;
  /** Decoded Morse (letters spaced, words separated by slash). */
  morse: string;
  events: MicEvent[];
};

/** Pure threshold comparison: is this sample loud enough to count as a mark? */
export function isMarkSample(amplitude: number, threshold: number): boolean {
  return amplitude >= threshold;
}

/**
 * Collapse a stream of (timestamp, amplitude) samples into mark/space
 * segments. Two consecutive samples define one interval of
 * (t[i+1] - t[i])ms whose kind comes from isMarkSample(samples[i]).
 */
export function envelopeToSegments(
  samples: ReadonlyArray<readonly [timeMs: number, amplitude: number]>,
  threshold: number,
): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < samples.length; i += 1) {
    const [t0, amp] = samples[i]!;
    const [t1] = samples[i + 1]!;
    const durationMs = t1 - t0;
    if (durationMs <= 0) continue;
    const kind: SegmentKind = isMarkSample(amp, threshold) ? 'mark' : 'space';
    const last = segments[segments.length - 1];
    if (last && last.type === kind) last.durationMs += durationMs;
    else segments.push({ type: kind, durationMs });
  }
  return segments;
}

/**
 * Adaptive timing tracker. The dot unit is the shortest recent mark:
 * dashes only ever inflate an average, whereas the minimum tracks the true
 * dot. A bootstrap rule relates the very first mark to the seed so a first
 * dash is not mistaken for a dot. As marks arrive the estimate follows the
 * sender's speed up and down. Gaps are classified against this same unit
 * using the 1 / 3 / 7 CW ratios.
 */
function createUnitTracker(initialMs: number = INITIAL_UNIT_MS, locked = false) {
  const marks: number[] = [];
  let markUnit = initialMs;

  const min = (list: readonly number[]) => (list.length === 0 ? 0 : Math.min(...list));

  const learnMark = (durationMs: number): number => {
    // Locked unit (manual WPM override): never adapt to observed marks.
    if (locked) return markUnit;
    if (marks.length === 0) {
      // Bootstrap: relate the first mark to the seed before deciding.
      if (durationMs >= markUnit * DASH_RATIO) markUnit = durationMs / 3;
      else if (durationMs * DASH_RATIO <= markUnit) markUnit = durationMs;
    }
    marks.push(durationMs);
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
      markUnit = initialMs;
    },
  };
}

/** Classify one mark duration as dot or dash against the current unit. */
export function classifyMark(durationMs: number, unitMs: number): '.' | '-' {
  return durationMs >= unitMs * DASH_RATIO ? '-' : '.';
}

/**
 * Classify one space duration against the current unit. Nominal gaps are
 * 1 / 3 / 7 units; the intra/letter boundary sits at 2x (midpoint of 1 and 3)
 * and the letter/word boundary at 5x (midpoint of 3 and 7). A 2x letter floor
 * tolerates AnalyserNode / tone-ramp bleed that shortens measured gaps, which
 * a 2.5x floor mistook for intra-element spacing on real mic audio.
 */
export function classifyGap(durationMs: number, unitMs: number): GapClass {
  if (durationMs >= unitMs * 5) return 'word';
  if (durationMs >= unitMs * 2) return 'letter';
  return 'intra';
}

/** Classify a gap against absolute expectations instead of an adaptive unit. */
export function classifyGapWithModel(durationMs: number, model: GapModel): GapClass {
  if (durationMs >= (model.letterMs + model.wordMs) / 2) return 'word';
  if (durationMs >= (model.intraMs + model.letterMs) / 2) return 'letter';
  return 'intra';
}

export type MicDecoder = {
  /** Feed one mark/space segment; returns the updated state. */
  push: (segment: Segment) => MicDecoderState;
  /**
   * Report ongoing silence WITHOUT consuming it as a segment. Resolves a
   * letter/word boundary once the silence is long enough, but does not close
   * the gap — a later mark still sees the full accumulated silence. Use this
   * to decode a trailing letter while the sender is paused.
   */
  silence: (durationMs: number) => MicDecoderState;
  /** Close any pending letter (e.g. when listening stops). */
  flush: () => MicDecoderState;
  snapshot: () => MicDecoderState;
  reset: () => MicDecoderState;
};

export function createMicDecoder(
  options: {
    showSlash?: boolean;
    now?: () => number;
    /**
     * Seed for the adaptive dot-unit estimate (replaces INITIAL_UNIT_MS).
     * Used by file decoding when an approximate WPM is already known.
     */
    initialUnitMs?: number;
    /**
     * Fixed dot unit (manual WPM override). When set, the tracker never
     * adapts: dot/dash classification always uses exactly this unit.
     */
    lockUnitMs?: number;
    /**
     * Absolute gap expectations (manual Farnsworth override). When set,
     * spaces are classified against these values instead of the adaptive
     * unit ratios.
     */
    gapModel?: GapModel;
  } = {},
): MicDecoder {
  const showSlash = options.showSlash ?? true;
  const wordSep = showSlash ? ' / ' : '   ';

  let marks: Array<'.' | '-'> = [];
  const unit = createUnitTracker(
    options.lockUnitMs ?? options.initialUnitMs ?? INITIAL_UNIT_MS,
    options.lockUnitMs !== undefined,
  );
  const gapOf = (durationMs: number): GapClass =>
    options.gapModel ? classifyGapWithModel(durationMs, options.gapModel) : classifyGap(durationMs, unit.mark());
  let text = '';
  let words: string[][] = [[]];
  let events: MicEvent[] = [];
  /** True once a letter was decoded since the last mark began. */
  let pendingLetterBoundary = false;
  /** True once a word space was emitted since the last mark began. */
  let pendingWordBoundary = false;

  const rebuildMorse = () =>
    words
      .map((word) => word.join(' '))
      .filter((word) => word.length > 0)
      .join(wordSep);

  const snap = (): MicDecoderState => ({
    marks: marks.join(''),
    text,
    morse: rebuildMorse(),
    events,
  });

  const learnMark = (durationMs: number) => {
    unit.learnMark(durationMs);
  };

  const closeLetter = () => {
    if (marks.length === 0) return;
    const code = marks.join('');
    marks = [];
    const char = MORSE_TO_CHAR.get(code) ?? '#';
    words[words.length - 1]!.push(code);
    text += char;
    events.push({ kind: 'letter', letter: { code, char } });
    pendingLetterBoundary = true;
  };

  const openWord = () => {
    if (text.length === 0 || text.endsWith(' ')) return;
    words.push([]);
    text += ' ';
    events.push({ kind: 'word' });
    pendingWordBoundary = true;
  };

  return {
    push(segment) {
      if (segment.type === 'mark') {
        if (segment.durationMs < MIN_MARK_MS) {
          // Noise blip: ignore, do not disturb the current letter.
          return snap();
        }
        const mark = classifyMark(segment.durationMs, unit.mark());
        marks.push(mark);
        events.push({ kind: 'mark', mark });
        learnMark(segment.durationMs);
        pendingLetterBoundary = false;
        pendingWordBoundary = false;
        return snap();
      }

      // Space segment. The dot unit anchors both boundaries. A run's
      // nominal gaps are 1 / 3 / 7 units, so intra ends below ~2u and a
      // word gap begins at ~5u. An explicit gap model overrides the unit.
      const gap = gapOf(segment.durationMs);
      if (gap === 'word') {
        closeLetter();
        if (!pendingWordBoundary) openWord();
      } else if (gap === 'letter') {
        if (!pendingLetterBoundary) closeLetter();
      }
      // 'intra' gaps do nothing: the next mark extends the current letter.
      return snap();
    },
    silence(durationMs) {
      // Same boundary rules as a space segment, but only to resolve a
      // trailing letter/word while the sender is paused. Does not close the
      // gap — pendingLetterBoundary stops it re-firing on the next mark.
      const gap = gapOf(durationMs);
      if (gap === 'word') {
        closeLetter();
        if (!pendingWordBoundary) openWord();
      } else if (gap === 'letter') {
        if (!pendingLetterBoundary) closeLetter();
      }
      return snap();
    },
    flush() {
      closeLetter();
      return snap();
    },
    snapshot: snap,
    reset() {
      marks = [];
      unit.reset();
      text = '';
      words = [[]];
      events = [];
      pendingLetterBoundary = false;
      pendingWordBoundary = false;
      return snap();
    },
  };
}

export type TimedSymbol = { on: number; off: number };

/**
 * Deterministic test/decode helper: build a full (timestamp, amplitude)
 * envelope for a Morse string at a given dot length, then decode it.
 * `unitFn` may return a constant or a per-symbol unit to simulate drift.
 */
export function decodeMorseEnvelope(
  morse: string,
  unitMs: number | ((index: number) => number),
  options: { showSlash?: boolean; threshold?: number; sampleMs?: number } = {},
): MicDecoderState {
  const threshold = options.threshold ?? 0.5;
  const sampleMs = options.sampleMs ?? 10;
  const showSlash = options.showSlash ?? true;

  // 1. Build mark/space symbol list from the Morse string.
  const timeline: TimedSymbol[] = [];
  let symbolIndex = 0;
  const unit = () => (typeof unitMs === 'function' ? unitMs(symbolIndex) : unitMs);
  for (const char of morse) {
    if (char === '.' || char === '-') {
      const u = unit();
      timeline.push({ on: char === '.' ? u : u * 3, off: u });
    } else if (char === ' ') {
      timeline.push({ on: 0, off: unit() * 2 }); // intra already +1; letter gap total 3
    } else if (char === '/') {
      timeline.push({ on: 0, off: unit() * 4 }); // word gap total 7
    }
    if (char === '.' || char === '-' || char === ' ' || char === '/') symbolIndex += 1;
  }

  // 2. Sample the timeline into (time, amplitude) pairs.
  const samples: Array<readonly [number, number]> = [];
  let t = 0;
  samples.push([t, 0] as const);
  for (const sym of timeline) {
    const onMs = sym.on;
    const offMs = sym.off;
    if (onMs > 0) {
      const steps = Math.max(1, Math.round(onMs / sampleMs));
      for (let i = 0; i < steps; i += 1) {
        t += onMs / steps;
        samples.push([t, 1] as const);
      }
    }
    if (offMs > 0) {
      const steps = Math.max(1, Math.round(offMs / sampleMs));
      for (let i = 0; i < steps; i += 1) {
        t += offMs / steps;
        samples.push([t, 0] as const);
      }
    }
  }

  // 3. Envelope -> segments -> decoder.
  const segments = envelopeToSegments(samples, threshold);
  const decoder = createMicDecoder({ showSlash });
  for (const segment of segments) decoder.push(segment);
  return decoder.flush();
}
