/**
 * Pure image → Morse-string decoder.
 *
 * Input is an ImageData-shaped buffer `{ data, width, height }`. No canvas,
 * no network, no text decode — the string is what the homepage translator
 * already accepts in Morse-to-Text mode.
 *
 * Result shapes (stable for later UI stages):
 *
 * Nothing detected
 * `{ status: 'nothing-detected', morse: '', polarity, band: null, marks: [],
 *    reason: 'no-foreground' | 'no-band' | 'ambiguous-bands' | 'no-marks' | 'noise' }`
 * `polarity` is the polarity that was applied (auto or the override).
 * `ambiguous-bands` means two horizontal ink bands were too close in weight
 * to pick one. `noise` means the chosen band's runs are salt-and-pepper.
 *
 * Too small (1×1, 2×2, or a short buffer)
 * `{ status: 'too-small', morse: '', polarity: null, band: null, marks: [], reason: 'too-small' }`
 *
 * Success, including an ambiguous mark
 * `{ status: 'ok', morse, polarity, band: { y0, y1 }, marks, reason: undefined }`
 * Each mark is `{ index, symbol, width, ratio, ambiguous }`.
 * `ambiguous: true` means `ratio` is within AMBIGUITY_BAND (0.25) of the
 * dot/dash boundary at 2. `symbol` is still the nearest class (boundary → dash).
 */
import {
  AMBIGUITY_BAND,
  DASH_RATIO,
  classifyGap,
  classifyMarkDetailed,
  collapseFlags,
  formatMorseTokens,
  type LengthRun,
} from './morse-runs';

export { AMBIGUITY_BAND, DASH_RATIO };

/** Longer side is not capped here; the browser wrapper caps width. */
export const IMAGE_MORSE_MAX_WIDTH = 2000;

/**
 * Pure pixel-math budget for a downscaled frame. Under this, a click can
 * run the decode on the main thread and still feel immediate.
 */
export const IMAGE_MORSE_BUDGET_MS = 200;

/** A column counts as ink when at least this fraction of the band is foreground. */
const COLUMN_FILL = 0.35;

/** A row joins the band hunt when at least this fraction of its pixels are ink. */
const ROW_ACTIVE = 0.015;

/** A second band this close to the winner is treated as ambiguous, not a guess. */
const SECOND_BAND_RATIO = 0.5;

/**
 * Marks shorter than this fraction of the estimated unit are crumbs
 * (speckle, blur fringe) and are folded back into the surrounding gap.
 * Scale-free: a 3px dot and a 30px dot both sit at ratio 1, well above it.
 */
const CRUMB_RATIO = 0.45;

const MIN_EDGE = 3;

export type ImagePixels = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type ImagePolarity = 'dark-on-light' | 'light-on-dark';

export type ImagePolarityMode = 'auto' | ImagePolarity;

export type ImageMorseStatus = 'ok' | 'nothing-detected' | 'too-small';

export type ImageMorseReason =
  | 'too-small'
  | 'no-foreground'
  | 'no-band'
  | 'ambiguous-bands'
  | 'no-marks'
  | 'noise';

export type ImageMorseMark = {
  /** Left-to-right index among marks that were kept. */
  index: number;
  symbol: '.' | '-';
  /** Run width in pixels. */
  width: number;
  /** width / estimated dot unit. */
  ratio: number;
  ambiguous: boolean;
};

export type ImageMorseBand = {
  /** Inclusive start row. */
  y0: number;
  /** Exclusive end row. */
  y1: number;
};

export type ImageMorseResult = {
  status: ImageMorseStatus;
  morse: string;
  polarity: ImagePolarity | null;
  band: ImageMorseBand | null;
  marks: ImageMorseMark[];
  reason?: ImageMorseReason;
};

export type DecodeImageOptions = {
  /**
   * `auto` (default) picks polarity from Otsu plus the corner patches.
   * `dark-on-light` / `light-on-dark` skip that choice and force which
   * side of the Otsu threshold is a mark.
   */
  polarity?: ImagePolarityMode;
};

function emptyResult(
  status: ImageMorseStatus,
  polarity: ImagePolarity | null,
  reason: ImageMorseReason,
): ImageMorseResult {
  return { status, morse: '', polarity, band: null, marks: [], reason };
}

function grayscale(image: ImagePixels): Uint8Array {
  const { data, width, height } = image;
  const gray = new Uint8Array(width * height);
  const pixels = width * height;
  for (let p = 0, i = 0; p < pixels; p += 1, i += 4) {
    if (data[i + 3]! < 128) {
      gray[p] = 255;
      continue;
    }
    // BT.601 integer form: 0.299/0.587/0.114, coefficients sum to 256.
    gray[p] = (77 * data[i]! + 150 * data[i + 1]! + 29 * data[i + 2]! + 128) >> 8;
  }
  return gray;
}

