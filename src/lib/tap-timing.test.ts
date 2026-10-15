import { describe, expect, it } from 'vitest';
import { DOT_MAX_MS, LETTER_GAP_MS, WORD_GAP_MS, createTapEngine, runTapSequence } from './tap-timing';

describe('tap timing', () => {
  it('maps a short press to a dot and a long press to a dash', () => {
    expect(runTapSequence([{ pressMs: 199, gapAfterMs: LETTER_GAP_MS }]).marks).toBe('');
    expect(runTapSequence([{ pressMs: 199, gapAfterMs: LETTER_GAP_MS }]).text).toBe('E');
    expect(runTapSequence([{ pressMs: 200, gapAfterMs: LETTER_GAP_MS }]).text).toBe('T');
    expect(runTapSequence([{ pressMs: DOT_MAX_MS - 1, gapAfterMs: 0 }]).marks).toBe('.');
    expect(runTapSequence([{ pressMs: DOT_MAX_MS, gapAfterMs: 0 }]).marks).toBe('-');
  });

  it('builds a full letter (K = -.-) and auto-decodes after 800ms', () => {
    const mid = runTapSequence([
      { pressMs: 250, gapAfterMs: 50 },
      { pressMs: 50, gapAfterMs: 50 },
      { pressMs: 250, gapAfterMs: 0 },
    ]);
    expect(mid.marks).toBe('-.-');
    expect(mid.text).toBe('');

    const done = runTapSequence([
      { pressMs: 250, gapAfterMs: 50 },
      { pressMs: 50, gapAfterMs: 50 },
      { pressMs: 250, gapAfterMs: LETTER_GAP_MS },
    ]);
    expect(done.marks).toBe('');
    expect(done.text).toBe('K');
    expect(done.morse).toBe('-.-');
    expect(done.announcement).toEqual({ kind: 'letter', text: 'K' });
  });

  it('inserts a word space after 2000ms idle', () => {
    const result = runTapSequence([
      { pressMs: 50, gapAfterMs: LETTER_GAP_MS },
      { pressMs: 50, gapAfterMs: 0 },
    ]);
    // After E decoded, start next letter's first mark with no word space yet
    expect(result.text).toBe('E');

    const withWord = runTapSequence([{ pressMs: 50, gapAfterMs: WORD_GAP_MS }]);
    expect(withWord.text).toBe('E ');
    expect(withWord.announcement).toEqual({ kind: 'word', text: ' ' });
  });

  it('manual Word break flushes a pending letter then inserts a space', () => {
    let time = 0;
    const engine = createTapEngine({ now: () => time });
    engine.press(50);
    time = 100;
    const snap = engine.wordBreak();
    expect(snap.text).toBe('E ');
    expect(snap.morse).toBe('.');
    expect(snap.announcement?.kind).toBe('word');
  });

  it('supports back-to-back taps with no gap', () => {
    const snap = runTapSequence([
      { pressMs: 50, gapAfterMs: 0 },
      { pressMs: 50, gapAfterMs: 0 },
      { pressMs: 50, gapAfterMs: LETTER_GAP_MS },
    ]);
    expect(snap.text).toBe('S');
    expect(snap.morse).toBe('...');
  });

  it('maps an unrecognized mark sequence to #', () => {
    const snap = runTapSequence([
      { pressMs: 50, gapAfterMs: 20 },
      { pressMs: 50, gapAfterMs: 20 },
      { pressMs: 50, gapAfterMs: 20 },
      { pressMs: 50, gapAfterMs: 20 },
      { pressMs: 50, gapAfterMs: 20 },
      { pressMs: 50, gapAfterMs: LETTER_GAP_MS },
    ]);
    expect(snap.text).toBe('#');
    expect(snap.morse).toBe('......');
  });

  it('undo removes the last mark only', () => {
    let time = 0;
    const engine = createTapEngine({ now: () => time });
    engine.press(250);
    time = 10;
    engine.press(50);
    expect(engine.snapshot().marks).toBe('-.');
    engine.undoMark();
    expect(engine.snapshot().marks).toBe('-');
  });
});
