import { describe, expect, it } from 'vitest';
import {
  bandpassFilter,
  dbOf,
  decodeMorsePcm,
  downmixMono,
  farnsworthGapMs,
  gapModelFor,
  pcmToEnvelope,
} from './audio-decode-file';
import { addNoise, morseTimelineWithUnits, synthesizeMorsePcm } from './audio-synth';
import { buildTimeline } from './morse-audio';
import { encode } from './morse';

const SR = 44100;
const decode = (pcm: Float32Array, options = {}, sampleRate = SR) =>
  decodeMorsePcm({ channels: [pcm], sampleRate }, options);

describe('file decode — clean signals', () => {
  it('decodes SOS at 20 WPM / 700 Hz with frequency and unit estimates', () => {
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, frequency: 700, sampleRate: SR });
    const result = decode(pcm);
    expect(result.detected).toBe(true);
    expect(result.text).toBe('SOS');
    expect(result.morse).toBe('... --- ...');
    expect(result.frequencyHz).not.toBeNull();
    expect(Math.abs(result.frequencyHz! - 700)).toBeLessThanOrEqual(14);
    expect(result.unitMs).not.toBeNull();
    expect(Math.abs(result.unitMs! - 60)).toBeLessThanOrEqual(12);
  });

  it('decodes HELLO WORLD at 12 WPM / 550 Hz', () => {
    const { pcm } = synthesizeMorsePcm(encode('HELLO WORLD').output, {
      wpm: 12,
      frequency: 550,
      sampleRate: SR,
    });
    const result = decode(pcm);
    expect(result.text).toBe('HELLO WORLD');
    expect(Math.abs(result.frequencyHz! - 550)).toBeLessThanOrEqual(11);
  });

  it('decodes stereo input after downmix', () => {
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, sampleRate: SR });
    const result = decodeMorsePcm({ channels: [pcm, Float32Array.from(pcm)], sampleRate: SR });
    expect(result.text).toBe('SOS');
  });
});

describe('file decode — adaptive speed', () => {
  it('follows a sender drifting from 20 WPM to 12 WPM mid-message', () => {
    const { pcm } = synthesizeMorsePcm(encode('PARIS').output, {
      frequency: 700,
      sampleRate: SR,
      // Dot unit ramps linearly 60 ms -> 100 ms across the run.
      unitFn: (i) => 60 + i * 1.2,
    });
    const result = decode(pcm);
    expect(result.text).toBe('PARIS');
  });
});

describe('file decode — noise and silence', () => {
  it('decodes SOS with additive noise at a tolerable level', () => {
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, frequency: 700, sampleRate: SR });
    const noisy = addNoise(pcm, 0.15);
    expect(decode(noisy).text).toBe('SOS');
  });

  it('returns "nothing detected" for a silent buffer (no crash)', () => {
    const result = decode(new Float32Array(SR * 2));
    expect(result.detected).toBe(false);
    expect(result.text).toBe('');
    expect(result.events).toEqual([]);
  });

  it('handles a completely empty buffer without crashing', () => {
    const result = decode(new Float32Array(0));
    expect(result.detected).toBe(false);
    expect(result.text).toBe('');
  });

  it('decodes an unrecognizable mark pattern to "#"', () => {
    // Six dots has no character in the canonical map.
    const { pcm } = synthesizeMorsePcm('......', { wpm: 20, sampleRate: SR });
    expect(decode(pcm).text).toBe('#');
  });
});

