import { describe, expect, it } from 'vitest';
import {
  DASH_RATIO,
  MIN_MARK_MS,
  classifyGap,
  classifyMark,
  createMicDecoder,
  decodeMorseEnvelope,
  envelopeToSegments,
  isMarkSample,
} from './mic-decode';
// MIN_MARK_MS used to floor jittered durations above the noise gate.
import { encode } from './morse';

/** Encode text to Morse, then decode it back through the envelope simulator. */
const roundTrip = (text: string, unitMs: number | ((i: number) => number), showSlash = true) =>
  decodeMorseEnvelope(encode(text).output, unitMs, { showSlash });

describe('threshold and envelope', () => {
  it('isMarkSample compares amplitude to threshold', () => {
    expect(isMarkSample(0.6, 0.5)).toBe(true);
    expect(isMarkSample(0.5, 0.5)).toBe(true);
    expect(isMarkSample(0.4, 0.5)).toBe(false);
    expect(isMarkSample(0, 0.5)).toBe(false);
  });

  it('envelopeToSegments collapses samples into mark/space runs', () => {
    // 10ms samples: 3 loud, 2 quiet, 2 loud => mark 30, space 20, mark 20
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
    const segments = envelopeToSegments(samples, 0.5);
    expect(segments).toEqual([
      { type: 'mark', durationMs: 30 },
      { type: 'space', durationMs: 20 },
      { type: 'mark', durationMs: 20 },
    ]);
  });
});

describe('classification', () => {
  it('classifyMark splits dot vs dash at the DASH_RATIO', () => {
    const unit = 100;
    expect(classifyMark(100, unit)).toBe('.');
    expect(classifyMark(unit * DASH_RATIO - 1, unit)).toBe('.');
    expect(classifyMark(unit * DASH_RATIO, unit)).toBe('-');
    expect(classifyMark(300, unit)).toBe('-');
  });

  it('classifyGap maps spaces to intra/letter/word by 1/3/7 ratio', () => {
    const unit = 100;
    expect(classifyGap(100, unit)).toBe('intra');
    expect(classifyGap(249, unit)).toBe('intra');
    expect(classifyGap(250, unit)).toBe('letter');
    expect(classifyGap(300, unit)).toBe('letter');
    expect(classifyGap(499, unit)).toBe('letter');
    expect(classifyGap(500, unit)).toBe('word');
    expect(classifyGap(700, unit)).toBe('word');
  });
});

describe('steady-speed decode', () => {
  it('decodes SOS at a fixed unit', () => {
    const result = decodeMorseEnvelope('... --- ...', 120);
    expect(result.text).toBe('SOS');
    expect(result.morse).toBe('... --- ...');
  });

  it('decodes PARIS at 20 WPM-equivalent unit (60ms dot)', () => {
    const result = roundTrip('PARIS', 60);
    expect(result.text).toBe('PARIS');
    expect(result.morse).toBe(encode('PARIS').output);
  });

  it('decodes a multi-word message at a slow unit', () => {
    const result = roundTrip('HELLO WORLD', 150);
    expect(result.text).toBe('HELLO WORLD');
    expect(result.morse).toBe(encode('HELLO WORLD').output);
  });
});

describe('adaptive speed', () => {
  it('handles a gradual speed-up (unit shrinks across the message)', () => {
    // Longer message, realistic acceleration (200ms -> 90ms dot across it).
    const morse = encode('PRACTICE').output;
    const symbols = (morse.match(/[.\- /]/g) ?? []).length;
    const result = decodeMorseEnvelope(morse, (i) => 200 - (110 * i) / Math.max(1, symbols - 1));
    expect(result.text).toBe('PRACTICE');
  });

  it('handles a gradual slow-down (unit grows across the message)', () => {
    const morse = encode('SLOWING').output;
    const symbols = (morse.match(/[.\- /]/g) ?? []).length;
    const result = decodeMorseEnvelope(morse, (i) => 80 + (70 * i) / Math.max(1, symbols - 1));
    expect(result.text).toBe('SLOWING');
  });
});

