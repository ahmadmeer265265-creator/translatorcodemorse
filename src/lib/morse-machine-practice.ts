import { encode, MORSE_ALPHABET } from './morse';
import { eventsToMorse, eventsToText, type MorseKeyEvent } from './morse-key-events';

export type PracticeDifficulty = 'character' | 'word';

export type ListenAndGuessPrompt = {
  difficulty: PracticeDifficulty;
  text: string;
  morse: string;
  group: 'letter' | 'digit' | 'word';
};

export type CharacterMismatch = {
  index: number;
  expected: string;
  actual: string;
};

export type MorseTheLetterScore = {
  target: string;
  sent: string;
  sentMorse: string;
  match: boolean;
  mismatches: CharacterMismatch[];
};

/** A–Z and 0–9 from the homepage International Morse alphabet. */
export const LISTEN_AND_GUESS_CHARACTERS: readonly string[] = MORSE_ALPHABET.filter(
  (entry) => entry.group === 'letter' || entry.group === 'digit',
).map((entry) => entry.char);

/**
 * Short beginner words for Listen & Guess (Scout / ham-radio practice).
 * All encode cleanly with the homepage International Morse engine.
 */
export const LISTEN_AND_GUESS_WORDS = [
  'SOS',
  'HI',
  'OK',
  'CQ',
  'YES',
  'NO',
  'CAT',
  'DOG',
  'CAMP',
  'FIRE',
  'HELP',
  'TEST',
  'CODE',
  'KEY',
  'SUN',
  'MAP',
  'TENT',
  'HIKE',
  'FLAG',
  'STAR',
  'HOME',
  'GOOD',
  'THE',
  'YOU',
] as const;

export type ListenAndGuessWord = (typeof LISTEN_AND_GUESS_WORDS)[number];

function pick<T>(items: readonly T[], random: () => number): T {
  const n = items.length;
  const index = Math.min(n - 1, Math.max(0, Math.floor(random() * n)));
  return items[index]!;
}

function characterGroup(text: string): 'letter' | 'digit' | 'word' {
  const entry = MORSE_ALPHABET.find((item) => item.char === text);
  if (entry?.group === 'digit') return 'digit';
  if (entry?.group === 'letter') return 'letter';
  return 'word';
}

export function generateListenAndGuess(
  difficulty: PracticeDifficulty,
  random: () => number = Math.random,
): ListenAndGuessPrompt {
  const text =
    difficulty === 'character'
      ? pick(LISTEN_AND_GUESS_CHARACTERS, random)
      : pick(LISTEN_AND_GUESS_WORDS, random);
  return {
    difficulty,
    text,
    morse: encode(text).output,
    group: difficulty === 'word' ? 'word' : characterGroup(text),
  };
}

function normalizePracticeText(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

function diffCharacters(expected: string, actual: string): CharacterMismatch[] {
  const mismatches: CharacterMismatch[] = [];
  const n = Math.max(expected.length, actual.length);
  for (let i = 0; i < n; i += 1) {
    const exp = expected[i] ?? '';
    const act = actual[i] ?? '';
    if (exp !== act) mismatches.push({ index: i, expected: exp, actual: act });
  }
  return mismatches;
}

/**
 * Morse the Letter / send-and-check: decode the keyed event stream with the
 * homepage International Morse engine and report per-character mismatches.
 */
export function scoreMorseTheLetter(
  target: string,
  events: readonly MorseKeyEvent[],
): MorseTheLetterScore {
  const expected = normalizePracticeText(target);
  const sentMorse = eventsToMorse(events);
  const sent = normalizePracticeText(eventsToText(events).output);
  const mismatches = diffCharacters(expected, sent);
  return {
    target: expected,
    sent,
    sentMorse,
    match: mismatches.length === 0 && expected.length > 0,
    mismatches,
  };
}
