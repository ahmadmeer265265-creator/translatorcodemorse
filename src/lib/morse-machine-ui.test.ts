import { describe, expect, it } from 'vitest';
import { encode } from './morse';
import { pageMeta } from '../config/pages';
import { primaryNav } from '../config/nav';
import { displayFromEvents } from './morse-machine-timing';
import { morseStringToEvents } from './morse-key-events';
import {
  displayFromType,
  displayForMode,
  isMachineMode,
  MACHINE_CHART_DIGITS,
  MACHINE_CHART_LETTERS,
  MACHINE_DESCRIPTION,
  MACHINE_KEYBINDS,
  MACHINE_MODE_HINT,
  MACHINE_PAGE_PATH,
  MACHINE_TITLE,
} from './morse-machine-ui';

describe('Morse Code Machine page copy', () => {
  it('has a unique title and a 140–155 character description', () => {
    expect(MACHINE_TITLE).toBe('Morse Code Machine');
    expect([...MACHINE_TITLE].length).toBeLessThanOrEqual(60);
    expect([...MACHINE_DESCRIPTION].length).toBeGreaterThanOrEqual(140);
    expect([...MACHINE_DESCRIPTION].length).toBeLessThanOrEqual(155);
  });

  it('is in the nav and sitemap, with five input methods documented', () => {
    expect(pageMeta.some((page) => page.path === MACHINE_PAGE_PATH)).toBe(true);
    expect(primaryNav.some((item) => item.href === MACHINE_PAGE_PATH)).toBe(true);
    expect(MACHINE_MODE_HINT.key).toMatch(/Tap/i);
    expect(MACHINE_MODE_HINT.key).toMatch(/hold/i);
    expect(MACHINE_MODE_HINT.key).toMatch(/Spacebar/i);
    expect(MACHINE_MODE_HINT.type).toMatch(/Type/i);
    expect(MACHINE_MODE_HINT.paddle).toMatch(/Dit/i);
    expect(MACHINE_KEYBINDS.map((row) => row.keys).join(' ')).toMatch(/Space/);
    expect(MACHINE_KEYBINDS.map((row) => row.keys).join(' ')).toMatch(/J/);
    expect(MACHINE_KEYBINDS.map((row) => row.keys).join(' ')).toMatch(/K/);
  });
});

describe('display helpers', () => {
  it('keeps an unfinished letter in Morse only until the letter gap', () => {
    const live = displayFromEvents(morseStringToEvents('...'));
    expect(live.morse).toBe('...');
    expect(live.text).toBe('');
    expect(live.pending).toBe('...');
    const next = displayFromEvents(morseStringToEvents('... ---'));
    expect(next.text).toBe('S');
    expect(next.pending).toBe('---');
  });

  it('encodes typed letters with the homepage International Morse engine', () => {
    expect(displayFromType('sos')).toEqual({
      morse: encode('sos').output,
      text: 'SOS',
      pending: '',
    });
    expect(displayForMode('type', [], 'HI').morse).toBe(encode('HI').output);
    expect(isMachineMode('paddle')).toBe(true);
    expect(isMachineMode('listen')).toBe(false);
  });

  it('charts A–Z and 0–9 from the shared alphabet', () => {
    expect(MACHINE_CHART_LETTERS.map((entry) => entry.char).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(MACHINE_CHART_DIGITS.map((entry) => entry.char).join('')).toBe('1234567890');
  });
});
