import { describe, expect, it } from 'vitest';
import { encode } from '../../lib/american-morse';
import { buildAmericanTimeline, cuesFor, type TimedSpan } from '../../lib/american-playback';
import {
  AMERICAN_EXAMPLES,
  americanPuzzleUrl,
  americanShareUrl,
  americanWavName,
  canRenderWav,
  clearedPair,
  cwToneSample,
  cwWaveformFor,
  directionLabel,
  dockFlashOn,
  examplePair,
  nextTransportPhase,
  pcmToWav,
  pickAmericanExample,
  readAmericanLink,
  renderAmericanPcm,
  swappedDirection,
  textToCopy,
  transportLabel,
  vibrationRemainder,
} from './polish';

describe('copy, clear, and random example', () => {
  it('copies the requested box, clears both, and encodes a fresh example', () => {
    const fields = { text: 'SOS', morse: encode('SOS').output };
    expect(textToCopy('text', fields)).toBe('SOS');
    expect(textToCopy('morse', fields)).toBe(fields.morse);
    expect(clearedPair()).toEqual({ text: '', morse: '' });
    const first = pickAmericanExample(() => 0);
    const next = pickAmericanExample(() => 0, first);
    expect(next).not.toBe(first);
    expect(AMERICAN_EXAMPLES).toContain(next);
    const pair = examplePair(next);
    expect(pair).toEqual({ text: next, morse: encode(next).output });
    expect(pair.morse.length).toBeGreaterThan(0);
  });
});

describe('waveform and dock flash', () => {
  const timeline = buildAmericanTimeline(encode('E').output, 15);

  it('square changes the CW sample and the sounder gets no waveform', () => {
    const angle = Math.PI / 5;
    expect(cwToneSample('square', angle)).not.toBeCloseTo(cwToneSample('sine', angle));
    expect(cwWaveformFor('cw', 'square')).toBe('square');
    expect(cwWaveformFor('cw', 'sine')).toBe('sine');
    expect(cwWaveformFor('cw', 'other')).toBe('sine');
    expect(cwWaveformFor('sounder', 'square')).toBeNull();
    expect(cuesFor('sounder', timeline).tones).toEqual([]);
  });

  it('pulses the dock border on CW marks only', () => {
    expect(dockFlashOn('cw', timeline, 1)).toBe(true);
    expect(dockFlashOn('cw', timeline, cuesFor('cw', timeline).tones[0]!.durationMs + 1)).toBe(false);
    expect(dockFlashOn('sounder', timeline, 1)).toBe(false);
  });
});

describe('play button, swap, and share links', () => {
  const page = 'https://translatorcodemorse.com/american-morse-code-translator/';

  it('turns the same button from Play to Pause to Resume, and Stop starts over', () => {
    expect(transportLabel('stopped')).toBe('Play');
    expect(transportLabel('playing')).toBe('Pause');
    expect(transportLabel('paused')).toBe('Resume');
    expect(nextTransportPhase('stopped', 'play')).toBe('playing');
    expect(nextTransportPhase('playing', 'play')).toBe('paused');
    expect(nextTransportPhase('paused', 'play')).toBe('playing');
    expect(nextTransportPhase('playing', 'stop')).toBe('stopped');
    expect(nextTransportPhase('paused', 'stop')).toBe('stopped');
    expect(directionLabel('text')).toBe('Text → Morse');
    expect(directionLabel(swappedDirection('text'))).toBe('Morse → Text');
    expect(swappedDirection('morse')).toBe('text');
  });

  it('builds a share link with the text and a puzzle link that hides it', () => {
    const share = americanShareUrl(page, 'SOS');
    expect(share).toContain('#text=SOS');
    expect(readAmericanLink(new URL(share ?? '').hash)).toEqual({ text: 'SOS', hide: false });
    const morse = encode('SOS').output;
    const puzzle = americanPuzzleUrl(page, morse);
    expect(readAmericanLink(new URL(puzzle ?? '').hash)).toEqual({ morse, hide: true });
    expect(americanShareUrl(page, '   ')).toBeNull();
    expect(americanPuzzleUrl(page, '')).toBeNull();
    expect(readAmericanLink(`#text=${'A'.repeat(2001)}`)).toBeNull();
  });

  it('keeps the rest of a vibration pattern after a pause', () => {
    const timeline: TimedSpan[] = [
      { on: true, ms: 100 },
      { on: false, ms: 100 },
    ];
    expect(vibrationRemainder(timeline, 40)).toEqual([60, 100]);
    expect(vibrationRemainder(timeline, 150)).toEqual([0, 50]);
    expect(vibrationRemainder(timeline, 200)).toEqual([]);
  });
});

describe('download waveform', () => {
  const timeline = buildAmericanTimeline('=', 15);

  it('square changes the CW file and the sounder file stays clicks', () => {
    const sine = renderAmericanPcm(timeline, { mode: 'cw', waveform: 'sine', frequency: 700, sampleRate: 8000, volume: 1 });
    const square = renderAmericanPcm(timeline, { mode: 'cw', waveform: 'square', frequency: 700, sampleRate: 8000, volume: 1 });
    expect(sine[50]).not.toBeCloseTo(square[50] ?? 0);
    const clicks = renderAmericanPcm(timeline, { mode: 'sounder', waveform: 'square', sampleRate: 8000, volume: 1 });
    const clicksAgain = renderAmericanPcm(timeline, { mode: 'sounder', waveform: 'sine', sampleRate: 8000, volume: 1 });
    expect(clicks).toEqual(clicksAgain);
    const mid = Math.round(0.16 * 8000);
    expect(Math.abs(clicks[mid] ?? 0)).toBe(0);
    expect(Math.max(...clicks.slice(0, 64).map((sample) => Math.abs(sample)))).toBeGreaterThan(0.05);
    const wav = pcmToWav(square, 8000);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
    expect(americanWavName('cw')).toBe('american-morse-tone.wav');
    expect(americanWavName('sounder')).toBe('american-morse-sounder.wav');
    expect(canRenderWav(0)).toBe(false);
    expect(canRenderWav(120_001)).toBe(false);
    expect(canRenderWav(1000)).toBe(true);
  });
});
