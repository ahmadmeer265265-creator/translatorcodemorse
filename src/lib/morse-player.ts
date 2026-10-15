import {
  buildTimeline,
  encodeWav,
  effectivePeak,
  timelineDuration,
  WAV_LIMIT_MS,
  CW_RAMP_SEC,
  type Segment,
  type SoundType,
  type Waveform,
} from './morse-audio';
import {
  buildVibrationChunks,
  canAutoplayMorse,
  flashStateAt,
  repeatGapMs,
  telegraphClicksForSignal,
} from './audio-effects';
import { buildEnrichedTimeline, type EnrichedTimeline } from './morse-timeline';
import {
  groupAtTime,
  parseMorseGroups,
  renderHighlightedHtml,
  textLetterSpans,
  type MorseGroupSpan,
} from './morse-highlight';

export type AudioSettings = {
  wpm: number;
  farnsworthWpm: number;
  frequency: number;
  volume: number;
  soundType: SoundType;
  waveform: Waveform;
  repeat: boolean;
  flash: boolean;
  vibration: boolean;
};

export type PlaybackHooks = {
  status: (message: string) => void;
  setState: (state: PlaybackState) => void;
  onGroup: (groupIndex: number, group: MorseGroupSpan | null) => void;
  onFlash: (on: boolean) => void;
  vibrate: (pattern: number[]) => void;
};

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished';

type ToneNode = { stop: (time?: number) => void };

const LOOKAHEAD_SEC = 1.5;

export function scheduleAhead(
  timeline: readonly Segment[],
  index: number,
  nextTime: number,
  now: number,
  lookahead = LOOKAHEAD_SEC,
): { index: number; nextTime: number; toneCount: number } {
  const horizon = now + lookahead;
  let time = nextTime;
  let cursor = index;
  let toneCount = 0;
  while (cursor < timeline.length && time < horizon) {
    if (timeline[cursor]!.on) toneCount += 1;
    time += timeline[cursor]!.ms / 1000;
    cursor += 1;
  }
  return { index: cursor, nextTime: time, toneCount };
}

export function armTone(
  ctx: AudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  frequency: number,
  peak: number,
  waveform: Waveform = 'sine',
): ToneNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = waveform === 'square' ? 'square' : 'sine';
  osc.frequency.value = frequency;
  let chain: AudioNode = osc;
  if (waveform === 'square' && 'createBiquadFilter' in ctx) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(4000, frequency * 4);
    osc.connect(filter);
    chain = filter;
  }
  chain.connect(gain);
  gain.connect(destination);
  const attack = Math.min(CW_RAMP_SEC, duration / 2);
  const release = Math.min(CW_RAMP_SEC, duration / 2);
  const end = start + duration;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
  gain.gain.linearRampToValueAtTime(0, end);
  osc.start(start);
  osc.stop(end);
  return osc;
}

