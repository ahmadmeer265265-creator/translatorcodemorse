/**
 * UI-only helpers for the American Morse translator polish.
 * Encode/decode and playback timing stay in the engine modules.
 */
import { encode } from '../../lib/american-morse';
import { cuesFor, lampOn, timelineDuration, type PlaybackMode, type TimedSpan } from '../../lib/american-playback';

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

export type TransportPhase = 'stopped' | 'playing' | 'paused';

/** The play button is also pause and resume. Stop always returns to the start. */
export function nextTransportPhase(phase: TransportPhase, control: 'play' | 'stop'): TransportPhase {
  if (control === 'stop') return 'stopped';
  if (phase === 'playing') return 'paused';
  return 'playing';
}

export function transportLabel(phase: TransportPhase): 'Play' | 'Pause' | 'Resume' {
  if (phase === 'playing') return 'Pause';
  if (phase === 'paused') return 'Resume';
  return 'Play';
}

export type FieldDirection = 'text' | 'morse';

export function swappedDirection(direction: FieldDirection): FieldDirection {
  return direction === 'text' ? 'morse' : 'text';
}

export function directionLabel(direction: FieldDirection): string {
  return direction === 'text' ? 'Text → Morse' : 'Morse → Text';
}

/** Share links stay short so a pasted novel cannot freeze the page. */
export const LINK_MAX_LENGTH = 2000;

export type AmericanLink = {
  text?: string;
  morse?: string;
  hide: boolean;
};

export function readAmericanLink(hash: string): AmericanLink | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const link: AmericanLink = { hide: false };
  if (params.has('text')) {
    const text = params.get('text') ?? '';
    if ([...text].length > LINK_MAX_LENGTH) return null;
    link.text = text;
  }
  if (params.has('morse')) {
    const morse = params.get('morse') ?? '';
    if ([...morse].length > LINK_MAX_LENGTH) return null;
    link.morse = morse;
  }
  const hide = params.get('hide');
  link.hide = hide === '1' || hide === 'true';
  if (link.text === undefined && link.morse === undefined && !link.hide) return null;
  return link;
}

function linkWithHash(pageHref: string, hash: string): string | null {
  try {
    const url = new URL(pageHref);
    url.search = '';
    url.hash = hash;
    return url.href;
  } catch {
    return null;
  }
}

/** Opens this page with the plain text filled in, so both boxes come back. */
export function americanShareUrl(pageHref: string, text: string): string | null {
  if (!text.trim() || [...text].length > LINK_MAX_LENGTH) return null;
  return linkWithHash(pageHref, `text=${encodeURIComponent(text)}`);
}

/** Opens this page with only the Morse showing. The plain text stays hidden. */
export function americanPuzzleUrl(pageHref: string, morse: string): string | null {
  if (!morse.trim() || [...morse].length > LINK_MAX_LENGTH) return null;
  return linkWithHash(pageHref, `morse=${encodeURIComponent(morse)}&hide=1`);
}

/** Vibration pattern from the middle of a message, for resume after pause. */
export function vibrationRemainder(timeline: readonly TimedSpan[], elapsedMs: number): number[] {
  const pattern: number[] = [];
  let cursor = 0;
  let started = false;
  for (const span of timeline) {
    const end = cursor + span.ms;
    if (end <= elapsedMs) {
      cursor = end;
      continue;
    }
    const slice = cursor < elapsedMs ? end - elapsedMs : span.ms;
    if (!started) {
      if (!span.on) pattern.push(0);
      started = true;
    }
    pattern.push(Math.max(1, Math.round(slice)));
    cursor = end;
  }
  return pattern;
}

/** Downloads stay on one click. A very long message is refused instead of freezing the tab. */
export const WAV_MAX_MS = 120_000;
export const WAV_SAMPLE_RATE = 44100;

export function canRenderWav(durationMs: number): boolean {
  return durationMs > 0 && durationMs <= WAV_MAX_MS;
}

export function americanWavName(mode: PlaybackMode): string {
  return mode === 'cw' ? 'american-morse-tone.wav' : 'american-morse-sounder.wav';
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * PCM for the Download button. CW uses the selected waveform.
 * The sounder is only the two clacks, so the waveform choice does not touch it.
 */
export function renderAmericanPcm(
  timeline: readonly TimedSpan[],
  options: {
    mode: PlaybackMode;
    frequency?: number;
    sampleRate?: number;
    volume?: number;
    waveform?: CwWaveform;
  },
): Float32Array {
  const sampleRate = options.sampleRate ?? WAV_SAMPLE_RATE;
  const volume = options.volume ?? 0.7;
  const total = Math.max(1, Math.round((timelineDuration(timeline) / 1000) * sampleRate));
  const pcm = new Float32Array(total);
  if (options.mode === 'cw') {
    const waveform: CwWaveform = options.waveform === 'square' ? 'square' : 'sine';
    const frequency = options.frequency ?? 700;
    const ramp = Math.round(0.005 * sampleRate);
    let cursorMs = 0;
    for (const span of timeline) {
      const start = Math.round((cursorMs / 1000) * sampleRate);
      const count = Math.round((span.ms / 1000) * sampleRate);
      if (span.on) {
        for (let i = 0; i < count; i += 1) {
          const index = start + i;
          if (index >= pcm.length) break;
          const attack = ramp <= 0 ? 1 : Math.min(1, i / ramp);
          const release = ramp <= 0 ? 1 : Math.min(1, (count - 1 - i) / ramp);
          const env = Math.min(attack, release);
          pcm[index] = cwToneSample(waveform, (2 * Math.PI * frequency * index) / sampleRate) * volume * env;
        }
      }
      cursorMs += span.ms;
    }
    return pcm;
  }
  const rand = mulberry32(1);
  for (const click of cuesFor('sounder', timeline).clicks) {
    const start = Math.round((click.atMs / 1000) * sampleRate);
    const count = Math.max(1, Math.round((click.ms / 1000) * sampleRate));
    const gain = click.edge === 'down' ? 0.9 : 0.45;
    for (let i = 0; i < count; i += 1) {
      const index = start + i;
      if (index >= pcm.length) break;
      const env = Math.sin((Math.PI * i) / Math.max(1, count - 1));
      pcm[index] += (rand() * 2 - 1) * env * env * gain * volume;
    }
  }
  return pcm;
}

export function pcmToWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}
