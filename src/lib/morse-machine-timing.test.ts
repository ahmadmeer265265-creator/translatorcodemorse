import { describe, expect, it } from 'vitest';
import { iambicUnitMs } from './iambic-keyer';
import { eventsToText } from './morse-key-events';
import { encode } from './morse';
import {
  classifyMachineGap,
  classifyMachineMark,
  createStraightKeySession,
  DEFAULT_MACHINE_WPM,
  displayFromEvents,
  flushedEvents,
  machineTiming,
  pendingMarks,
  runStraightKeyScript,
} from './morse-machine-timing';

describe('machineTiming', () => {
  it('uses the same 1200/WPM unit as the iambic keyer', () => {
    for (const wpm of [5, 20, 40]) {
      const timing = machineTiming(wpm);
      expect(timing.unitMs).toBe(iambicUnitMs(wpm));
      expect(timing.ditMs).toBe(timing.unitMs);
      expect(timing.dashMs).toBe(3 * timing.unitMs);
      expect(timing.dashThresholdMs).toBe(2 * timing.unitMs);
      expect(timing.elementGapMs).toBe(timing.unitMs);
      expect(timing.letterGapMs).toBe(3 * timing.unitMs);
      expect(timing.wordGapMs).toBe(7 * timing.unitMs);
    }
  });

  it('clamps to 5–40 WPM', () => {
    expect(machineTiming(1).wpm).toBe(5);
    expect(machineTiming(99).wpm).toBe(40);
    expect(machineTiming(DEFAULT_MACHINE_WPM).unitMs).toBe(60);
  });
});

describe('classifyMachineMark / classifyMachineGap', () => {
  it('splits dit and dah at two units', () => {
    const { dashThresholdMs } = machineTiming(20);
    expect(classifyMachineMark(dashThresholdMs - 1, 20)).toBe('.');
    expect(classifyMachineMark(dashThresholdMs, 20)).toBe('-');
    expect(classifyMachineMark(1, 20)).toBe('.');
    expect(classifyMachineMark(5_000, 20)).toBe('-');
  });

  it('uses 3-unit letter gaps and 7-unit word gaps', () => {
    const { letterGapMs, wordGapMs } = machineTiming(20);
    expect(classifyMachineGap(letterGapMs - 1, 20)).toBe('element');
    expect(classifyMachineGap(letterGapMs, 20)).toBe('letter');
    expect(classifyMachineGap(wordGapMs - 1, 20)).toBe('letter');
    expect(classifyMachineGap(wordGapMs, 20)).toBe('word');
  });

  it('scales the same ratios at 5 WPM and 40 WPM', () => {
    expect(classifyMachineMark(machineTiming(5).dashThresholdMs - 1, 5)).toBe('.');
    expect(classifyMachineMark(machineTiming(5).dashThresholdMs, 5)).toBe('-');
    expect(classifyMachineGap(machineTiming(40).letterGapMs, 40)).toBe('letter');
    expect(classifyMachineGap(machineTiming(40).wordGapMs, 40)).toBe('word');
  });
});

describe('straight-key session', () => {
  it('decodes SOS from short and long holds at 20 WPM', () => {
    const unit = machineTiming(20).unitMs;
    const events = runStraightKeyScript([
      { t: 0, action: 'down' },
      { t: unit, action: 'up' },
      { t: 2 * unit, action: 'down' },
      { t: 3 * unit, action: 'up' },
      { t: 4 * unit, action: 'down' },
      { t: 5 * unit, action: 'up' },
      { t: 5 * unit + 3 * unit, action: 'tick' },
      { t: 9 * unit, action: 'down' },
      { t: 12 * unit, action: 'up' },
      { t: 13 * unit, action: 'down' },
      { t: 16 * unit, action: 'up' },
      { t: 17 * unit, action: 'down' },
      { t: 20 * unit, action: 'up' },
      { t: 23 * unit, action: 'tick' },
      { t: 24 * unit, action: 'down' },
      { t: 25 * unit, action: 'up' },
      { t: 26 * unit, action: 'down' },
      { t: 27 * unit, action: 'up' },
      { t: 28 * unit, action: 'down' },
      { t: 29 * unit, action: 'up' },
    ]);
    expect(displayFromEvents(events).text).toBe('SOS');
    expect(displayFromEvents(events).morse).toBe(encode('SOS').output);
  });

  it('does not decode an in-progress letter until the 3-unit gap', () => {
    const unit = machineTiming(20).unitMs;
    let time = 0;
    const session = createStraightKeySession({ clock: { now: () => time }, wpm: 20 });
    session.down();
    time = unit;
    session.up();
    expect(session.snapshot()).toMatchObject({ morse: '.', text: '', pending: '.' });
    time = unit + 3 * unit;
    session.tick();
    expect(session.snapshot()).toMatchObject({ morse: '.', text: 'E', pending: '' });
  });

  it('inserts a word gap after 7 units idle', () => {
    const unit = machineTiming(20).unitMs;
    const events = runStraightKeyScript(
      [
        { t: 0, action: 'down' },
        { t: unit, action: 'up' },
        { t: unit + 7 * unit, action: 'down' },
        { t: unit + 7 * unit + 3 * unit, action: 'up' },
      ],
      { wpm: 20, until: unit + 7 * unit + 3 * unit + 3 * unit },
    );
    expect(eventsToText(flushedEvents(events)).output).toBe('E T');
  });

  it('measures idle from release to the next press, not through the hold', () => {
    const unit = machineTiming(20).unitMs;
    let time = 0;
    const session = createStraightKeySession({ clock: { now: () => time }, wpm: 20 });
    session.down();
    time = unit;
    session.up();
    time = unit + unit;
    session.down();
    time = unit + unit + 3 * unit;
    session.up();
    time = unit + unit + 3 * unit + 3 * unit;
    session.tick();
    expect(session.snapshot().text).toBe('A');
    expect(pendingMarks(session.events())).toBe('');
  });

  it('applies a new WPM to later presses without using homepage tap thresholds', () => {
    let time = 0;
    const session = createStraightKeySession({ clock: { now: () => time }, wpm: 40 });
    session.down();
    time = 100;
    session.up();
    expect(session.snapshot().pending).toBe('-');
    session.setWpm(5);
    time = 200;
    session.down();
    time = 300;
    session.up();
    expect(session.snapshot().pending.endsWith('.')).toBe(true);
  });
});
