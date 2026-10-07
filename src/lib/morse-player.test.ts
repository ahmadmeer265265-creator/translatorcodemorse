import { describe, expect, it } from 'vitest';
import { armTone, scheduleAhead } from './morse-player';
import { buildTimeline } from './morse-audio';

describe('armTone', () => {
  it('schedules a 5 ms attack and release around the tone', () => {
    const calls: string[] = [];
    const osc = {
      frequency: { value: 0 },
      connect() {},
      start(time: number) {
        calls.push(`start ${time}`);
      },
      stop(time: number) {
        calls.push(`stop ${time}`);
      },
    };
    const gain = {
      gain: {
        setValueAtTime(value: number, time: number) {
          calls.push(`set ${value} @ ${time}`);
        },
        linearRampToValueAtTime(value: number, time: number) {
          calls.push(`ramp ${value} @ ${time}`);
        },
        cancelScheduledValues() {},
      },
      connect() {},
    };
    const ctx = {
      createOscillator: () => osc,
      createGain: () => gain,
    } as unknown as AudioContext;
    const destination = {} as AudioNode;
    armTone(ctx, destination, 2, 0.06, 600, 0.7);
    expect(osc.frequency.value).toBe(600);
    expect(calls).toEqual([
      'set 0 @ 2',
      'ramp 0.7 @ 2.005',
      'set 0.7 @ 2.055',
      'ramp 0 @ 2.06',
      'start 2',
      'stop 2.06',
    ]);
  });

  it('schedules about 1.5 seconds before the rest of a long message', () => {
    const timeline = buildTimeline('. '.repeat(80).trim(), { wpm: 20 });
    const planned = scheduleAhead(timeline, 0, 0, 0);
    expect(planned.index).toBeLessThan(timeline.length);
    expect(planned.nextTime).toBeGreaterThan(1);
    expect(planned.nextTime).toBeLessThan(2);
    expect(planned.toneCount).toBeGreaterThan(0);
  });
});
