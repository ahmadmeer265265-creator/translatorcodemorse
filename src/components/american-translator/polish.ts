/**
 * UI-only helpers for the American Morse translator polish.
 * Encode/decode and playback timing stay in the engine modules.
 */
import { encode } from '../../lib/american-morse';
import { lampOn, type PlaybackMode, type TimedSpan } from '../../lib/american-playback';

export type CwWaveform = 'sine' | 'square';

/** Short phrases for Random example. Each one encodes cleanly. */
export const AMERICAN_EXAMPLES = ['SOS', 'HELLO', 'RAIL', 'HOME', 'CQ'] as const;

export function pickAmericanExample(rng: () => number, last?: string | null): string {
  const pool =
    last && (AMERICAN_EXAMPLES as readonly string[]).includes(last)
      ? AMERICAN_EXAMPLES.filter((phrase) => phrase !== last)
      : [...AMERICAN_EXAMPLES];
  const index = Math.floor(rng() * pool.length);
  return pool[index] ?? AMERICAN_EXAMPLES[0];
}

export function examplePair(text: string): { text: string; morse: string } {
  return { text, morse: encode(text).output };
}

export function clearedPair(): { text: string; morse: string } {
  return { text: '', morse: '' };
}

export function textToCopy(target: 'text' | 'morse', fields: { text: string; morse: string }): string {
  return target === 'morse' ? fields.morse : fields.text;
}

/**
 * CW oscillator shape. The sounder is clicks, not a tone, so it has no waveform.
 * Anything other than "square" stays sine, which is the current tone.
 */
export function cwWaveformFor(mode: PlaybackMode, choice: string): CwWaveform | null {
  if (mode !== 'cw') return null;
  return choice === 'square' ? 'square' : 'sine';
}

/** One sample of the CW tone. Square is the sign of the sine; sounder never asks. */
export function cwToneSample(waveform: CwWaveform, angle: number): number {
  const sine = Math.sin(angle);
  return waveform === 'square' ? Math.sign(sine) : sine;
}

/** Dock-border pulse. CW marks only, the same moments the old lamp lit. */
export function dockFlashOn(mode: PlaybackMode, timeline: readonly TimedSpan[], elapsedMs: number): boolean {
  return lampOn(mode, timeline, elapsedMs);
}
