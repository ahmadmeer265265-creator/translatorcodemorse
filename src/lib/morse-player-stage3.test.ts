import { describe, expect, it, vi } from 'vitest';
import { createPlayback, scheduleAhead, type AudioSettings, type PlaybackHooks } from './morse-player';
import { buildEnrichedTimeline } from './morse-timeline';
import { repeatGapMs } from './audio-effects';

function fakeCtx() {
  let time = 0;
  let state: AudioContextState = 'running';
  const ctx = {
    get currentTime() {
      return time;
    },
    get state() {
      return state;
    },
    sampleRate: 44100,
    destination: {} as AudioNode,
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          cancelScheduledValues() {},
        },
        connect() {},
      };
    },
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect() {},
        start() {},
        stop() {},
      };
    },
    createBiquadFilter() {
      return { type: 'lowpass', frequency: { value: 0 }, connect() {} };
    },
    createBuffer(_c: number, frames: number, rate: number) {
      return {
        getChannelData: () => new Float32Array(frames),
        sampleRate: rate,
        length: frames,
        numberOfChannels: 1,
      };
    },
    createBufferSource() {
      return { buffer: null, connect() {}, start() {}, stop() {} };
    },
    suspend() {
      state = 'suspended';
      return Promise.resolve();
    },
    resume() {
      state = 'running';
      return Promise.resolve();
    },
    advance(sec: number) {
      if (state === 'running') time += sec;
    },
  };
  return ctx as unknown as AudioContext & { advance: (sec: number) => void };
}

const settings: AudioSettings = {
  wpm: 20,
  farnsworthWpm: 20,
  frequency: 600,
  volume: 0.7,
  soundType: 'cw',
  waveform: 'sine',
  repeat: false,
  flash: false,
  vibration: false,
};

describe('pause/resume scheduling', () => {
  it('does not advance AudioContext time while suspended and resumes from the same position', async () => {
    vi.useFakeTimers();
    const ctx = fakeCtx();
    const statuses: string[] = [];
    const states: string[] = [];
    const hooks: PlaybackHooks = {
      status: (m) => statuses.push(m),
      setState: (s) => states.push(s),
      onGroup: () => {},
      onFlash: () => {},
      vibrate: () => {},
    };
    const enriched = buildEnrichedTimeline('...', { wpm: 20 });
    const handle = createPlayback(ctx, enriched, settings, hooks);
    expect(states.at(-1)).toBe('playing');
    expect(statuses.at(-1)).toBe('Playing');

    // Schedule some tones via timer ticks
    vi.advanceTimersByTime(50);
    ctx.advance(0.05);
    const elapsedBefore = handle.elapsedSec();
    handle.pause();
    expect(states.at(-1)).toBe('paused');
    ctx.advance(1);
    expect(handle.elapsedSec()).toBeCloseTo(elapsedBefore, 5);

    handle.resume();
    await Promise.resolve();
    expect(states.at(-1)).toBe('playing');
    expect(handle.elapsedSec()).toBeCloseTo(elapsedBefore, 5);

    handle.stop(true);
    expect(statuses.at(-1)).toBe('Stopped');
    vi.useRealTimers();
  });
});

describe('scheduleAhead', () => {
  it('still plans about 1.5 seconds ahead', () => {
    const timeline = buildEnrichedTimeline('. '.repeat(80).trim(), { wpm: 20 }).segments.map(({ on, ms }) => ({
      on,
      ms,
    }));
    const planned = scheduleAhead(timeline, 0, 0, 0);
    expect(planned.nextTime).toBeGreaterThan(1);
    expect(planned.nextTime).toBeLessThan(2);
  });
});

describe('repeat gap constant', () => {
  it('uses a 7-unit gap between loops', () => {
    expect(repeatGapMs(20)).toBe(420);
  });
});

describe('flash lamp timeline', () => {
  it('turns the lamp on synchronously before any animation frame', () => {
    vi.useFakeTimers();
    // rAF never fires — a frame-only implementation would leave the lamp dark.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});

    const flashes: boolean[] = [];
    const handle = createPlayback(
      fakeCtx(),
      buildEnrichedTimeline('.', { wpm: 20 }),
      { ...settings, flash: true },
      {
        status: () => {},
        setState: () => {},
        onGroup: () => {},
        onFlash: (on) => flashes.push(on),
        vibrate: () => {},
      },
    );

    expect(flashes).toEqual([true]);
    handle.stop(false);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('toggles the lamp across tone and gap segments on the mock timeline', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

    const flashes: boolean[] = [];
    const ctx = fakeCtx();
    // "A" = .-  → dit, inter-element gap, dash (at 20 WPM: 60 / 60 / 180 ms)
    const handle = createPlayback(ctx, buildEnrichedTimeline('.-', { wpm: 20 }), { ...settings, flash: true }, {
      status: () => {},
      setState: () => {},
      onGroup: () => {},
      onFlash: (on) => flashes.push(on),
      vibrate: () => {},
    });

    expect(flashes.at(-1)).toBe(true);

    ctx.advance(0.07);
    vi.advanceTimersByTime(16);
    expect(flashes.at(-1)).toBe(false);

    ctx.advance(0.06);
    vi.advanceTimersByTime(16);
    expect(flashes.at(-1)).toBe(true);

    handle.stop(false);
    expect(flashes.at(-1)).toBe(false);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not drive the lamp from the timeline when flash is off', () => {
    vi.useFakeTimers();
    const flashes: boolean[] = [];
    const ctx = fakeCtx();
    const handle = createPlayback(ctx, buildEnrichedTimeline('.', { wpm: 20 }), { ...settings, flash: false }, {
      status: () => {},
      setState: () => {},
      onGroup: () => {},
      onFlash: (on) => flashes.push(on),
      vibrate: () => {},
    });
    ctx.advance(0.03);
    vi.advanceTimersByTime(50);
    expect(flashes).toEqual([]);
    handle.stop(false);
    vi.useRealTimers();
  });
});
