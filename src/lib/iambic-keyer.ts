import type { MorseKeyEvent, MorseMark } from './morse-key-events';

export type IambicSide = 'dot' | 'dash';

export type IambicClock = {
  now: () => number;
};

export type IambicKeyerOptions = {
  clock: IambicClock;
  /** PARIS WPM. Clamped to 5–40, same range as the homepage player. Default 20. */
  wpm?: number;
};

/**
 * Iambic A: no squeeze memory. While both paddles are held the keyer alternates
 * opposite elements after each one finishes. Releasing a paddle (or both)
 * during an element lets that element finish, then the keyer sends the next
 * element only if a paddle is still closed. Releasing both during the
 * inter-element space stops; it does not queue an extra opposite element
 * (that extra element would be Iambic B).
 *
 * A true simultaneous close (both paddles rising from idle in one setPaddles
 * call) starts on dit. If the paddles close as two paddleDown calls at the
 * same clock time, the first call chooses the starting element.
 */
export const IAMBIC_MODE = 'A' as const;

export const DEFAULT_IAMBIC_WPM = 20;
export const IAMBIC_WPM_MIN = 5;
export const IAMBIC_WPM_MAX = 40;

export type IambicKeyer = {
  paddleDown: (side: IambicSide) => MorseKeyEvent[];
  paddleUp: (side: IambicSide) => MorseKeyEvent[];
  setPaddles: (dot: boolean, dash: boolean) => MorseKeyEvent[];
  tick: () => MorseKeyEvent[];
  events: () => MorseKeyEvent[];
  clear: () => void;
  unitMs: number;
};

export type IambicScriptStep =
  | { t: number; action: 'down' | 'up'; side: IambicSide }
  | { t: number; action: 'set'; dot: boolean; dash: boolean };

export function clampIambicWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return DEFAULT_IAMBIC_WPM;
  return Math.min(IAMBIC_WPM_MAX, Math.max(IAMBIC_WPM_MIN, wpm));
}

/** Standard Morse unit: 1200 / WPM milliseconds. */
export function iambicUnitMs(wpm: number = DEFAULT_IAMBIC_WPM): number {
  return 1200 / clampIambicWpm(wpm);
}

