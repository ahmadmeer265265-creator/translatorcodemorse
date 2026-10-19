import {
  createMicDecoder,
  type MicDecoder,
  type MicDecoderState,
} from './mic-decode';

export type MicMountOptions = {
  root: HTMLElement;
  text: HTMLTextAreaElement;
  morse: HTMLTextAreaElement;
  announce: (message: string) => void;
  showSlash: () => boolean;
  onOutput: () => void;
  haltAudio: () => void;
};

export type MicModeHandle = {
  focusStart: () => void;
  destroy: () => void;
  clear: () => void;
};

const BTN =
  'inline-flex min-h-11 items-center justify-center rounded-full border-2 border-line bg-canvas px-4 text-sm font-medium text-ink';
const PRIMARY =
  'inline-flex min-h-11 items-center justify-center rounded-full border-2 border-transparent bg-accent px-4 text-sm font-semibold text-on-accent';

/**
 * Map the 0–100 slider to an RMS threshold (0.02 sensitive … 0.12 strict).
 * Floor stays above typical CW tone-ramp / AnalyserNode bleed so letter gaps
 * (3 units) are not eaten into intra gaps at max sensitivity.
 */
const thresholdFor = (sensitivity: number) => 0.02 + ((100 - sensitivity) / 100) * 0.1;

