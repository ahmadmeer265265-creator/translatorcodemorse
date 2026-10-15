export type Segment = {
  on: boolean;
  ms: number;
};

export type TimelineOptions = {
  wpm: number;
  farnsworthWpm?: number;
};

export type SoundType = 'cw' | 'telegraph';
export type Waveform = 'sine' | 'square';

export type WavOptions = {
  frequency: number;
  volume: number;
  sampleRate?: number;
  soundType?: SoundType;
  waveform?: Waveform;
};

export const WAV_LIMIT_MS = 300_000;
export const CW_RAMP_SEC = 0.005;

const MARK = /^[.-]+$/;

export function clampSpeed(wpm: number, farnsworthWpm?: number): { wpm: number; farnsworthWpm: number } {
  const speed = clamp(wpm, 5, 40);
  const raw = farnsworthWpm === undefined || !Number.isFinite(farnsworthWpm) ? speed : farnsworthWpm;
  return { wpm: speed, farnsworthWpm: clamp(raw, 5, speed) };
}

export function buildTimeline(morse: string, options: TimelineOptions): Segment[] {
  const { wpm, farnsworthWpm } = clampSpeed(options.wpm, options.farnsworthWpm);
  const unit = 1200 / wpm;
  const stretched = farnsworthWpm < wpm;
  const letterGap = stretched ? farnsworthGapMs(wpm, farnsworthWpm, 3) : 3 * unit;
  const wordGap = stretched ? farnsworthGapMs(wpm, farnsworthWpm, 7) : 7 * unit;

  const marked = morse.replace(/\|/g, '/').replace(/ {3,}/g, ' / ');
  const words = marked
    .split('/')
    .map((word) => word.trim().split(/\s+/).filter((token) => MARK.test(token)))
    .filter((word) => word.length > 0);

  const timeline: Segment[] = [];
  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) timeline.push({ on: false, ms: wordGap });
    word.forEach((code, letterIndex) => {
      if (letterIndex > 0) timeline.push({ on: false, ms: letterGap });
      appendCharacter(timeline, code, unit);
    });
  });
  return timeline;
}

export function timelineDuration(timeline: readonly Segment[]): number {
  return timeline.reduce((sum, segment) => sum + segment.ms, 0);
}

export function effectivePeak(volume: number, soundType: SoundType, waveform: Waveform): number {
  const base = clamp(volume, 0, 1);
  if (soundType === 'cw' && waveform === 'square') return base * 0.5;
  return base;
}

export function encodeWav(timeline: readonly Segment[], options: WavOptions): Uint8Array {
  const sampleRate = options.sampleRate ?? 44100;
  const volume = clamp(options.volume, 0, 1);
  const frequency = options.frequency;
  const soundType = options.soundType ?? 'cw';
  const waveform = options.waveform ?? 'sine';
  const peak = effectivePeak(volume, soundType, waveform);

  let cursor = 0;
  const ranges = timeline.map((segment) => {
    const start = Math.round((cursor / 1000) * sampleRate);
    cursor += segment.ms;
    const end = Math.round((cursor / 1000) * sampleRate);
    return { on: segment.on, start, end, ms: segment.ms };
  });
  const total = ranges.length > 0 ? ranges[ranges.length - 1]!.end : 0;
  const dataBytes = total * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  if (soundType === 'telegraph') {
    renderTelegraph(view, ranges, sampleRate, peak);
  } else {
    renderCw(view, ranges, sampleRate, frequency, peak, waveform);
  }
  return new Uint8Array(buffer);
}

function renderCw(
  view: DataView,
  ranges: { on: boolean; start: number; end: number }[],
  sampleRate: number,
  frequency: number,
  peak: number,
  waveform: Waveform,
): void {
  const attack = Math.round(CW_RAMP_SEC * sampleRate);
  const release = attack;
  let phase = 0;
  const step = (2 * Math.PI * frequency) / sampleRate;
  let lp = 0;
  const lpAlpha = waveform === 'square' ? 0.2 : 1;
  for (const range of ranges) {
    const count = range.end - range.start;
    for (let i = 0; i < count; i += 1) {
      let sample = 0;
      if (range.on && count > 1) {
        const env = envelope(i, count, attack, release);
        const raw = waveform === 'square' ? (Math.sin(phase) >= 0 ? 1 : -1) : Math.sin(phase);
        lp = lp + lpAlpha * (raw - lp);
        sample = lp * env * peak * 32767;
        phase += step;
      }
      const clamped = Math.max(-32768, Math.min(32767, Math.round(sample)));
      view.setInt16(44 + (range.start + i) * 2, clamped, true);
    }
    if (!range.on) {
      phase = 0;
      lp = 0;
    }
  }
}

function renderTelegraph(
  view: DataView,
  ranges: { on: boolean; start: number; end: number; ms: number }[],
  sampleRate: number,
  peak: number,
): void {
  // Zero-fill first
  for (let i = 0; i < view.byteLength - 44; i += 2) {
    view.setInt16(44 + i, 0, true);
  }
  let seed = 1;
  const noise = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };

  for (const range of ranges) {
    if (!range.on) continue;
    const downSamples = Math.round(0.008 * sampleRate);
    const upSamples = Math.round(0.006 * sampleRate);
    writeNoiseBurst(view, range.start, downSamples, peak * 1.0, 0.35, noise);
    const upStart = Math.max(range.start, range.end - upSamples);
    writeNoiseBurst(view, upStart, Math.min(upSamples, range.end - upStart), peak * 0.55, 0.55, noise);
  }
}

function writeNoiseBurst(
  view: DataView,
  start: number,
  count: number,
  peak: number,
  lpAlpha: number,
  noise: () => number,
): void {
  let lp = 0;
  for (let i = 0; i < count; i += 1) {
    const env = envelope(i, count, Math.max(1, Math.floor(count * 0.2)), Math.max(1, Math.floor(count * 0.4)));
    lp = lp + lpAlpha * (noise() - lp);
    const sample = Math.max(-32768, Math.min(32767, Math.round(lp * env * peak * 32767)));
    view.setInt16(44 + (start + i) * 2, sample, true);
  }
}

function appendCharacter(timeline: Segment[], code: string, unit: number): void {
  for (let index = 0; index < code.length; index += 1) {
    if (index > 0) timeline.push({ on: false, ms: unit });
    timeline.push({ on: true, ms: (code[index] === '-' ? 3 : 1) * unit });
  }
}

function farnsworthGapMs(wpm: number, farnsworthWpm: number, units: number): number {
  const ta = (60 * wpm - 37.2 * farnsworthWpm) / (19 * wpm * farnsworthWpm);
  return units * ta * 1000;
}

function envelope(index: number, count: number, attack: number, release: number): number {
  const span = count - 1;
  const attackSpan = Math.min(attack, span / 2);
  const releaseSpan = Math.min(release, span / 2);
  if (index < attackSpan) return attackSpan === 0 ? 1 : index / attackSpan;
  if (index > span - releaseSpan) {
    return releaseSpan === 0 ? 1 : (span - index) / releaseSpan;
  }
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
