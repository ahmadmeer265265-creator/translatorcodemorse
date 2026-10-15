import { describe, expect, it } from 'vitest';
import { buildTimeline, encodeWav, effectivePeak, timelineDuration } from './morse-audio';
import { prepareWav } from './morse-player';
import { repeatGapMs } from './audio-effects';

function peakSample(wav: Uint8Array): number {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) {
    peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
  }
  return peak;
}

describe('WAV sound types', () => {
  const timeline = buildTimeline('.-', { wpm: 20 });

  it('writes a valid header and respects volume for CW sine', () => {
    const wav = encodeWav(timeline, { frequency: 600, volume: 0.5, soundType: 'cw', waveform: 'sine' });
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(peakSample(wav)).toBeLessThanOrEqual(Math.round(0.5 * 32767) + 1);
  });

  it('lowers square CW peak vs sine at the same volume', () => {
    const sine = encodeWav(timeline, { frequency: 600, volume: 1, soundType: 'cw', waveform: 'sine' });
    const square = encodeWav(timeline, { frequency: 600, volume: 1, soundType: 'cw', waveform: 'square' });
    expect(effectivePeak(1, 'cw', 'square')).toBe(0.5);
    expect(peakSample(square)).toBeLessThanOrEqual(peakSample(sine));
  });

  it('encodes telegraph clicks without exceeding volume', () => {
    const wav = encodeWav(timeline, { frequency: 600, volume: 0.7, soundType: 'telegraph', waveform: 'sine' });
    expect(peakSample(wav)).toBeLessThanOrEqual(Math.round(0.7 * 32767) + 2);
    const ms = timelineDuration(timeline);
    const samples = (wav.length - 44) / 2;
    expect(Math.abs(samples - Math.round((ms / 1000) * 44100))).toBeLessThanOrEqual(1);
  });

  it('prepareWav shares settings for playback/WAV', () => {
    const ready = prepareWav('...', {
      wpm: 20,
      farnsworthWpm: 20,
      frequency: 600,
      volume: 0.7,
      soundType: 'telegraph',
      waveform: 'square',
      repeat: false,
      flash: false,
      vibration: false,
    });
    expect(ready && 'bytes' in ready).toBe(true);
  });
});

describe('repeat gap helper', () => {
  it('matches 7 units used between loops', () => {
    expect(repeatGapMs(20)).toBe(420);
  });
});
