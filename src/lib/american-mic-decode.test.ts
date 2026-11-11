import { describe, expect, it } from 'vitest';
import { AMERICAN_MORSE_ALPHABET, CLOSE_QUOTE, encode } from './american-morse';
import {
  MIN_MARK_MS,
  SYNTH_RATIOS,
  createAmericanMicDecoder,
  decodeAmericanMorseEnvelope,
  decodeAmericanSegments,
  envelopeToSegments,
  isMarkSample,
  segmentsFromAmericanMorse,
  tokenizeAmericanMorse,
} from './american-mic-decode';

const UNITS = [40, 60, 80, 120, 200] as const;

const roundTripText = (text: string, unitMs: number) =>
  decodeAmericanSegments(segmentsFromAmericanMorse(encode(text).output, unitMs), {
    initialUnitMs: unitMs,
  });

describe('threshold and envelope', () => {
  it('isMarkSample compares amplitude to threshold', () => {
    expect(isMarkSample(0.6, 0.5)).toBe(true);
    expect(isMarkSample(0.4, 0.5)).toBe(false);
  });

  it('envelopeToSegments collapses samples into mark/space runs', () => {
    const samples: Array<readonly [number, number]> = [
      [0, 1],
      [10, 1],
      [20, 1],
      [30, 0],
      [40, 0],
      [50, 1],
      [60, 1],
      [70, 0],
    ];
    expect(envelopeToSegments(samples, 0.5)).toEqual([
      { type: 'mark', durationMs: 30 },
      { type: 'space', durationMs: 20 },
      { type: 'mark', durationMs: 20 },
    ]);
  });
});

describe('synthetic audio decode at multiple speeds', () => {
  it('round-trips every alphabet character through timing data', () => {
    for (const unit of UNITS) {
      for (const entry of AMERICAN_MORSE_ALPHABET) {
        const result = roundTripText(entry.char, unit);
        expect(result.text, `${entry.char} at unit ${unit}`).toBe(entry.char);
      }
    }
  });

  it('decodes phrases at several WPM-equivalent units', () => {
    for (const unit of UNITS) {
      expect(roundTripText('HELLO WORLD', unit).text).toBe('HELLO WORLD');
      expect(roundTripText('WHAT HATH GOD WROUGHT', unit).text).toBe('WHAT HATH GOD WROUGHT');
      expect(roundTripText('L0', unit).text).toBe('L0');
      expect(roundTripText('SOS', unit).text).toBe('SOS');
    }
  });

  it('decodes the same Morse through a sampled envelope', () => {
    const morse = encode('PARIS').output;
    for (const unit of [60, 100, 160]) {
      const result = decodeAmericanMorseEnvelope(morse, unit);
      expect(result.text).toBe('PARIS');
    }
  });

  it('follows a gradual speed-up', () => {
    const morse = encode('PRACTICE').output;
    const tokens = tokenizeAmericanMorse(morse).length;
    const result = decodeAmericanMorseEnvelope(morse, (i) => 140 - (40 * i) / Math.max(1, tokens - 1));
    expect(result.text).toBe('PRACTICE');
  });

  it('still classifies Morse Code World L=4 / 0=5 ratios', () => {
    const unit = 80;
    const world = { ...SYNTH_RATIOS, zero: 5 };
    const result = decodeAmericanSegments(segmentsFromAmericanMorse('=/_', unit, world), {
      initialUnitMs: unit,
    });
    expect(result.text).toBe('L0');
  });
});

describe('internal-gap letters in audio', () => {
  it('does not split C O R Y Z & into two letters at several speeds', () => {
    for (const unit of UNITS) {
      expect(roundTripText('CORYZ&', unit).text).toBe('CORYZ&');
      expect(roundTripText('IE', unit).text).toBe('IE');
      expect(roundTripText('EE', unit).text).toBe('EE');
      expect(roundTripText('EI', unit).text).toBe('EI');
      expect(roundTripText('II', unit).text).toBe('II');
      expect(roundTripText('SE', unit).text).toBe('SE');
      expect(roundTripText('ES', unit).text).toBe('ES');
    }
  });

  it('keeps HOME and HOG apart from timing data', () => {
    for (const unit of UNITS) {
      expect(roundTripText('HOME', unit).text).toBe('HOME');
      expect(roundTripText('HOG', unit).text).toBe('HOG');
    }
  });
});

describe('robustness', () => {
  it('maps an unrecognized sequence to #', () => {
    const result = decodeAmericanSegments(segmentsFromAmericanMorse('.-.-.-', 100), {
      initialUnitMs: 100,
    });
    expect(result.text).toBe('#');
  });

  it('ignores noise blips below the minimum mark', () => {
    const decoder = createAmericanMicDecoder({ initialUnitMs: 100 });
    decoder.push({ type: 'mark', durationMs: MIN_MARK_MS - 1 });
    decoder.push({ type: 'space', durationMs: 100 });
    decoder.push({ type: 'mark', durationMs: 100 });
    decoder.push({ type: 'space', durationMs: 350 });
    expect(decoder.flush().text).toBe('E');
  });

  it('silence() resolves a trailing letter without consuming the gap', () => {
    const decoder = createAmericanMicDecoder({ initialUnitMs: 100 });
    decoder.push({ type: 'mark', durationMs: 100 });
    decoder.silence(100);
    expect(decoder.snapshot().text).toBe('');
    decoder.silence(280);
    expect(decoder.snapshot().text).toBe('E');
  });

  it('tolerates ±10% jitter on marks and gaps', () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const j = (value: number) => Math.max(MIN_MARK_MS, Math.round(value * (1 + (rand() - 0.5) * 0.2)));
    const unit = 100;
    const raw = segmentsFromAmericanMorse(encode('JITTER').output, unit);
    const jittered = raw.map((segment) => ({ ...segment, durationMs: j(segment.durationMs) }));
    const out = decodeAmericanSegments(jittered, { initialUnitMs: unit });
    expect(out.text).toBe('JITTER');
  });

  it('round-trips trailing punctuation from timing data', () => {
    expect(roundTripText('OK?', 80).text).toBe('OK?');
    expect(roundTripText(`YES${CLOSE_QUOTE}`, 80).text).toBe(`YES${CLOSE_QUOTE}`);
  });
});