describe('jitter tolerance', () => {
  it('still decodes when marks and spaces jitter within tolerance', () => {
    // Feed mark/space segments directly with +/- 18% jitter on each, keeping
    // dot:dash = 1:3 and gap = 1:3:7 ratios intact within the tolerance.
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const j = (v: number) => Math.max(MIN_MARK_MS, Math.round(v * (1 + (rand() - 0.5) * 0.3)));
    const morse = encode('JITTER').output;
    const u = 100;
    // Build absolute segments: marks and the FULL gap that follows each one.
    // The gap after a mark is 1u within a letter, 3u after a letter, 7u after
    // a word — so accumulate the trailing 1u, then extend on ' ' and '/'.
    const segs: Array<{ type: 'mark' | 'space'; durationMs: number }> = [];
    let pendingSpace = 0;
    for (const ch of morse) {
      if (ch === '.' || ch === '-') {
        if (pendingSpace > 0) {
          segs.push({ type: 'space', durationMs: pendingSpace });
          pendingSpace = 0;
        }
        segs.push({ type: 'mark', durationMs: ch === '.' ? j(u) : j(u * 3) });
        pendingSpace = j(u); // intra-char gap
      } else if (ch === ' ') {
        pendingSpace += j(u * 2); // bring total to ~3u (letter gap)
      } else if (ch === '/') {
        pendingSpace += j(u * 4); // bring total to ~7u (word gap)
      }
    }
    const decoder = createMicDecoder({});
    for (const segment of segs) decoder.push(segment);
    const out = decoder.flush();
    if (out.text !== 'JITTER') console.log('JITTER got:', out.text, 'morse:', out.morse);
    expect(out.text).toBe('JITTER');
  });
});

describe('robustness', () => {
  it('maps an unrecognized sequence to #', () => {
    // '......' has no Morse mapping.
    const result = decodeMorseEnvelope('......', 100);
    expect(result.text).toBe('#');
    expect(result.morse).toBe('......');
  });

  it('ignores very short noise blips below the minimum duration', () => {
    const decoder = createMicDecoder({});
    decoder.push({ type: 'mark', durationMs: MIN_MARK_MS - 1 }); // noise, ignored
    decoder.push({ type: 'space', durationMs: 100 });
    decoder.push({ type: 'mark', durationMs: 100 }); // real dot -> E
    const state = decoder.push({ type: 'space', durationMs: 300 }); // letter gap
    expect(state.marks).toBe('');
    expect(state.text).toBe('E');
  });

  it('a noise blip alone decodes to nothing', () => {
    const decoder = createMicDecoder({});
    decoder.push({ type: 'mark', durationMs: MIN_MARK_MS - 1 });
    expect(decoder.flush().text).toBe('');
    expect(decoder.flush().marks).toBe('');
  });

  it('word gap without a leading letter does not create a leading space', () => {
    const decoder = createMicDecoder({});
    decoder.push({ type: 'space', durationMs: 2000 });
    expect(decoder.flush().text).toBe('');
  });

  it('silence() resolves a trailing letter live without consuming the gap', () => {
    const decoder = createMicDecoder({});
    decoder.push({ type: 'mark', durationMs: 100 }); // dot
    // Sender pauses; report growing silence.
    decoder.silence(100);
    expect(decoder.snapshot().text).toBe('');
    decoder.silence(250); // past the 2.5x letter boundary
    expect(decoder.snapshot().text).toBe('E');
    // The gap is not consumed: a following mark still sees intra spacing and
    // would extend the SAME letter had the pause been short.
    decoder.push({ type: 'space', durationMs: 40 });
    decoder.push({ type: 'mark', durationMs: 100 });
    decoder.silence(250);
    expect(decoder.flush().text).toBe('EE');
  });

  it('silence() resolves a word boundary on a long pause', () => {
    const decoder = createMicDecoder({});
    decoder.push({ type: 'mark', durationMs: 100 }); // E
    decoder.silence(250); // close the letter
    decoder.silence(600); // past the 5x word boundary
    expect(decoder.snapshot().text).toBe('E ');
  });
});
