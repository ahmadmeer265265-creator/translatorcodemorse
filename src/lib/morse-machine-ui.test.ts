import { describe, expect, it } from 'vitest';
import { encode } from './morse';
import { pageMeta } from '../config/pages';
import { primaryNav } from '../config/nav';
import { displayFromEvents } from './morse-machine-timing';
import { morseStringToEvents } from './morse-key-events';
import { LISTEN_AND_GUESS_WORDS } from './morse-machine-practice';
import {
  checkPractice,
  displayFromType,
  displayForMode,
  eventsForPracticeGuess,
  isMachineActivity,
  isMachineMode,
  liveSidetoneAllowed,
  MACHINE_ACTIVITY_LABEL,
  MACHINE_CHART_DIGITS,
  MACHINE_CHART_LETTERS,
  MACHINE_DESCRIPTION,
  MACHINE_HEADING,
  MACHINE_KEYBINDS,
  MACHINE_MODE_HINT,
  MACHINE_PAGE_PATH,
  MACHINE_TITLE,
  machineThemeToggleLabel,
  nextPracticePrompt,
  practiceFeedback,
} from './morse-machine-ui';

describe('Morse Code Machine page copy', () => {
  it('has a unique title and a 140–155 character description', () => {
    expect(MACHINE_TITLE).toBe('Morse Code Machine - Free Online Key & Keyer');
    expect(MACHINE_HEADING).toBe('Morse Code Machine: Free Online Key and Keyer Simulator');
    expect([...MACHINE_TITLE].length).toBeLessThanOrEqual(60);
    expect([...MACHINE_DESCRIPTION].length).toBeGreaterThanOrEqual(140);
    expect([...MACHINE_DESCRIPTION].length).toBeLessThanOrEqual(155);
    expect(machineThemeToggleLabel('light')).toBe('Switch to dark theme');
    expect(machineThemeToggleLabel('dark')).toBe('Switch to light theme');
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
    expect(isMachineActivity('listen')).toBe(true);
    expect(liveSidetoneAllowed('type')).toBe(false);
    expect(liveSidetoneAllowed('key')).toBe(true);
  });

  it('charts A–Z and 0–9 from the shared alphabet', () => {
    expect(MACHINE_CHART_LETTERS.map((entry) => entry.char).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(MACHINE_CHART_DIGITS.map((entry) => entry.char).join('')).toBe('1234567890');
  });
});

describe('practice-mode UI wiring', () => {
  it('keeps the Boy Scouts Flash names and both generator difficulties', () => {
    expect(MACHINE_ACTIVITY_LABEL.listen).toBe('Listen & Guess');
    expect(MACHINE_ACTIVITY_LABEL.letter).toBe('Morse the Letter');
    expect(nextPracticePrompt('character', () => 0).text).toHaveLength(1);
    expect(nextPracticePrompt('word', () => 0).text).toBe(LISTEN_AND_GUESS_WORDS[0]);
  });

  it('scores a typed Listen & Guess answer with the Stage 1 scorer', () => {
    const correct = checkPractice('E', 'type', [], 'e');
    expect(correct.match).toBe(true);
    expect(practiceFeedback(correct, { revealAnswer: true }).text).toBe('Correct.');

    const wrong = checkPractice('E', 'type', [], 't');
    expect(wrong.match).toBe(false);
    expect(wrong.mismatches[0]).toMatchObject({ index: 0, expected: 'E', actual: 'T' });
    expect(practiceFeedback(wrong, { revealAnswer: true }).text).toContain('The answer was E.');
    expect(practiceFeedback(wrong, { revealAnswer: true }).text).toContain('E→T at 1');
  });

  it('reports which Morse the Letter characters were off', () => {
    const events = eventsForPracticeGuess('key', morseStringToEvents(encode('COT').output), '');
    const score = checkPractice('CAT', 'key', events, '');
    expect(score.match).toBe(false);
    expect(score.sent).toBe('COT');
    const feedback = practiceFeedback(score, { revealAnswer: false });
    expect(feedback.kind).toBe('incorrect');
    expect(feedback.text).toContain('You sent COT.');
    expect(feedback.text).toContain('A→O at 2');
    expect(feedback.text).not.toContain('The answer was');
  });
});