/**
 * Otsu's threshold: the gray level that maximises between-class variance.
 * Returns the lowest such level when several are tied (pure black/white
 * lands on 0, and `gray <= 0` still selects the black pixels).
 */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]!]! += 1;

  let total = 0;
  let sumAll = 0;
  for (let level = 0; level < 256; level += 1) {
    total += hist[level]!;
    sumAll += level * hist[level]!;
  }
  if (total === 0) return 0;

  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  let threshold = 0;

  for (let level = 0; level < 256; level += 1) {
    weightBackground += hist[level]!;
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += level * hist[level]!;
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > bestVariance) {
      bestVariance = between;
      threshold = level;
    }
  }
  return threshold;
}

/**
 * Auto polarity from the four corner patches.
 * A loosely cropped page shows its background in the corners; the marks
 * almost never fill all four. Corner mean above the Otsu threshold means
 * the page is light, so the marks are the dark class.
 */
function autoPolarity(gray: Uint8Array, width: number, height: number, threshold: number): ImagePolarity {
  const patch = Math.max(1, Math.min(8, Math.floor(width / 5), Math.floor(height / 5)));
  const origins = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ];
  let sum = 0;
  let count = 0;
  for (const [x0, y0] of origins) {
    for (let y = y0!; y < y0! + patch; y += 1) {
      const row = y * width;
      for (let x = x0!; x < x0! + patch; x += 1) {
        sum += gray[row + x]!;
        count += 1;
      }
    }
  }
  const mean = count === 0 ? 255 : sum / count;
  return mean > threshold ? 'dark-on-light' : 'light-on-dark';
}

function foregroundMask(gray: Uint8Array, threshold: number, polarity: ImagePolarity): Uint8Array {
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) {
    const dark = gray[i]! <= threshold;
    mask[i] = polarity === 'dark-on-light' ? (dark ? 1 : 0) : dark ? 0 : 1;
  }
  return mask;
}

type Band = { y0: number; y1: number; score: number };

function findBand(mask: Uint8Array, width: number, height: number): Band | 'none' | 'ambiguous' {
  const counts = new Uint32Array(height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let count = 0;
    for (let x = 0; x < width; x += 1) count += mask[row + x]!;
    counts[y] = count;
  }

  const rowMin = Math.max(2, Math.floor(width * ROW_ACTIVE));
  const bands: Band[] = [];
  let y = 0;
  while (y < height) {
    if (counts[y]! < rowMin) {
      y += 1;
      continue;
    }
    const y0 = y;
    let score = 0;
    while (y < height && counts[y]! >= rowMin) {
      score += counts[y]!;
      y += 1;
    }
    bands.push({ y0, y1: y, score });
  }

  if (bands.length === 0) return 'none';
  bands.sort((a, b) => b.score - a.score);
  const best = bands[0]!;
  const next = bands[1];
  if (next && next.score >= best.score * SECOND_BAND_RATIO) return 'ambiguous';
  return best;
}

function columnFlags(mask: Uint8Array, width: number, band: Band): boolean[] {
  const height = band.y1 - band.y0;
  const need = Math.max(1, Math.ceil(height * COLUMN_FILL));
  const flags: boolean[] = new Array(width);
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    for (let y = band.y0; y < band.y1; y += 1) count += mask[y * width + x]!;
    flags[x] = count >= need;
  }
  return flags;
}

function trimSpaces(runs: LengthRun[]): LengthRun[] {
  let start = 0;
  let end = runs.length;
  while (start < end && runs[start]!.type === 'space') start += 1;
  while (end > start && runs[end - 1]!.type === 'space') end -= 1;
  return runs.slice(start, end);
}

/**
 * Batch dot-unit.
 * Mixed widths (max >= 2× min) → the shortest kept mark is the dot, which is
 * the steady state of the shared streaming tracker once a real dot has been seen.
 * One width class → compare that width to the stroke height. A dash is about
 * 3× as wide as the stroke is tall; a dot is about as wide as the stroke.
 * If the stroke is unavailable, fall back to the nearest 1× or 3× ratio
 * against the shortest internal gap.
 */
function estimateDotUnit(markLengths: readonly number[], gapLengths: readonly number[], stroke: number): number {
  const sorted = [...markLengths].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1;
  const kept = markLengths.filter((length) => length >= median * 0.4);
  const sample = kept.length > 0 ? kept : markLengths;
  const minMark = Math.min(...sample);
  const maxMark = Math.max(...sample);

  if (sample.length >= 2 && maxMark >= minMark * DASH_RATIO) return minMark;

  const strokePx = Math.max(1, stroke);
  if (minMark >= strokePx * DASH_RATIO) return Math.max(1, minMark / 3);

  if (gapLengths.length > 0) {
    const minGap = Math.min(...gapLengths);
    const asDot = Math.abs(minMark - minGap);
    const asDash = Math.abs(minMark - minGap * 3);
    if (minMark >= minGap * DASH_RATIO && asDash < asDot) return Math.max(1, minMark / 3);
  }
  return Math.max(1, minMark);
}

