/**
 * Pure American Morse audio-decode orchestration.
 *
 * Mirrors mic-decode.ts (envelope → segments → adaptive classifier → text)
 * without importing or modifying that file. Callers feed microphone or
 * uploaded-file envelopes the same way: samples in, letters out.
 */
import { AMERICAN_MORSE_ALPHABET, EXTRA_LONG_DASH, LONG_DASH } from './american-morse';
import {
  classifyGapByRatio,
  classifyMarkByRatio,
  createAmericanRunTracker,
  formatAmericanMorse,
  type GapClass,
  type MarkSymbol,
} from './american-morse-runs';

export { classifyGapByRatio as classifyGap, classifyMarkByRatio as classifyMark };
export type { GapClass, MarkSymbol };

const MORSE_TO_CHAR = new Map(AMERICAN_MORSE_ALPHABET.map((entry) => [entry.code, entry.char]));

/** Marks shorter than this are treated as noise and ignored. */
export const MIN_MARK_MS = 20;
/** Seed for the adaptive dot-unit estimate before any mark is seen. */
export const INITIAL_UNIT_MS = 200;

/**
 * Relative durations used by the envelope simulator only. Not a historical
 * standard — manuals disagree — but they respect the agreed ordering and stay
 * separable under the fallback bounds in american-morse-runs.ts.
 */
export type SynthRatios = {
  dot: number;
  dash: number;
  long: number;
  zero: number;
  element: number;
  internal: number;
  letter: number;
  word: number;
};

export const SYNTH_RATIOS: SynthRatios = {
  dot: 1,
  dash: 2,
  long: 4,
  zero: 6,
  element: 1,
  internal: 2,
  letter: 3.5,
  word: 7,
};

export type SegmentKind = 'mark' | 'space';

export type Segment = {
  type: SegmentKind;
  durationMs: number;
};

export type AmericanGapModel = {
  elementMs: number;
  internalMs: number;
  letterMs: number;
  wordMs: number;
};

export type DecodedLetter = {
  code: string;
  char: string;
};

export type AmericanMicEvent =
  | { kind: 'mark'; mark: MarkSymbol }
  | { kind: 'letter'; letter: DecodedLetter }
  | { kind: 'word' };

export type AmericanMicDecoderState = {
  marks: string;
  text: string;
  morse: string;
  events: AmericanMicEvent[];
};

export function isMarkSample(amplitude: number, threshold: number): boolean {
  return amplitude >= threshold;
}

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

export function classifyGapWithModel(durationMs: number, model: AmericanGapModel): GapClass {
  if (durationMs >= (model.letterMs + model.wordMs) / 2) return 'word';
  if (durationMs >= (model.internalMs + model.letterMs) / 2) return 'letter';
  if (durationMs >= (model.elementMs + model.internalMs) / 2) return 'internal';
  return 'element';
}

export type AmericanMicDecoder = {
  push: (segment: Segment) => AmericanMicDecoderState;
  silence: (durationMs: number) => AmericanMicDecoderState;
  flush: () => AmericanMicDecoderState;
  snapshot: () => AmericanMicDecoderState;
  reset: () => AmericanMicDecoderState;
};

export function createAmericanMicDecoder(
  options: {
    now?: () => number;
    initialUnitMs?: number;
    lockUnitMs?: number;
    gapModel?: AmericanGapModel;
  } = {},
): AmericanMicDecoder {
  let code = '';
  const unit = createAmericanRunTracker(
    options.lockUnitMs ?? options.initialUnitMs ?? INITIAL_UNIT_MS,
    options.lockUnitMs !== undefined,
  );
  const gapOf = (durationMs: number): GapClass =>
    options.gapModel ? classifyGapWithModel(durationMs, options.gapModel) : unit.classifyGap(durationMs);
  let text = '';
  let words: string[][] = [[]];
  let events: AmericanMicEvent[] = [];
  let pendingLetterBoundary = false;
  let pendingWordBoundary = false;
  let seenMark = false;

  const snap = (): AmericanMicDecoderState => ({
    marks: code,
    text,
    morse: formatAmericanMorse(words),
    events,
  });

  const closeLetter = () => {
    if (code.length === 0) return;
    const letterCode = code.replace(/\s+/g, ' ').trim();
    code = '';
    const char = letterCode === '#' ? '#' : (MORSE_TO_CHAR.get(letterCode) ?? '#');
    words[words.length - 1]!.push(letterCode);
    text += char;
    events.push({ kind: 'letter', letter: { code: letterCode, char } });
    pendingLetterBoundary = true;
  };

  const openWord = () => {
    if (text.length === 0 || text.endsWith(' ')) return;
    words.push([]);
    text += ' ';
    events.push({ kind: 'word' });
    pendingWordBoundary = true;
  };

  const applyGap = (gap: GapClass) => {
    if (gap === 'word') {
      closeLetter();
      if (!pendingWordBoundary) openWord();
    } else if (gap === 'letter') {
      if (!pendingLetterBoundary) closeLetter();
    } else if (gap === 'internal') {
      if (code.length > 0 && !code.endsWith(' ')) code += ' ';
    }
  };

  return {
    push(segment) {
      if (segment.type === 'mark') {
        if (segment.durationMs < MIN_MARK_MS) return snap();
        const mark = unit.classifyMark(segment.durationMs);
        code += mark;
        events.push({ kind: 'mark', mark });
        unit.learnMark(segment.durationMs);
        seenMark = true;
        pendingLetterBoundary = false;
        pendingWordBoundary = false;
        return snap();
      }

      if (!seenMark) return snap();
      const gap = gapOf(segment.durationMs);
      applyGap(gap);
      unit.learnGap(segment.durationMs);
      return snap();
    },
    silence(durationMs) {
      if (!seenMark) return snap();
      applyGap(gapOf(durationMs));
      return snap();
    },
    flush() {
      closeLetter();
      return snap();
    },
    snapshot: snap,
    reset() {
      code = '';
      unit.reset();
      text = '';
      words = [[]];
      events = [];
      pendingLetterBoundary = false;
      pendingWordBoundary = false;
      seenMark = false;
      return snap();
    },
  };
}

