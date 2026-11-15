import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IAMBIC_WPM,
  IAMBIC_MODE,
  clampIambicWpm,
  createIambicKeyer,
  iambicUnitMs,
  runIambicScript,
} from './iambic-keyer';
import { eventsToMorse, eventsToText, type MorseKeyEvent } from './morse-key-events';
import { encode } from './morse';

function marksOf(events: MorseKeyEvent[]): string {
  return events.filter((event) => event.kind === 'mark').map((event) => event.mark).join('');
}

describe('iambic timing', () => {
  it('uses PARIS 1200/WPM units and clamps to the homepage 5–40 range', () => {
    expect(IAMBIC_MODE).toBe('A');
    expect(iambicUnitMs(DEFAULT_IAMBIC_WPM)).toBe(60);
    expect(iambicUnitMs(5)).toBe(240);
    expect(iambicUnitMs(40)).toBe(30);
    expect(clampIambicWpm(1)).toBe(5);
    expect(clampIambicWpm(99)).toBe(40);
    expect(clampIambicWpm(Number.NaN)).toBe(20);
  });
});

describe('iambic hold one side', () => {
  it('sends a stream of dits while the dot paddle is held', () => {
    const unit = iambicUnitMs(20);
    const fourDitsEnd = 3 * 2 * unit + unit;
    const events = runIambicScript(
      [
        { t: 0, action: 'down', side: 'dot' },
        { t: fourDitsEnd, action: 'up', side: 'dot' },
      ],
      { wpm: 20, until: fourDitsEnd + 3 * unit },
    );
    expect(marksOf(events)).toBe('....');
    expect(eventsToText(events).output).toBe('H');
    expect(eventsToMorse(events)).toBe(encode('H').output);
  });

  it('sends a stream of dahs while the dash paddle is held', () => {
    const unit = iambicUnitMs(20);
    const period = 3 * unit + unit;
    const threeDahsEnd = 2 * period + 3 * unit;
    const events = runIambicScript(
      [
        { t: 0, action: 'down', side: 'dash' },
        { t: threeDahsEnd, action: 'up', side: 'dash' },
      ],
      { wpm: 20, until: threeDahsEnd + 3 * unit },
    );
    expect(marksOf(events)).toBe('---');
    expect(eventsToText(events).output).toBe('O');
  });

  it('still produces dots at 5 WPM and dashes at 40 WPM', () => {
    const slow = iambicUnitMs(5);
    const twoDitsEnd = 2 * slow + slow;
    const slowEvents = runIambicScript(
      [
        { t: 0, action: 'down', side: 'dot' },
        { t: twoDitsEnd, action: 'up', side: 'dot' },
      ],
      { wpm: 5, until: twoDitsEnd + 3 * slow },
    );
    expect(eventsToText(slowEvents).output).toBe('I');

    const fast = iambicUnitMs(40);
    const dashPeriod = 3 * fast + fast;
    const twoDahsEnd = dashPeriod + 3 * fast;
    const fastEvents = runIambicScript(
      [
        { t: 0, action: 'down', side: 'dash' },
        { t: twoDahsEnd, action: 'up', side: 'dash' },
      ],
      { wpm: 40, until: twoDahsEnd + 3 * fast },
    );
    expect(eventsToText(fastEvents).output).toBe('M');
  });
});

describe('iambic squeeze (both paddles held)', () => {
  it('alternates dit-dah-dit-dah when both paddles close together (dit first)', () => {
    const unit = iambicUnitMs(20);
    const events = runIambicScript(
      [{ t: 0, action: 'set', dot: true, dash: true }],
      { wpm: 20, until: 8 * unit },
    );
    expect(marksOf(events).slice(0, 4)).toBe('.-.-');
  });

  it('starts on dah when the dash paddle closes first, then alternates', () => {
    const unit = iambicUnitMs(20);
    const events = runIambicScript(
      [
        { t: 0, action: 'down', side: 'dash' },
        { t: 1, action: 'down', side: 'dot' },
      ],
      { wpm: 20, until: 10 * unit },
    );
    expect(marksOf(events).slice(0, 4)).toBe('-.-.');
  });

  it('sends A (.-) when a dit-first squeeze is released during the dah', () => {
    const unit = iambicUnitMs(20);
    const events = runIambicScript(
      [
        { t: 0, action: 'set', dot: true, dash: true },
        { t: 2 * unit, action: 'set', dot: false, dash: false },
      ],
      { wpm: 20, until: 2 * unit + 3 * unit + 3 * unit },
    );
    expect(marksOf(events)).toBe('.-');
    expect(eventsToText(events).output).toBe('A');
  });

  it('sends N (-.) when a dah-first squeeze is released during the dit', () => {
    const unit = iambicUnitMs(20);
    const events = runIambicScript(
      [
        { t: 0, action: 'down', side: 'dash' },
        { t: 1, action: 'down', side: 'dot' },
        { t: 3 * unit + unit + 1, action: 'set', dot: false, dash: false },
      ],
      { wpm: 20, until: 8 * unit },
    );
    expect(marksOf(events)).toBe('-.');
    expect(eventsToText(events).output).toBe('N');
  });
});