/**
 * Solid strokes (bars, circles, a printed dash) put their ink in one vertical
 * run, so the longest run is the whole foreground count. Salt-and-pepper
 * spreads the same count into many short runs. Median of that ratio across
 * mark columns; below this, the band is noise rather than a line of marks.
 */
const MIN_MARK_COHERENCE = 0.72;

function markCoherence(mask: Uint8Array, width: number, band: Band): number | null {
  const height = band.y1 - band.y0;
  const need = Math.max(1, Math.ceil(height * COLUMN_FILL));
  const scores: number[] = [];
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    let longest = 0;
    let run = 0;
    for (let y = band.y0; y < band.y1; y += 1) {
      if (mask[y * width + x]) {
        count += 1;
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    if (count >= need) scores.push(longest / count);
  }
  if (scores.length === 0) return null;
  scores.sort((a, b) => a - b);
  return scores[Math.floor(scores.length / 2)] ?? null;
}

function foldCrumbs(runs: readonly LengthRun[], unit: number): LengthRun[] {
  const floor = unit * CRUMB_RATIO;
  const folded: LengthRun[] = [];
  for (const run of runs) {
    const type = run.type === 'mark' && run.length < floor ? 'space' : run.type;
    const last = folded[folded.length - 1];
    if (last && last.type === type) last.length += run.length;
    else folded.push({ type, length: run.length });
  }
  return folded;
}

function assemble(runs: readonly LengthRun[], unit: number): { morse: string; marks: ImageMorseMark[] } {
  const marks: ImageMorseMark[] = [];
  const words: string[][] = [[]];
  let letter = '';

  for (const run of runs) {
    if (run.type === 'mark') {
      const classified = classifyMarkDetailed(run.length, unit);
      marks.push({
        index: marks.length,
        symbol: classified.symbol,
        width: run.length,
        ratio: classified.ratio,
        ambiguous: classified.ambiguous,
      });
      letter += classified.symbol;
      continue;
    }
    const gap = classifyGap(run.length, unit);
    if (gap === 'intra') continue;
    if (letter) {
      words[words.length - 1]!.push(letter);
      letter = '';
    }
    if (gap === 'word' && words[words.length - 1]!.length > 0) words.push([]);
  }
  if (letter) words[words.length - 1]!.push(letter);

  return { morse: formatMorseTokens(words), marks };
}

export function decodeImage(image: ImagePixels, options: DecodeImageOptions = {}): ImageMorseResult {
  const width = image.width;
  const height = image.height;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < MIN_EDGE ||
    height < MIN_EDGE ||
    image.data.length < width * height * 4
  ) {
    return emptyResult('too-small', null, 'too-small');
  }

  const gray = grayscale(image);
  const threshold = otsuThreshold(gray);
  const requested = options.polarity ?? 'auto';
  const polarity = requested === 'auto' ? autoPolarity(gray, width, height, threshold) : requested;
  const mask = foregroundMask(gray, threshold, polarity);

  let ink = 0;
  for (let i = 0; i < mask.length; i += 1) ink += mask[i]!;
  if (ink === 0) return emptyResult('nothing-detected', polarity, 'no-foreground');

  const band = findBand(mask, width, height);
  if (band === 'none') return emptyResult('nothing-detected', polarity, 'no-band');
  if (band === 'ambiguous') return emptyResult('nothing-detected', polarity, 'ambiguous-bands');

  let runs = trimSpaces(collapseFlags(columnFlags(mask, width, band)));
  if (!runs.some((run) => run.type === 'mark')) {
    return emptyResult('nothing-detected', polarity, 'no-marks');
  }
  const coherence = markCoherence(mask, width, band);
  if (coherence !== null && coherence < MIN_MARK_COHERENCE) {
    return emptyResult('nothing-detected', polarity, 'noise');
  }

  const markLengths = runs.filter((run) => run.type === 'mark').map((run) => run.length);
  const gapLengths = runs.filter((run) => run.type === 'space').map((run) => run.length);
  const unit = estimateDotUnit(markLengths, gapLengths, band.y1 - band.y0);
  runs = trimSpaces(foldCrumbs(runs, unit));
  if (!runs.some((run) => run.type === 'mark')) {
    return emptyResult('nothing-detected', polarity, 'no-marks');
  }

  const assembled = assemble(runs, unit);
  if (!assembled.morse) return emptyResult('nothing-detected', polarity, 'no-marks');

  return {
    status: 'ok',
    morse: assembled.morse,
    polarity,
    band: { y0: band.y0, y1: band.y1 },
    marks: assembled.marks,
  };
}