export type AmericanMorseToken =
  | { type: 'mark'; symbol: MarkSymbol }
  | { type: 'gap'; gap: GapClass };

const MARK_CHARS = new Set<string>(['.', '-', LONG_DASH, EXTRA_LONG_DASH]);

export function tokenizeAmericanMorse(morse: string): AmericanMorseToken[] {
  const tokens: AmericanMorseToken[] = [];
  let i = 0;
  while (i < morse.length) {
    const ch = morse[i]!;
    if (MARK_CHARS.has(ch)) {
      tokens.push({ type: 'mark', symbol: ch as MarkSymbol });
      i += 1;
      continue;
    }
    if (ch === '/' && morse[i + 1] === '/') {
      tokens.push({ type: 'gap', gap: 'word' });
      i += 2;
      continue;
    }
    if (ch === '/') {
      tokens.push({ type: 'gap', gap: 'letter' });
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      while (morse[i] === ' ' || morse[i] === '\t') i += 1;
      tokens.push({ type: 'gap', gap: 'internal' });
      continue;
    }
    i += 1;
  }

  const withElementGaps: AmericanMorseToken[] = [];
  for (const token of tokens) {
    const prev = withElementGaps[withElementGaps.length - 1];
    if (token.type === 'mark' && prev?.type === 'mark') {
      withElementGaps.push({ type: 'gap', gap: 'element' });
    }
    withElementGaps.push(token);
  }
  return withElementGaps;
}

export function segmentsFromAmericanMorse(
  morse: string,
  unitMs: number,
  ratios: SynthRatios = SYNTH_RATIOS,
): Segment[] {
  const markRatio: Record<MarkSymbol, number> = {
    '.': ratios.dot,
    '-': ratios.dash,
    [LONG_DASH]: ratios.long,
    [EXTRA_LONG_DASH]: ratios.zero,
  };
  const gapRatio: Record<GapClass, number> = {
    element: ratios.element,
    internal: ratios.internal,
    letter: ratios.letter,
    word: ratios.word,
  };
  return tokenizeAmericanMorse(morse).map((token) =>
    token.type === 'mark'
      ? { type: 'mark' as const, durationMs: unitMs * markRatio[token.symbol] }
      : { type: 'space' as const, durationMs: unitMs * gapRatio[token.gap] },
  );
}

export function decodeAmericanSegments(
  segments: readonly Segment[],
  options: Parameters<typeof createAmericanMicDecoder>[0] = {},
): AmericanMicDecoderState {
  const decoder = createAmericanMicDecoder(options);
  for (const segment of segments) decoder.push(segment);
  return decoder.flush();
}

/**
 * Build a sampled envelope from typed American Morse, then decode it.
 * `unitFn` may return a constant or a per-symbol unit to simulate drift.
 */
export function decodeAmericanMorseEnvelope(
  morse: string,
  unitMs: number | ((index: number) => number),
  options: { threshold?: number; sampleMs?: number; ratios?: SynthRatios } = {},
): AmericanMicDecoderState {
  const threshold = options.threshold ?? 0.5;
  const sampleMs = options.sampleMs ?? 10;
  const ratios = options.ratios ?? SYNTH_RATIOS;
  const seed = typeof unitMs === 'function' ? unitMs(0) : unitMs;

  const tokens = tokenizeAmericanMorse(morse);
  const timeline: Array<{ on: number; off: number }> = [];
  let symbolIndex = 0;
  const unitAt = () => (typeof unitMs === 'function' ? unitMs(symbolIndex) : unitMs);
  const markRatio: Record<MarkSymbol, number> = {
    '.': ratios.dot,
    '-': ratios.dash,
    [LONG_DASH]: ratios.long,
    [EXTRA_LONG_DASH]: ratios.zero,
  };
  const gapRatio: Record<GapClass, number> = {
    element: ratios.element,
    internal: ratios.internal,
    letter: ratios.letter,
    word: ratios.word,
  };

  for (const token of tokens) {
    const u = unitAt();
    if (token.type === 'mark') {
      timeline.push({ on: u * markRatio[token.symbol], off: 0 });
    } else {
      timeline.push({ on: 0, off: u * gapRatio[token.gap] });
    }
    symbolIndex += 1;
  }

  const samples: Array<readonly [number, number]> = [];
  let t = 0;
  samples.push([t, 0] as const);
  for (const sym of timeline) {
    if (sym.on > 0) {
      const steps = Math.max(1, Math.round(sym.on / sampleMs));
      for (let i = 0; i < steps; i += 1) {
        t += sym.on / steps;
        samples.push([t, 1] as const);
      }
    }
    if (sym.off > 0) {
      const steps = Math.max(1, Math.round(sym.off / sampleMs));
      for (let i = 0; i < steps; i += 1) {
        t += sym.off / steps;
        samples.push([t, 0] as const);
      }
    }
  }

  const segments = envelopeToSegments(samples, threshold);
  return decodeAmericanSegments(segments, { initialUnitMs: seed });
}