describe('iambic A release (no extra queued element)', () => {
  it('finishes the current dah when both paddles open, then stops (A, not R)', () => {
    let time = 0;
    const unit = iambicUnitMs(20);
    const keyer = createIambicKeyer({ clock: { now: () => time }, wpm: 20 });
    keyer.setPaddles(true, true);
    time = 2 * unit + 1;
    keyer.setPaddles(false, false);
    time = 2 * unit + 3 * unit + 3 * unit;
    keyer.tick();
    expect(marksOf(keyer.events())).toBe('.-');
    expect(eventsToText(keyer.events()).output).toBe('A');
  });

  it('does not queue an extra dah if the squeeze is released in the space after the dit', () => {
    let time = 0;
    const unit = iambicUnitMs(20);
    const keyer = createIambicKeyer({ clock: { now: () => time }, wpm: 20 });
    keyer.setPaddles(true, true);
    time = unit + 1;
    keyer.setPaddles(false, false);
    time = unit + 3 * unit + 3 * unit;
    keyer.tick();
    expect(marksOf(keyer.events())).toBe('.');
    expect(eventsToText(keyer.events()).output).toBe('E');
  });

  it('does not start another element if both paddles open during the inter-element space', () => {
    let time = 0;
    const unit = iambicUnitMs(20);
    const keyer = createIambicKeyer({ clock: { now: () => time }, wpm: 20 });
    keyer.paddleDown('dot');
    time = unit + unit / 2;
    keyer.paddleUp('dot');
    time = unit + unit + 3 * unit;
    keyer.tick();
    expect(marksOf(keyer.events())).toBe('.');
    expect(eventsToText(keyer.events()).output).toBe('E');
  });

  it('keeps sending dots if only the dash paddle is released from a squeeze', () => {
    const unit = iambicUnitMs(20);
    const events = runIambicScript(
      [
        { t: 0, action: 'set', dot: true, dash: true },
        { t: 2 * unit, action: 'set', dot: true, dash: false },
        { t: 2 * unit + 4 * 2 * unit, action: 'up', side: 'dot' },
      ],
      { wpm: 20, until: 2 * unit + 4 * 2 * unit + 3 * unit },
    );
    expect(marksOf(events).startsWith('.-')).toBe(true);
    expect(marksOf(events).slice(2).includes('-')).toBe(false);
  });
});

describe('iambic letter and word gaps', () => {
  it('emits a letter gap after 3 units idle and a word gap after 7 units idle', () => {
    let time = 0;
    const unit = iambicUnitMs(20);
    const keyer = createIambicKeyer({ clock: { now: () => time }, wpm: 20 });
    keyer.paddleDown('dot');
    time = unit;
    keyer.paddleUp('dot');
    time = unit + 3 * unit;
    const letter = keyer.tick();
    expect(letter).toEqual([{ kind: 'gap', gap: 'letter' }]);
    time = unit + 7 * unit;
    const word = keyer.tick();
    expect(word).toEqual([{ kind: 'gap', gap: 'word' }]);
  });

  it('separates letters when the next paddle closes after a 3-unit pause', () => {
    const unit = iambicUnitMs(20);
    const events = runIambicScript(
      [
        { t: 0, action: 'down', side: 'dot' },
        { t: unit, action: 'up', side: 'dot' },
        { t: unit + 3 * unit, action: 'down', side: 'dash' },
        { t: unit + 3 * unit + 3 * unit, action: 'up', side: 'dash' },
      ],
      { wpm: 20, until: unit + 3 * unit + 3 * unit + 3 * unit },
    );
    expect(eventsToText(events).output).toBe('ET');
  });
});

describe('iambic keyer housekeeping', () => {
  it('ignores a second close on an already-held paddle and clears on clear()', () => {
    let time = 0;
    const keyer = createIambicKeyer({ clock: { now: () => time }, wpm: 20 });
    keyer.paddleDown('dot');
    expect(keyer.paddleDown('dot')).toEqual([]);
    expect(marksOf(keyer.events())).toBe('.');
    keyer.clear();
    expect(keyer.events()).toEqual([]);
    time = 0;
    keyer.paddleDown('dash');
    expect(marksOf(keyer.events())).toBe('-');
  });
});
