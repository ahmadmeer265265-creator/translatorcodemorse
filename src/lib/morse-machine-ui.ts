import { encode, decode, MORSE_ALPHABET } from './morse';
import { morseStringToEvents, type MorseKeyEvent } from './morse-key-events';
import {
  generateListenAndGuess,
  scoreMorseTheLetter,
  type CharacterMismatch,
  type ListenAndGuessPrompt,
  type MorseTheLetterScore,
  type PracticeDifficulty,
} from './morse-machine-practice';
import { displayFromEvents, type MachineDisplay } from './morse-machine-timing';

export const MACHINE_PAGE_PATH = '/morse-code-machine/';
export const MACHINE_TITLE = 'Morse Code Machine – Free Key, Keyer & Boy Scouts Tool';
export const MACHINE_HEADING = 'Morse Code Machine: Free Online Key and Keyer Simulator';
export const MACHINE_DESCRIPTION =
  'Free online Morse code machine with key, paddle, and keyer. Replaces the old Boy Scouts Morse Code Machine — Listen & Guess and Morse the Letter.';
export const MACHINE_OG_IMAGE_PATH = '/morse-machine-featured.webp';
export const MACHINE_OG_IMAGE_ALT =
  'Morse Code Machine: a telegraph key sending Morse dots and dashes, with a Scout badge';

export const MACHINE_MODES = ['key', 'type', 'paddle'] as const;
export type MachineMode = (typeof MACHINE_MODES)[number];

export const MACHINE_MODE_LABEL: Record<MachineMode, string> = {
  key: 'Key',
  type: 'Type',
  paddle: 'Paddle',
};

export const MACHINE_MODE_HINT: Record<MachineMode, string> = {
  key: 'Tap, click, or hold the key. Spacebar does the same.',
  type: 'Type letters. They convert to Morse as you go.',
  paddle: 'Hold Dit or Dah. Both sides alternate. J or ← = dit, K or → = dah.',
};

export const MACHINE_KEYBINDS = [
  { keys: 'Space', action: 'Straight key (tap or hold)' },
  { keys: 'J or Left arrow', action: 'Paddle dit' },
  { keys: 'K or Right arrow', action: 'Paddle dah' },
] as const;

export const MACHINE_CHART_LETTERS = MORSE_ALPHABET.filter((entry) => entry.group === 'letter');
export const MACHINE_CHART_DIGITS = MORSE_ALPHABET.filter((entry) => entry.group === 'digit');

export function isMachineMode(value: string): value is MachineMode {
  return (MACHINE_MODES as readonly string[]).includes(value);
}

export function displayForMode(mode: MachineMode, events: readonly MorseKeyEvent[], typed: string): MachineDisplay {
  if (mode === 'type') return displayFromType(typed);
  return displayFromEvents(events);
}

export function displayFromType(typed: string): MachineDisplay {
  const encoded = encode(typed);
  return {
    morse: encoded.output,
    text: encoded.output ? decode(encoded.output).output : '',
    pending: '',
  };
}

export function emptyDisplay(): MachineDisplay {
  return { morse: '', text: '', pending: '' };
}

export type { ListenAndGuessPrompt, MorseTheLetterScore, PracticeDifficulty };

export const MACHINE_ACTIVITIES = ['send', 'listen', 'letter'] as const;
export type MachineActivity = (typeof MACHINE_ACTIVITIES)[number];

export const MACHINE_ACTIVITY_LABEL: Record<MachineActivity, string> = {
  send: 'Send',
  listen: 'Listen & Guess',
  letter: 'Morse the Letter',
};

export const MACHINE_THEMES = ['light', 'dark'] as const;
export type MachineTheme = (typeof MACHINE_THEMES)[number];

/** Brand palettes the Morse Code Machine must paint in — never UA Canvas/AccentColor. */
export const MACHINE_THEME_PALETTE = {
  light: { canvas: '#f3efe8', accent: '#9a3f06' },
  dark: { canvas: '#14110e', accent: '#f0a94e' },
} as const;

export const PRACTICE_DIFFICULTIES = ['character', 'word'] as const;

export function isMachineActivity(value: string): value is MachineActivity {
  return (MACHINE_ACTIVITIES as readonly string[]).includes(value);
}

export function isMachineTheme(value: string): value is MachineTheme {
  return (MACHINE_THEMES as readonly string[]).includes(value);
}

export function machineThemeToggleLabel(theme: MachineTheme): string {
  return theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

export function isPracticeDifficulty(value: string): value is PracticeDifficulty {
  return (PRACTICE_DIFFICULTIES as readonly string[]).includes(value);
}

export function liveSidetoneAllowed(mode: MachineMode): boolean {
  return mode !== 'type';
}

export function nextPracticePrompt(
  difficulty: PracticeDifficulty,
  random: () => number = Math.random,
): ListenAndGuessPrompt {
  return generateListenAndGuess(difficulty, random);
}

export function eventsForPracticeGuess(
  mode: MachineMode,
  events: readonly MorseKeyEvent[],
  typed: string,
): MorseKeyEvent[] {
  if (mode === 'type') return morseStringToEvents(encode(typed).output);
  return [...events];
}

export function checkPractice(
  target: string,
  mode: MachineMode,
  events: readonly MorseKeyEvent[],
  typed: string,
): MorseTheLetterScore {
  return scoreMorseTheLetter(target, eventsForPracticeGuess(mode, events, typed));
}

export function formatPracticeMismatches(mismatches: readonly CharacterMismatch[]): string {
  return mismatches
    .map((row) => {
      const at = row.index + 1;
      if (!row.actual) return `missing ${row.expected} at ${at}`;
      if (!row.expected) return `extra ${row.actual} at ${at}`;
      return `${row.expected}→${row.actual} at ${at}`;
    })
    .join('; ');
}

export function practiceFeedback(
  score: MorseTheLetterScore,
  options: { revealAnswer: boolean },
): { kind: 'correct' | 'incorrect'; text: string } {
  if (score.match) return { kind: 'correct', text: 'Correct.' };
  const parts = ['Incorrect.'];
  if (options.revealAnswer) parts.push(`The answer was ${score.target}.`);
  parts.push(score.sent ? `You sent ${score.sent}.` : 'Nothing received.');
  const mismatches = formatPracticeMismatches(score.mismatches);
  if (mismatches) parts.push(mismatches + '.');
  return { kind: 'incorrect', text: parts.join(' ') };
}
