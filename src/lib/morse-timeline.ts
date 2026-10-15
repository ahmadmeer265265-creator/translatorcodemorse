import { clampSpeed, type Segment, type TimelineOptions } from './morse-audio';
import { parseMorseGroups, type MorseGroupSpan } from './morse-highlight';

export type TimedSegment = Segment & {
  /** Index into parseMorseGroups result, or -1 for gaps */
  groupIndex: number;
};

export type EnrichedTimeline = {
  segments: TimedSegment[];
  groups: MorseGroupSpan[];
  /** Start time (ms) of each group's sounding (first mark of that letter) */
  groupStartMs: number[];
  /** Duration (ms) covering that group's marks and intra-character gaps */
  groupDurationMs: number[];
};

export function buildEnrichedTimeline(morse: string, options: TimelineOptions): EnrichedTimeline {
  const groups = parseMorseGroups(morse);
  const { wpm, farnsworthWpm } = clampSpeed(options.wpm, options.farnsworthWpm);
  const unit = 1200 / wpm;
  const stretched = farnsworthWpm < wpm;
  const letterGap = stretched ? farnsworthGapMs(wpm, farnsworthWpm, 3) : 3 * unit;
  const wordGap = stretched ? farnsworthGapMs(wpm, farnsworthWpm, 7) : 7 * unit;

  const segments: TimedSegment[] = [];
  const groupStartMs: number[] = groups.map(() => -1);
  const groupDurationMs: number[] = groups.map(() => 0);
  let elapsed = 0;

  const push = (on: boolean, ms: number, groupIndex: number) => {
    segments.push({ on, ms, groupIndex });
    if (groupIndex >= 0) {
      if (groupStartMs[groupIndex] < 0) groupStartMs[groupIndex] = elapsed;
      groupDurationMs[groupIndex] += ms;
    }
    elapsed += ms;
  };

  // Rebuild word structure with group indices by scanning Morse similarly to buildTimeline
  const marked = morse.replace(/\|/g, '/').replace(/ {3,}/g, ' / ');
  const words = marked.split('/');
  let groupCursor = 0;

  words.forEach((word, wordIndex) => {
    const tokens = word
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .map((token) => token.replace(/[·•]/g, '.').replace(/[–—−]/g, '-'))
      .filter((token) => token === '#' || /^[.-]+$/.test(token));

    if (tokens.length === 0) return;
    if (wordIndex > 0) push(false, wordGap, -1);

    tokens.forEach((code, letterIndex) => {
      if (letterIndex > 0) push(false, letterGap, -1);
      // Match to next group with same code
      while (groupCursor < groups.length && groups[groupCursor]!.code !== code) groupCursor += 1;
      const gIndex = groupCursor < groups.length ? groupCursor : -1;
      if (gIndex >= 0) groupCursor += 1;

      if (code === '#') {
        // Silent placeholder — no tones, but advance group timing with zero-length
        if (gIndex >= 0 && groupStartMs[gIndex] < 0) {
          groupStartMs[gIndex] = elapsed;
          groupDurationMs[gIndex] = 0;
        }
        return;
      }
      for (let index = 0; index < code.length; index += 1) {
        if (index > 0) push(false, unit, gIndex);
        push(true, (code[index] === '-' ? 3 : 1) * unit, gIndex);
      }
    });
  });

  return { segments, groups, groupStartMs, groupDurationMs };
}

function farnsworthGapMs(wpm: number, farnsworthWpm: number, units: number): number {
  const ta = (60 * wpm - 37.2 * farnsworthWpm) / (19 * wpm * farnsworthWpm);
  return units * ta * 1000;
}

export function segmentsOnly(enriched: EnrichedTimeline): Segment[] {
  return enriched.segments.map(({ on, ms }) => ({ on, ms }));
}