describe('manual overrides change decode behavior', () => {
  const sos12 = () => synthesizeMorsePcm('... --- ...', { wpm: 12, frequency: 700, sampleRate: SR }).pcm;

  it('wrong manual wpmRate mis-decodes where auto-detect succeeds', () => {
    const auto = decode(sos12());
    expect(auto.text).toBe('SOS');
    // Lock the unit at 20 WPM (60 ms) while the audio is really 12 WPM (100 ms).
    const manual = decode(sos12(), { wpmRate: 20 });
    expect(manual.text).not.toBe('SOS');
    expect(manual.text).not.toBe(auto.text);
  });

  it('manual Farnsworth gap model fixes stretched-gap timing auto splits', () => {
    // 20 WPM characters, 8 WPM overall: letter gaps stretch to ~890 ms,
    // which the adaptive 1/3/7 ratios read as word breaks.
    const { pcm } = synthesizeMorsePcm('... --- ...', {
      wpm: 20,
      farnsworthWpm: 8,
      frequency: 700,
      sampleRate: SR,
    });
    const auto = decode(pcm);
    expect(auto.text).not.toBe('SOS');
    const manual = decode(pcm, { wpmRate: 20, farnsworthWpm: 8 });
    expect(manual.text).toBe('SOS');
  });

  it('manual frequency + filter rescues a band-noisy signal', () => {
    // A second, louder interfering tone off-band defeats unfiltered decode.
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, frequency: 700, sampleRate: SR });
    const jammer = new Float32Array(pcm.length);
    for (let i = 0; i < jammer.length; i += 1) {
      jammer[i] = pcm[i]! + 0.5 * Math.sin((2 * Math.PI * 240 * i) / SR);
    }
    const unfiltered = decode(jammer, { automaticFrequencyTracking: false });
    const filtered = decode(jammer, {
      automaticFrequencyTracking: false,
      frequencyHz: 700,
      filterQ: 10,
    });
    expect(unfiltered.text).not.toBe('SOS');
    expect(filtered.text).toBe('SOS');
    expect(filtered.frequencyHz).toBe(700);
  });

  it('automaticFrequencyTracking:true ignores a wrong manual frequency', () => {
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, frequency: 700, sampleRate: SR });
    // Tracking on: the wrong manual value is ignored and 700 Hz is detected.
    const tracked = decode(pcm, { automaticFrequencyTracking: true, frequencyHz: 300 });
    expect(tracked.text).toBe('SOS');
    expect(Math.abs(tracked.frequencyHz! - 700)).toBeLessThanOrEqual(14);
    // Tracking off: the manual value is used verbatim as the effective frequency.
    const manual = decode(pcm, { automaticFrequencyTracking: false, frequencyHz: 300 });
    expect(manual.frequencyHz).toBe(300);
    expect(manual.text).toBe('SOS'); // tone still passes the wide biquad; decode is adaptive
  });

  it('manual maxVolumeDb mis-normalizes the threshold where auto works', () => {
    // Claiming the peak sits at -40 dB puts the threshold (-52 dB) under the
    // real noise floor, fusing tone and hiss into one endless mark.
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, sampleRate: SR });
    const noisy = addNoise(pcm, 0.02);
    // Tracking off so the band-pass cannot rescue the bad threshold.
    const wrong = decode(noisy, { automaticFrequencyTracking: false, maxVolumeDb: -40, volumeThresholdDb: 12 });
    expect(wrong.text).not.toBe('SOS');
    const auto = decode(noisy);
    expect(auto.text).toBe('SOS');
  });
});

describe('helpers', () => {
  it('pcmToEnvelope tracks a tone burst level over time', () => {
    const { pcm } = synthesizeMorsePcm('... --- ...', { wpm: 20, sampleRate: SR });
    const env = pcmToEnvelope(pcm, SR, 5);
    expect(env.length).toBeGreaterThan(10);
    const maxAmp = Math.max(...env.map(([, a]) => a));
    expect(maxAmp).toBeGreaterThan(0.4);
    // Window count rounds the window size (221 samples), so allow 10 ms drift.
    expect(Math.abs(env[env.length - 1]![0] - (env.length - 1) * 5)).toBeLessThanOrEqual(10);
  });

  it('downmixMono averages channels', () => {
    const mono = downmixMono({ channels: [Float32Array.of(1, -1), Float32Array.of(0.5, -0.5)], sampleRate: SR });
    expect(Array.from(mono)).toEqual([0.75, -0.75]);
  });

  it('bandpassFilter attenuates an off-band tone', () => {
    const n = SR;
    const pcm = new Float32Array(n);
    for (let i = 0; i < n; i += 1) pcm[i] = 0.8 * Math.sin((2 * Math.PI * 240 * i) / SR);
    const out = bandpassFilter(pcm, SR, 700, 8);
    let sumIn = 0;
    let sumOut = 0;
    for (let i = 0; i < n; i += 1) {
      sumIn += pcm[i]! * pcm[i]!;
      sumOut += out[i]! * out[i]!;
    }
    expect(sumOut).toBeLessThan(sumIn * 0.02);
  });

  it('dbOf maps linear amplitude to dBFS', () => {
    expect(dbOf(1)).toBeCloseTo(0, 1);
    expect(dbOf(0.5)).toBeCloseTo(-6.02, 1);
  });

  it('gapModelFor matches buildTimeline Farnsworth gaps (formula parity)', () => {
    const model = gapModelFor(20, 8)!;
    expect(model).toBeDefined();
    // '... ...' gives a letter gap (890 ms); '... / ---' adds a word gap (2078 ms).
    const letterGap = buildTimeline('... ...', { wpm: 20, farnsworthWpm: 8 })
      .filter((s) => !s.on)
      .reduce((best, s) => (s.ms > best.ms ? s : best), { on: false, ms: 0 });
    const wordGap = buildTimeline('... / ---', { wpm: 20, farnsworthWpm: 8 })
      .filter((s) => !s.on)
      .reduce((best, s) => (s.ms > best.ms ? s : best), { on: false, ms: 0 });
    expect(model.letterMs).toBeCloseTo(farnsworthGapMs(20, 8, 3), 6);
    expect(model.letterMs).toBeCloseTo(letterGap.ms, 6);
    expect(model.wordMs).toBeCloseTo(farnsworthGapMs(20, 8, 7), 6);
    expect(model.wordMs).toBeCloseTo(wordGap.ms, 6);
    expect(model.intraMs).toBeCloseTo(60, 6);
  });
});
