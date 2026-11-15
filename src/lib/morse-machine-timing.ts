import {
  clampIambicWpm,
  DEFAULT_IAMBIC_WPM,
  IAMBIC_WPM_MAX,
  IAMBIC_WPM_MIN,
  iambicUnitMs,
} from './iambic-keyer';
import {
  eventsToMorse,
  eventsToText,
  type MorseGap,
  type MorseKeyEvent,
  type MorseMark,
} from './morse-key-events';

export const MACHINE_WPM_MIN = IAMBIC_WPM_MIN;
export const MACHINE_WPM_MAX = IAMBIC_WPM_MAX;
export const DEFAULT_MACHINE_WPM = DEFAULT_IAMBIC_WPM;

export const clampMachineWpm = clampIambicWpm;

export type MachineTiming = {
  wpm: number;
  unitMs: number;
  ditMs: number;
  dashMs: number;
  /** Midpoint between a 1-unit dit and a 3-unit dah. */
  dashThresholdMs: number;
  elementGapMs: number;
  letterGapMs: number;
  wordGapMs: number;
};

export type MachineDisplay = {
  morse: string;
  text: string;
  pending: string;
};

export type StraightKeyClock = {
  now: () => number;
};

export type StraightKeySession = {
  down: () => void;
  up: () => MorseKeyEvent[];
  tick: () => MorseKeyEvent[];
  setWpm: (wpm: number) => void;
  events: () => MorseKeyEvent[];
  clear: () => void;
  snapshot: () => MachineDisplay;
  wpm: () => number;
  isDown: () => boolean;
};

export function machineTiming(wpm: number = DEFAULT_MACHINE_WPM): MachineTiming {
  const clamped = clampMachineWpm(wpm);
  const unitMs = iambicUnitMs(clamped);
  return {
    wpm: clamped,
    unitMs,
    ditMs: unitMs,
    dashMs: 3 * unitMs,
    dashThresholdMs: 2 * unitMs,
    elementGapMs: unitMs,
    letterGapMs: 3 * unitMs,
    wordGapMs: 7 * unitMs,
  };
}

export function classifyMachineMark(durationMs: number, wpm: number = DEFAULT_MACHINE_WPM): MorseMark {
  return durationMs < machineTiming(wpm).dashThresholdMs ? '.' : '-';
}

export function classifyMachineGap(gapMs: number, wpm: number = DEFAULT_MACHINE_WPM): MorseGap {
  const timing = machineTiming(wpm);
  if (gapMs >= timing.wordGapMs) return 'word';
  if (gapMs >= timing.letterGapMs) return 'letter';
  return 'element';
}

export function pendingMarks(events: readonly MorseKeyEvent[]): string {
  let pending = '';
  for (const event of events) {
    if (event.kind === 'mark') {
      pending += event.mark;
      continue;
    }
    if (event.gap !== 'element') pending = '';
  }
  return pending;
}

export function flushedEvents(events: readonly MorseKeyEvent[]): MorseKeyEvent[] {
  let lastFlush = -1;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]!;
    if (event.kind === 'gap' && event.gap !== 'element') lastFlush = i;
  }
  if (lastFlush === -1) return [];
  return events.slice(0, lastFlush + 1);
}

export function displayFromEvents(events: readonly MorseKeyEvent[]): MachineDisplay {
  return {
    morse: eventsToMorse(events),
    text: eventsToText(flushedEvents(events)).output,
    pending: pendingMarks(events),
  };
}

export function createStraightKeySession(options: {
  clock: StraightKeyClock;
  wpm?: number;
}): StraightKeySession {
  let wpm = clampMachineWpm(options.wpm ?? DEFAULT_MACHINE_WPM);
  const all: MorseKeyEvent[] = [];
  let downAt: number | null = null;
  let lastUpAt: number | null = null;
  let letterEmitted = false;
  let wordEmitted = false;

  const emitIdle = (idleMs: number): MorseKeyEvent[] => {
    const timing = machineTiming(wpm);
    const emitted: MorseKeyEvent[] = [];
    if (idleMs >= timing.letterGapMs && !letterEmitted) {
      all.push({ kind: 'gap', gap: 'letter' });
      emitted.push(all[all.length - 1]!);
      letterEmitted = true;
    }
    if (idleMs >= timing.wordGapMs && letterEmitted && !wordEmitted) {
      all.push({ kind: 'gap', gap: 'word' });
      emitted.push(all[all.length - 1]!);
      wordEmitted = true;
    }
    return emitted;
  };

  return {
    down() {
      if (downAt !== null) return;
      downAt = options.clock.now();
    },
    up() {
      if (downAt === null) return [];
      const now = options.clock.now();
      const duration = Math.max(0, now - downAt);
      const idle = lastUpAt === null ? 0 : Math.max(0, downAt - lastUpAt);
      downAt = null;
      lastUpAt = now;

      const emitted: MorseKeyEvent[] = [];
      if (idle > 0 && all.length > 0) {
        const kind = classifyMachineGap(idle, wpm);
        if (kind === 'element') {
          all.push({ kind: 'gap', gap: 'element' });
          emitted.push(all[all.length - 1]!);
        } else {
          emitted.push(...emitIdle(idle));
        }
      }

      const mark = classifyMachineMark(duration, wpm);
      all.push({ kind: 'mark', mark });
      emitted.push(all[all.length - 1]!);
      letterEmitted = false;
      wordEmitted = false;
      return emitted;
    },
    tick() {
      if (downAt !== null || lastUpAt === null) return [];
      return emitIdle(options.clock.now() - lastUpAt);
    },
    setWpm(next) {
      wpm = clampMachineWpm(next);
    },
    events: () => all.slice(),
    clear() {
      all.length = 0;
      downAt = null;
      lastUpAt = null;
      letterEmitted = false;
      wordEmitted = false;
    },
    snapshot: () => displayFromEvents(all),
    wpm: () => wpm,
    isDown: () => downAt !== null,
  };
}

export type StraightKeyScriptStep =
  | { t: number; action: 'down' | 'up' | 'tick' }
  | { t: number; action: 'wpm'; wpm: number };

export function runStraightKeyScript(
  script: readonly StraightKeyScriptStep[],
  options: { wpm?: number; until?: number } = {},
): MorseKeyEvent[] {
  const wpm = options.wpm ?? DEFAULT_MACHINE_WPM;
  let time = 0;
  const session = createStraightKeySession({ clock: { now: () => time }, wpm });
  const sorted = [...script].sort((a, b) => a.t - b.t);

  for (const step of sorted) {
    time = step.t;
    if (step.action === 'down') session.down();
    else if (step.action === 'up') session.up();
    else if (step.action === 'wpm') session.setWpm(step.wpm);
    else session.tick();
  }

  const lastT = sorted.length > 0 ? sorted[sorted.length - 1]!.t : 0;
  const letterMs = machineTiming(session.wpm()).letterGapMs;
  time = options.until ?? lastT + letterMs;
  session.tick();
  return session.events();
}
