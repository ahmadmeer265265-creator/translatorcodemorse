import { describe, expect, it } from 'vitest';
import { encode } from './american-morse';
import {
  DEFAULT_PITCH,
  PITCH_LIMITS,
  VOLUME_LIMITS,
  buildAmericanTimeline,
  clampPitch,
  clampVolume,
  cuesFor,
  lampOn,
  markLengths,
  pitchEnabled,
  startVibration,
  stopVibration,
  unitMsForSpeed,
  vibrationPattern,
} from './american-playback';

const FOUR = './-/=/_';

describe('speed keeps mark order', () => {
  it('dot < dash < L < 0 at both ends of the speed range', () => {
    for (const speed of [5, 15, 40]) {
      const lengths = markLengths(buildAmericanTimeline(FOUR, speed));
      expect(lengths).toHaveLength(4);
      expect(lengths[0]!).toBeLessThan(lengths[1]!);
      expect(lengths[1]!).toBeLessThan(lengths[2]!);
      expect(lengths[2]!).toBeLessThan(lengths[3]!);
      const unit = unitMsForSpeed(speed);
      expect(lengths[0]!).toBeCloseTo(unit, 5);
      expect(lengths[1]!).toBeCloseTo(unit * 2, 5);
      expect(lengths[2]!).toBeCloseTo(unit * 4, 5);
      expect(lengths[3]!).toBeCloseTo(unit * 6, 5);
    }
  });

  it('keeps element < internal < letter < word at both speed ends', () => {
    for (const speed of [5, 40]) {
      const gaps = buildAmericanTimeline('.- ./-//.', speed).filter((span) => !span.on);
      const by = Object.fromEntries(gaps.map((span) => [span.gap, span.ms]));
      expect(by.element).toBeLessThan(by.internal!);
      expect(by.internal).toBeLessThan(by.letter!);
      expect(by.letter).toBeLessThan(by.word!);
    }
  });

  it('scales every gap by the same unit', () => {
    const slow = buildAmericanTimeline('A//B', 5).map((span) => span.ms);
    const fast = buildAmericanTimeline('A//B', 40).map((span) => span.ms);
    expect(slow.length).toBe(fast.length);
    const ratio = unitMsForSpeed(5) / unitMsForSpeed(40);
    slow.forEach((ms, index) => expect(ms / fast[index]!).toBeCloseTo(ratio, 5));
  });
});

describe('sounder and CW cues', () => {
  const timeline = buildAmericanTimeline(encode('A').output, 15);

  it('CW plays a tone for each mark and lights the lamp only then', () => {
    const cues = cuesFor('cw', timeline);
    expect(cues.tones).toHaveLength(2);
    expect(cues.clicks).toEqual([]);
    expect(cues.lampFollowsMarks).toBe(true);
    expect(lampOn('cw', timeline, 1)).toBe(true);
    expect(lampOn('cw', timeline, cues.tones[0]!.durationMs + 1)).toBe(false);
  });

  it('the sounder clicks at both ends of a mark and never lights the lamp', () => {
    const cues = cuesFor('sounder', timeline);
    expect(cues.tones).toEqual([]);
    expect(cues.clicks.map((click) => click.edge)).toEqual(['down', 'up', 'down', 'up']);
    expect(cues.lampFollowsMarks).toBe(false);
    expect(lampOn('sounder', timeline, 1)).toBe(false);
    expect(pitchEnabled('sounder')).toBe(false);
    expect(pitchEnabled('cw')).toBe(true);
  });
});

describe('vibration', () => {
  it('calls vibrate with the mark/gap pattern and cancels with [0]', () => {
    const timeline = buildAmericanTimeline('.', 20);
    const calls: number[][] = [];
    const vibrate = (pattern: number[]): boolean => {
      calls.push(pattern);
      return true;
    };
    startVibration(timeline, vibrate, true);
    stopVibration(vibrate, true);
    expect(calls[0]).toEqual(vibrationPattern(timeline));
    expect(calls[0]![0]).toBeGreaterThan(0);
    expect(calls[1]).toEqual([0]);
  });

  it('does nothing when the device has no vibration API', () => {
    const calls: number[][] = [];
    const vibrate = (pattern: number[]): boolean => {
      calls.push(pattern);
      return true;
    };
    startVibration(buildAmericanTimeline('.', 20), vibrate, false);
    stopVibration(vibrate, false);
    expect(calls).toEqual([]);
  });
});

describe('volume and pitch bounds', () => {
  it('clamps volume and pitch to the slider limits', () => {
    expect(clampVolume(-10)).toBe(VOLUME_LIMITS.min);
    expect(clampVolume(140)).toBe(VOLUME_LIMITS.max);
    expect(clampVolume(70)).toBe(70);
    expect(clampPitch(10)).toBe(PITCH_LIMITS.min);
    expect(clampPitch(5000)).toBe(PITCH_LIMITS.max);
    expect(clampPitch(DEFAULT_PITCH)).toBe(DEFAULT_PITCH);
  });
});