export function armTelegraphClick(
  ctx: AudioContext,
  destination: AudioNode,
  start: number,
  durationSec: number,
  peak: number,
  kind: 'down' | 'up',
): ToneNode {
  const sampleRate = ctx.sampleRate;
  const frames = Math.max(1, Math.floor(durationSec * sampleRate));
  const buffer = ctx.createBuffer(1, frames, sampleRate);
  const data = buffer.getChannelData(0);
  let seed = kind === 'down' ? 1 : 99;
  let lp = 0;
  const alpha = kind === 'down' ? 0.35 : 0.55;
  const level = kind === 'down' ? peak : peak * 0.55;
  for (let i = 0; i < frames; i += 1) {
    seed = (seed * 16807) % 2147483647;
    const noise = (seed / 2147483647) * 2 - 1;
    lp = lp + alpha * (noise - lp);
    const env = i < frames * 0.2 ? i / (frames * 0.2) : i > frames * 0.6 ? (frames - i) / (frames * 0.4) : 1;
    data[i] = lp * env * level;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(destination);
  src.start(start);
  src.stop(start + durationSec);
  return src;
}

export type PlaybackHandle = {
  pause: () => void;
  resume: () => void;
  stop: (announce?: boolean) => void;
  getState: () => PlaybackState;
  /** Elapsed audio seconds since start (accounts for suspend) */
  elapsedSec: () => number;
};

export function createPlayback(
  ctx: AudioContext,
  enriched: EnrichedTimeline,
  settings: AudioSettings,
  hooks: PlaybackHooks,
): PlaybackHandle {
  const timeline = enriched.segments;
  const plain = timeline.map(({ on, ms }) => ({ on, ms }));
  if (!plain.some((segment) => segment.on)) {
    hooks.status('Nothing to play');
    hooks.setState('idle');
    return {
      pause() {},
      resume() {},
      stop() {},
      getState: () => 'idle',
      elapsedSec: () => 0,
    };
  }

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  const peak = effectivePeak(settings.volume, settings.soundType, settings.waveform);

  let index = 0;
  let nextTime = ctx.currentTime;
  let origin = ctx.currentTime;
  let pausedAt: number | null = null;
  let timer = 0;
  let raf = 0;
  let state: PlaybackState = 'playing';
  let finished = false;
  const nodes: ToneNode[] = [];

  const clearTimers = () => {
    globalThis.clearTimeout(timer);
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
  };

  const elapsedSec = () => {
    if (pausedAt !== null) return pausedAt - origin;
    return Math.max(0, ctx.currentTime - origin);
  };

  const updateVisuals = () => {
    if (state !== 'playing' && state !== 'paused') return;
    const ms = elapsedSec() * 1000;
    const gIndex = groupAtTime(enriched.groupStartMs, enriched.groupDurationMs, ms);
    hooks.onGroup(gIndex, gIndex >= 0 ? enriched.groups[gIndex]! : null);
    if (settings.flash) hooks.onFlash(flashStateAt(plain, ms) === 'on');
    if (state === 'playing' && typeof requestAnimationFrame === 'function') {
      raf = requestAnimationFrame(updateVisuals);
    }
  };

  const startVibration = (fromMs: number) => {
    if (!settings.vibration) return;
    const chunks = buildVibrationChunks(plain, fromMs);
    if (chunks[0]) hooks.vibrate(chunks[0]);
  };

  const schedule = () => {
    if (finished || state === 'paused') return;
    // Drive from AudioContext time — when suspended, currentTime freezes and we wait.
    if (ctx.state === 'suspended') {
      timer = globalThis.setTimeout(schedule, 50) as unknown as number;
      return;
    }
    const planned = scheduleAhead(plain, index, nextTime, ctx.currentTime);
    while (index < planned.index) {
      const segment = timeline[index]!;
      const seconds = segment.ms / 1000;
      if (segment.on) {
        if (settings.soundType === 'telegraph') {
          for (const click of telegraphClicksForSignal(segment.ms)) {
            nodes.push(
              armTelegraphClick(
                ctx,
                master,
                nextTime + click.atMs / 1000,
                click.durationMs / 1000,
                peak,
                click.kind,
              ),
            );
          }
        } else {
          nodes.push(armTone(ctx, master, nextTime, seconds, settings.frequency, peak, settings.waveform));
        }
      }
      nextTime += seconds;
      index += 1;
    }
    if (index < timeline.length) {
      timer = globalThis.setTimeout(schedule, 100) as unknown as number;
      return;
    }
    const wait = Math.max(0, (nextTime - ctx.currentTime) * 1000);
    timer = globalThis.setTimeout(() => {
      if (finished || state === 'paused') return;
      if (settings.repeat) {
        const gap = repeatGapMs(settings.wpm) / 1000;
        hooks.status('Playing (repeat on)');
        timer = globalThis.setTimeout(() => {
          if (finished || state === 'paused') return;
          index = 0;
          origin = ctx.currentTime;
          nextTime = ctx.currentTime;
          startVibration(0);
          schedule();
        }, gap * 1000) as unknown as number;
        return;
      }
      finished = true;
      state = 'finished';
      clearTimers();
      hooks.vibrate([0]);
      hooks.onFlash(false);
      hooks.onGroup(-1, null);
      hooks.setState('finished');
      hooks.status('Finished');
    }, wait) as unknown as number;
  };

  hooks.setState('playing');
  hooks.status(settings.repeat ? 'Playing (repeat on)' : 'Playing');
  startVibration(0);
  schedule();
  // Paint flash/highlight immediately — do not wait a frame. Short dits at
  // typical WPM can end before the first rAF, which made the lamp look dead.
  updateVisuals();

  return {
    pause() {
      if (state !== 'playing' || finished) return;
      pausedAt = ctx.currentTime;
      state = 'paused';
      clearTimers();
      void ctx.suspend();
      hooks.vibrate([0]);
      hooks.setState('paused');
      hooks.status('Paused');
      updateVisuals();
    },
    resume() {
      if (state !== 'paused' || finished) return;
      const pausedElapsed = (pausedAt ?? ctx.currentTime) - origin;
      void ctx.resume().then(() => {
        // Keep origin such that elapsedSec() continues from pausedElapsed
        origin = ctx.currentTime - pausedElapsed;
        // nextTime is absolute audio time — shift by resume delta
        const delta = ctx.currentTime - (pausedAt ?? ctx.currentTime);
        nextTime += delta;
        pausedAt = null;
        state = 'playing';
        hooks.setState('playing');
        hooks.status(settings.repeat ? 'Playing (repeat on)' : 'Playing');
        startVibration(pausedElapsed * 1000);
        schedule();
        updateVisuals();
      });
    },
    stop(announce = true) {
      if (finished && state === 'idle') return;
      finished = true;
      state = 'idle';
      clearTimers();
      pausedAt = null;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
      for (const node of nodes) {
        try {
          node.stop(ctx.currentTime);
        } catch {
          // already stopped
        }
      }
      hooks.vibrate([0]);
      hooks.onFlash(false);
      hooks.onGroup(-1, null);
      hooks.setState('idle');
      if (announce) hooks.status('Stopped');
      if (ctx.state === 'suspended') void ctx.resume();
    },
    getState: () => state,
    elapsedSec,
  };
}

export function playMorse(ctx: AudioContext, morse: string, settings: AudioSettings, hooks: PlaybackHooks) {
  const enriched = buildEnrichedTimeline(morse, {
    wpm: settings.wpm,
    farnsworthWpm: settings.farnsworthWpm,
  });
  return createPlayback(ctx, enriched, settings, hooks);
}

export function prepareWav(
  morse: string,
  settings: AudioSettings,
): { bytes: Uint8Array; seconds: number } | { limit: number } | null {
  const timeline = buildTimeline(morse, { wpm: settings.wpm, farnsworthWpm: settings.farnsworthWpm });
  if (!timeline.some((segment) => segment.on)) return null;
  const ms = timelineDuration(timeline);
  if (ms > WAV_LIMIT_MS) return { limit: ms / 1000 };
  return {
    bytes: encodeWav(timeline, {
      frequency: settings.frequency,
      volume: settings.volume,
      sampleRate: 44100,
      soundType: settings.soundType,
      waveform: settings.waveform,
    }),
    seconds: ms / 1000,
  };
}

let playback: PlaybackHandle | null = null;

function readSettings(): AudioSettings {
  const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
  const sound = (document.querySelector('[data-sound-type]') as HTMLSelectElement | null)?.value;
  const wave = (document.querySelector('[data-waveform]') as HTMLSelectElement | null)?.value;
  const repeat = document.querySelector('[data-repeat]') as HTMLButtonElement | null;
  const flash = document.querySelector('[data-flash-opt]') as HTMLInputElement | null;
  const vibration = document.querySelector('[data-vibration]') as HTMLInputElement | null;
  return {
    wpm: num('translator-wpm'),
    farnsworthWpm: num('translator-farnsworth'),
    frequency: num('translator-tone'),
    volume: num('translator-volume') / 100,
    soundType: sound === 'telegraph' ? 'telegraph' : 'cw',
    waveform: wave === 'square' ? 'square' : 'sine',
    repeat: repeat?.getAttribute('aria-pressed') === 'true',
    flash: Boolean(flash?.checked),
    vibration: Boolean(vibration?.checked),
  };
}

function showStatus(message: string) {
  const node = document.getElementById('translator-audio-status');
  if (node) node.textContent = message;
}

function defaultVibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

export type PlayerUi = {
  text?: HTMLTextAreaElement | null;
  morse?: HTMLTextAreaElement | null;
  textMirror?: HTMLElement | null;
  morseMirror?: HTMLElement | null;
  lamp?: HTMLElement | null;
  setState: (state: PlaybackState) => void;
  onFlash: (on: boolean) => void;
};

let uiBridge: PlayerUi = {
  setState() {},
  onFlash() {},
};

export function bindPlayerUi(ui: PlayerUi) {
  uiBridge = ui;
}

function applyHighlight(groupIndex: number) {
  const text = uiBridge.text;
  const morse = uiBridge.morse;
  const textMirror = uiBridge.textMirror;
  const morseMirror = uiBridge.morseMirror;
  if (!(text instanceof HTMLTextAreaElement) || !(morse instanceof HTMLTextAreaElement)) return;
  if (groupIndex < 0) {
    text.classList.remove('is-highlighting');
    morse.classList.remove('is-highlighting');
    if (textMirror) textMirror.textContent = '';
    if (morseMirror) morseMirror.textContent = '';
    return;
  }
  const groups = parseMorseGroups(morse.value);
  const group = groups[groupIndex];
  const letters = textLetterSpans(text.value);
  text.classList.add('is-highlighting');
  morse.classList.add('is-highlighting');
  if (morseMirror && group) {
    morseMirror.innerHTML = renderHighlightedHtml(morse.value, group.morseStart, group.morseEnd);
    morseMirror.scrollTop = morse.scrollTop;
  }
  if (textMirror) {
    const span = letters[groupIndex] ?? (group ? { start: group.textStart, end: group.textEnd } : null);
    if (span) {
      textMirror.innerHTML = renderHighlightedHtml(text.value, span.start, span.end);
      textMirror.scrollTop = text.scrollTop;
    }
  }
}

export function stopPlayback(announce = false) {
  const current = playback;
  playback = null;
  current?.stop(announce);
}

export function pausePlayback() {
  playback?.pause();
}

export function resumePlayback() {
  playback?.resume();
}

export function getPlaybackState(): PlaybackState {
  return playback?.getState() ?? 'idle';
}

export function startPlayback(ctx: AudioContext | null) {
  if (!ctx) {
    showStatus('Audio is not available in this browser.');
    return;
  }
  stopPlayback(false);
  const morse = (document.getElementById('translator-morse') as HTMLTextAreaElement).value;
  if (!canAutoplayMorse(morse) && !/[.-]/.test(morse)) {
    showStatus('Nothing to play');
    uiBridge.setState('idle');
    return;
  }
  const handle = playMorse(ctx, morse, readSettings(), {
    status: showStatus,
    setState: (state) => {
      uiBridge.setState(state);
      if (state === 'idle' || state === 'finished') {
        applyHighlight(-1);
        playback = null;
      }
    },
    onGroup: (groupIndex) => applyHighlight(groupIndex),
    onFlash: uiBridge.onFlash,
    vibrate: defaultVibrate,
  });
  playback = handle;
}

/** @deprecated use startPlayback / stopPlayback — kept for older wiring */
export function togglePlayback(ctx: AudioContext | null) {
  if (playback && playback.getState() === 'playing') {
    stopPlayback(true);
    return;
  }
  startPlayback(ctx);
}

export function downloadCurrent() {
  const morse = (document.getElementById('translator-morse') as HTMLTextAreaElement).value;
  const ready = prepareWav(morse, readSettings());
  if (!ready) {
    showStatus('Nothing to play');
    return;
  }
  if ('limit' in ready) {
    showStatus(`Audio is ${ready.limit.toFixed(1)} s, over the 5 minute limit.`);
    return;
  }
  downloadWav(ready.bytes);
  showStatus(`WAV ready (${ready.seconds.toFixed(1)} s)`);
}

export function downloadWav(bytes: Uint8Array, name = 'morse-code.wav'): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export { canAutoplayMorse, buildEnrichedTimeline, repeatGapMs };
