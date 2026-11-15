import { encode, decode, MORSE_ALPHABET } from './morse';
import { displayFromEvents, type MachineDisplay } from './morse-machine-timing';
import type { MorseKeyEvent } from './morse-key-events';

export const MACHINE_PAGE_PATH = '/morse-code-machine/';
export const MACHINE_TITLE = 'Morse Code Machine';
export const MACHINE_DESCRIPTION =
  'Send International Morse with a tap key, hold, spacebar, typed letters, or iambic paddles. One speed from 5 to 40 WPM. Private in your browser.';

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