export function createIambicKeyer(options: IambicKeyerOptions): IambicKeyer {
  const unitMs = iambicUnitMs(options.wpm ?? DEFAULT_IAMBIC_WPM);
  const dotMs = unitMs;
  const dashMs = 3 * unitMs;
  const elementSpaceMs = unitMs;
  const letterSpaceMs = 3 * unitMs;
  const wordSpaceMs = 7 * unitMs;

  let dotHeld = false;
  let dashHeld = false;
  let firstHeld: IambicSide | null = null;
  let lastMark: MorseMark | null = null;
  let sendingUntil: number | null = null;
  let spaceUntil: number | null = null;
  let idleFrom: number | null = null;
  let letterGapEmitted = false;
  let wordGapEmitted = false;
  const all: MorseKeyEvent[] = [];

  const pickNext = (): MorseMark | null => {
    if (dotHeld && dashHeld) {
      if (lastMark === '.') return '-';
      if (lastMark === '-') return '.';
      return firstHeld === 'dash' ? '-' : '.';
    }
    if (dotHeld) return '.';
    if (dashHeld) return '-';
    return null;
  };

  const startMark = (mark: MorseMark, at: number) => {
    all.push({ kind: 'mark', mark });
    lastMark = mark;
    sendingUntil = at + (mark === '.' ? dotMs : dashMs);
    spaceUntil = null;
    idleFrom = null;
    letterGapEmitted = false;
    wordGapEmitted = false;
  };

  const emitIdleGaps = (now: number) => {
    if (idleFrom === null) return;
    const letterDue = idleFrom + letterSpaceMs;
    const wordDue = idleFrom + wordSpaceMs;
    if (!letterGapEmitted && now >= letterDue) {
      all.push({ kind: 'gap', gap: 'letter' });
      letterGapEmitted = true;
    }
    if (!wordGapEmitted && letterGapEmitted && now >= wordDue) {
      all.push({ kind: 'gap', gap: 'word' });
      wordGapEmitted = true;
    }
  };

  const drain = (): MorseKeyEvent[] => {
    const now = options.clock.now();
    const startLen = all.length;

    for (let i = 0; i < 10_000; i += 1) {
      if (sendingUntil !== null) {
        if (now < sendingUntil) break;
        const ended = sendingUntil;
        sendingUntil = null;
        if (pickNext()) {
          spaceUntil = ended + elementSpaceMs;
          all.push({ kind: 'gap', gap: 'element' });
          continue;
        }
        idleFrom = ended;
        lastMark = null;
        letterGapEmitted = false;
        wordGapEmitted = false;
        continue;
      }

      if (spaceUntil !== null) {
        if (now < spaceUntil) break;
        const spaceEnd = spaceUntil;
        spaceUntil = null;
        const next = pickNext();
        if (next) {
          startMark(next, spaceEnd);
          continue;
        }
        idleFrom = spaceEnd - elementSpaceMs;
        lastMark = null;
        letterGapEmitted = false;
        wordGapEmitted = false;
        continue;
      }

      const next = pickNext();
      if (next) {
        if (idleFrom !== null) {
          const gap = now - idleFrom;
          if (gap >= wordSpaceMs) {
            emitIdleGaps(now);
          } else if (gap >= letterSpaceMs) {
            if (!letterGapEmitted) {
              all.push({ kind: 'gap', gap: 'letter' });
              letterGapEmitted = true;
            }
          } else if (gap > 0 && all.length > 0) {
            all.push({ kind: 'gap', gap: 'element' });
          }
        }
        startMark(next, now);
        continue;
      }

      emitIdleGaps(now);
      break;
    }

    return all.slice(startLen);
  };

  const setPaddles = (dot: boolean, dash: boolean): MorseKeyEvent[] => {
    const startLen = all.length;
    drain();
    const wasIdle = !dotHeld && !dashHeld;
    if (wasIdle && (dot || dash)) {
      firstHeld = dot && dash ? 'dot' : dot ? 'dot' : 'dash';
    }
    if (!dot && !dash) firstHeld = null;
    dotHeld = dot;
    dashHeld = dash;
    drain();
    return all.slice(startLen);
  };

  return {
    unitMs,
    paddleDown(side) {
      return side === 'dot' ? setPaddles(true, dashHeld) : setPaddles(dotHeld, true);
    },
    paddleUp(side) {
      return side === 'dot' ? setPaddles(false, dashHeld) : setPaddles(dotHeld, false);
    },
    setPaddles,
    tick: drain,
    events: () => all.slice(),
    clear() {
      dotHeld = false;
      dashHeld = false;
      firstHeld = null;
      lastMark = null;
      sendingUntil = null;
      spaceUntil = null;
      idleFrom = null;
      letterGapEmitted = false;
      wordGapEmitted = false;
      all.length = 0;
    },
  };
}

export function runIambicScript(
  script: readonly IambicScriptStep[],
  options: { wpm?: number; until?: number } = {},
): MorseKeyEvent[] {
  const wpm = options.wpm ?? DEFAULT_IAMBIC_WPM;
  const unitMs = iambicUnitMs(wpm);
  let time = 0;
  const keyer = createIambicKeyer({ clock: { now: () => time }, wpm });
  const sorted = [...script].sort((a, b) => a.t - b.t);

  for (const step of sorted) {
    time = step.t;
    if (step.action === 'set') keyer.setPaddles(step.dot, step.dash);
    else if (step.action === 'down') keyer.paddleDown(step.side);
    else keyer.paddleUp(step.side);
  }

  const lastT = sorted.length > 0 ? sorted[sorted.length - 1]!.t : 0;
  time = options.until ?? lastT + 10 * unitMs;
  keyer.tick();
  return keyer.events();
}
