import { describe, expect, it } from 'vitest';
import { encode } from './morse';
import { machineTiming } from './morse-machine-timing';
import {
  clampSidetonePitch,
  clampSidetoneVolume,
  createSidetone,
  DEFAULT_SIDETONE_PITCH,
  markDurationMs,
  sidetonePeak,
  sidetoneTimeline,
  timelineDurationMs,
  type SidetoneAudio,
  type SidetoneSettings,
} from './morse-machine-sidetone';

function mockAudio(): { ctx: SidetoneAudio; calls: string[] } {
  const calls: string[] = [];
  let time = 0;
  const ctx: SidetoneAudio = {
    get currentTime() {
      return time;
    },
    state: 'running',
    destination: {},
    async resume() {
      calls.push('resume');
    },
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect() {
          calls.push('osc-connect');
        },
        start(at = 0) {
          calls.push(`start ${at}`);
        },
        stop(at = 0) {
          calls.push(`stop ${at}`);
        },
      };
    },
    createGain() {
      return {
        gain: {
          value: 0,
          setValueAtTime(value, at) {
            calls.push(`set ${value} @ ${at}`);
          },
          linearRampToValueAtTime(value, at) {
            calls.push(`ramp ${value} @ ${at}`);
          },
          cancelScheduledValues() {
            calls.push('cancel');
          },
        },
        connect() {
          calls.push('gain-connect');
        },
      };
    },
  };
  return { ctx, calls };
}

describe('sidetone timing', () => {
  it('matches Machine WPM dit/dah lengths', () => {
    expect(markDurationMs('.', 20)).toBe(60);
    expect(markDurationMs('-', 20)).toBe(180);
    expect(markDurationMs('.', 40)).toBe(machineTiming(40).ditMs);
  });

  it('builds a PARIS timeline for SOS at 20 WPM', () => {
    const timeline = sidetoneTimeline(encode('SOS').output, 20);
    const ons = timeline.filter((segment) => segment.on).map((segment) => segment.ms);
    expect(ons).toEqual([60, 60, 60, 180, 180, 180, 60, 60, 60]);
    expect(timelineDurationMs(timeline)).toBeGreaterThan(0);
  });

  it('clamps pitch and volume', () => {
    expect(clampSidetonePitch(200)).toBe(400);
    expect(clampSidetonePitch(1600)).toBe(1000);
    expect(clampSidetonePitch(Number.NaN)).toBe(DEFAULT_SIDETONE_PITCH);
    expect(clampSidetoneVolume(-4)).toBe(0);
    expect(clampSidetoneVolume(140)).toBe(100);
    expect(sidetonePeak(70)).toBeCloseTo(0.7);
  });
});

describe('createSidetone', () => {
  it('does not create an audio context until a user gesture', () => {
    let created = 0;
    const { ctx } = mockAudio();
    const sidetone = createSidetone({
      getSettings: () => ({ enabled: true, volume: 70, frequency: 600 }),
      createAudio: () => {
        created += 1;
        return ctx;
      },
      sleep: async () => undefined,
    });
    expect(sidetone.unlocked()).toBe(false);
    expect(created).toBe(0);
    expect(sidetone.lastTones()).toEqual([]);
  });

  it('stays silent when live sidetone is off', async () => {
    const settings: SidetoneSettings = { enabled: false, volume: 70, frequency: 600 };
    const { ctx, calls } = mockAudio();
    const sidetone = createSidetone({
      getSettings: () => settings,
      createAudio: () => ctx,
      sleep: async () => undefined,
    });
    sidetone.startLive();
    sidetone.playMark('.', 20);
    await Promise.resolve();
    expect(calls.some((call) => call.startsWith('start'))).toBe(false);
  });

  it('schedules a dit-length tone for a paddle mark when sidetone is on', async () => {
    const { ctx } = mockAudio();
    const sidetone = createSidetone({
      getSettings: () => ({ enabled: true, volume: 70, frequency: 600 }),
      createAudio: () => ctx,
      sleep: async () => undefined,
    });
    sidetone.playMark('.', 20);
    await Promise.resolve();
    const tone = sidetone.lastTones()[0];
    expect(tone?.duration).toBeCloseTo(0.06);
    expect(tone?.frequency).toBe(600);
    expect(tone?.peak).toBeCloseTo(0.7);
  });

  it('plays Listen & Guess Morse even when live sidetone is off, if volume is up', async () => {
    const { ctx } = mockAudio();
    const sidetone = createSidetone({
      getSettings: () => ({ enabled: false, volume: 50, frequency: 800 }),
      createAudio: () => ctx,
      sleep: async () => undefined,
    });
    await sidetone.playMorse('.', 20);
    expect(sidetone.lastTones().length).toBe(1);
    expect(sidetone.lastTones()[0]?.frequency).toBe(800);
    expect(sidetone.isPlaying()).toBe(false);
  });

  it('plays nothing when volume is zero', async () => {
    const { ctx } = mockAudio();
    const sidetone = createSidetone({
      getSettings: () => ({ enabled: true, volume: 0, frequency: 600 }),
      createAudio: () => ctx,
      sleep: async () => undefined,
    });
    await sidetone.playMorse('...', 20);
    sidetone.playMark('-', 20);
    await Promise.resolve();
    expect(sidetone.lastTones()).toEqual([]);
  });
});