export function mountMicMode(options: MicMountOptions): MicModeHandle {
  const { root, text, morse, announce, showSlash, onOutput, haltAudio } = options;

  let decoder: MicDecoder = createMicDecoder({ showSlash: showSlash() });
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let rafId = 0;
  let running = false;
  /** Currently-open mark start time (performance.now ms), null when silent. */
  let markStart: number | null = null;
  /** Last emitted amplitude sample time, for segment durations. */
  let lastTick = 0;
  let wasMark = false;
  /** Announce throttle: avoid spamming the live region on every frame. */
  let lastAnnounce = 0;
  /** Recent letter count for "still listening" heartbeat announcements. */
  let lettersSinceHeartbeat = 0;
  let sampleBuf: Float32Array<ArrayBuffer> | null = null;

  const shell = document.createElement('div');
  shell.dataset.micShell = '';
  shell.className = 'grid gap-2';
  shell.innerHTML = `
    <p class="text-sm font-semibold">Listen (mic)</p>
    <p class="text-xs text-muted" data-mic-privacy>
      Audio is analyzed on this device only. It is never recorded or sent anywhere.
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="${PRIMARY}" data-mic-toggle aria-pressed="false">Start listening</button>
    </div>
    <div
      class="h-3 w-full max-w-sm overflow-hidden rounded-full border border-line bg-canvas"
      role="meter"
      aria-label="Microphone level"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="0"
      data-mic-meter
    >
      <div class="h-full w-0 bg-accent transition-none" data-mic-bar></div>
    </div>
    <label class="grid min-h-11 content-center gap-1 text-sm" data-mic-sens-row>
      <span class="flex items-baseline justify-between gap-3 font-medium">
        <span>Pickup sensitivity</span>
        <output data-mic-sens-value>70</output>
      </span>
      <input class="h-11 w-full max-w-sm" type="range" min="0" max="100" value="70" data-mic-sens />
    </label>
    <p class="min-h-6 font-mono text-lg tracking-widest text-ink" data-mic-marks aria-live="off"></p>
    <p class="hidden text-xs text-muted" data-mic-error role="alert"></p>
  `;
  root.append(shell);

  const toggle = shell.querySelector('[data-mic-toggle]') as HTMLButtonElement;
  const meter = shell.querySelector('[data-mic-meter]') as HTMLElement;
  const bar = shell.querySelector('[data-mic-bar]') as HTMLElement;
  const sens = shell.querySelector('[data-mic-sens]') as HTMLInputElement;
  const sensValue = shell.querySelector('[data-mic-sens-value]') as HTMLOutputElement;
  const marksEl = shell.querySelector('[data-mic-marks]') as HTMLElement;
  const errorEl = shell.querySelector('[data-mic-error]') as HTMLElement;

  const setError = (message: string) => {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  };

  const applyState = (state: MicDecoderState) => {
    marksEl.textContent = state.marks || ' ';
    text.value = state.text;
    morse.value = state.morse;
    onOutput();
  };

  const announceNow = (message: string) => {
    lastAnnounce = performance.now();
    announce(message);
  };

  const stopTracks = () => {
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
    }
    stream = null;
  };

  const teardownAudio = async () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
    markStart = null;
    try {
      source?.disconnect();
    } catch {
      // ignore
    }
    try {
      analyser?.disconnect();
    } catch {
      // ignore
    }
    source = null;
    analyser = null;
    stopTracks();
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
    ctx = null;
    bar.style.width = '0%';
    meter.setAttribute('aria-valuenow', '0');
  };

  const setListeningUi = (listening: boolean) => {
    toggle.textContent = listening ? 'Stop listening' : 'Start listening';
    toggle.setAttribute('aria-pressed', listening ? 'true' : 'false');
  };

  const rms = (buf: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = buf[i]!;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  };

  const feedMark = (durationMs: number) => {
    const before = decoder.snapshot().text.length;
    decoder.push({ type: 'mark', durationMs });
    const state = decoder.snapshot();
    applyState(state);
    const lastEvent = state.events[state.events.length - 1];
    if (lastEvent?.kind === 'letter') {
      lettersSinceHeartbeat += 1;
      const now = performance.now();
      // Announce each letter but throttle to ~1 per 350ms so fast decode
      // does not spam the live region; also give an occasional heartbeat.
      if (now - lastAnnounce > 350) {
        announceNow(`Letter ${lastEvent.letter.char}`);
        lettersSinceHeartbeat = 0;
      } else if (lettersSinceHeartbeat >= 4) {
        announceNow('Decoding…');
        lettersSinceHeartbeat = 0;
      }
    } else if (lastEvent?.kind === 'word') {
      announceNow('Word break');
    }
    void before;
  };

  const feedSpace = (durationMs: number) => {
    const prevLetters = decoder.snapshot().text.length;
    decoder.push({ type: 'space', durationMs });
    const state = decoder.snapshot();
    applyState(state);
    if (state.text.length > prevLetters) {
      const lastEvent = state.events[state.events.length - 1];
      if (lastEvent?.kind === 'letter') {
        const now = performance.now();
        if (now - lastAnnounce > 350) announceNow(`Letter ${lastEvent.letter.char}`);
      }
    }
  };

  const tick = (now: number) => {
    if (!running || !analyser) return;
    if (!sampleBuf || sampleBuf.length !== analyser.fftSize) {
      sampleBuf = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(sampleBuf);
    const level = rms(sampleBuf);
    const threshold = thresholdFor(Number(sens.value));

    // Level meter (visual only; width change does not shift layout).
    const pct = Math.min(100, Math.round((level / 0.25) * 100));
    bar.style.width = `${pct}%`;
    meter.setAttribute('aria-valuenow', String(pct));

    const isMark = level >= threshold;

    if (isMark) {
      // Tone present. Close any accumulated silence as ONE space segment,
      // then open (or continue) the current mark.
      if (spaceStart !== null) {
        feedSpace(now - spaceStart);
        spaceStart = null;
      }
      if (markStart === null) markStart = now;
    } else {
      // Silence. Close any open mark, then accumulate silence. Resolve any
      // trailing letter/word live via silence() (which does not consume the
      // gap); the full gap is still fed as one segment when the next mark
      // arrives.
      if (markStart !== null) {
        feedMark(now - markStart);
        markStart = null;
      }
      if (spaceStart === null) spaceStart = now;
      else {
        const before = decoder.snapshot();
        decoder.silence(now - spaceStart);
        const after = decoder.snapshot();
        if (after.text !== before.text || after.marks !== before.marks) applyState(after);
      }
    }
    wasMark = isMark;
    rafId = requestAnimationFrame(tick);
  };

  let spaceStart: number | null = null;

  const start = async () => {
    setError('');
    haltAudio();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This feature needs microphone support, which this browser does not provide.');
      announceNow('Microphone is not supported in this browser.');
      return;
    }
    if (!window.isSecureContext) {
      setError('This feature needs a secure connection (https) to use the microphone.');
      announceNow('A secure connection is required for the microphone.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('Microphone access was denied. Allow microphone access in your browser’s site settings to use this mode.');
        announceNow('Microphone access was denied.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('No microphone was found on this device.');
        announceNow('No microphone was found.');
      } else {
        setError('Could not start the microphone. Check that no other app is using it and try again.');
        announceNow('Could not start the microphone.');
      }
      stream = null;
      return;
    }

    const Ctx =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      setError('This browser does not support the Web Audio API needed to decode the microphone.');
      announceNow('Web Audio is not supported.');
      stopTracks();
      return;
    }
    ctx = new Ctx();
    await ctx.resume().catch(() => {});
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    decoder.reset();
    applyState(decoder.snapshot());
    marksEl.textContent = ' ';
    running = true;
    markStart = null;
    spaceStart = null;
    wasMark = false;
    lastTick = performance.now();
    setListeningUi(true);
    announceNow('Listening. Send Morse code near the microphone.');
    rafId = requestAnimationFrame(tick);
  };

  const stop = async (silent = false) => {
    if (!running && !stream) return;
    // Flush any trailing mark/space so the last letter resolves.
    const now = performance.now();
    if (markStart !== null) feedMark(now - markStart);
    if (spaceStart !== null) feedSpace(now - spaceStart);
    markStart = null;
    spaceStart = null;
    decoder.flush();
    applyState(decoder.snapshot());
    await teardownAudio();
    setListeningUi(false);
    if (!silent) announceNow('Stopped listening.');
  };

  toggle.addEventListener('click', () => {
    if (running) void stop();
    else void start();
  });

  sens.addEventListener('input', () => {
    sensValue.textContent = sens.value;
  });

  // Stop the mic if the tab is hidden while listening (covers navigation
  // away / minimize), so the microphone is never held in the background.
  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && running) void stop(true);
  };
  document.addEventListener('visibilitychange', onVisibility);

  marksEl.textContent = ' ';

  return {
    focusStart() {
      toggle.focus();
    },
    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      void stop(true);
      shell.remove();
    },
    clear() {
      decoder.reset();
      applyState(decoder.snapshot());
      marksEl.textContent = ' ';
    },
  };
}
