import { createTapEngine, type TapEngine, type TapSnapshot } from './tap-timing';

export type TapMountOptions = {
  root: HTMLElement;
  text: HTMLTextAreaElement;
  morse: HTMLTextAreaElement;
  announce: (message: string) => void;
  vibrateEnabled: () => boolean;
  showSlash: () => boolean;
  onOutput: () => void;
  haltAudio: () => void;
};

export type TapModeHandle = {
  focusPad: () => void;
  destroy: () => void;
  clear: () => void;
  syncFromSettings: () => void;
};

const PAD_CLASS =
  'tap-pad flex min-h-[88px] w-full max-w-sm cursor-pointer select-none items-center justify-center rounded-2xl border-2 border-line bg-canvas px-4 py-6 text-center text-sm font-semibold text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[pressed=true]:border-accent data-[pressed=true]:bg-accent data-[pressed=true]:text-on-accent';
const BTN =
  'inline-flex min-h-11 items-center justify-center rounded-full border-2 border-line bg-canvas px-3 text-sm font-medium text-ink';

export function mountTapMode(options: TapMountOptions): TapModeHandle {
  const { root, text, morse, announce, vibrateEnabled, showSlash, onOutput, haltAudio } = options;

  let engine: TapEngine = createTapEngine({ now: () => performance.now() }, showSlash());
  let pressStarted: number | null = null;
  let tickTimer = 0;
  let pointerId: number | null = null;

  const shell = document.createElement('div');
  shell.dataset.tapShell = '';
  shell.className = 'grid gap-2';
  shell.innerHTML = `
    <p class="text-sm font-semibold">Tap input</p>
    <button type="button" class="${PAD_CLASS}" data-tap-pad aria-label="Tap pad. Short press for dot, long press for dash.">
      Tap: short = dot, long = dash
    </button>
    <p class="min-h-6 font-mono text-lg tracking-widest text-ink" data-tap-marks aria-live="off"></p>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="${BTN}" data-tap-word>Word break</button>
      <button type="button" class="${BTN}" data-tap-undo>Backspace</button>
    </div>
  `;
  root.append(shell);

  const pad = shell.querySelector('[data-tap-pad]') as HTMLButtonElement;
  const marksEl = shell.querySelector('[data-tap-marks]') as HTMLElement;
  const wordBtn = shell.querySelector('[data-tap-word]') as HTMLButtonElement;
  const undoBtn = shell.querySelector('[data-tap-undo]') as HTMLButtonElement;

  const applySnapshot = (snap: TapSnapshot) => {
    marksEl.textContent = snap.marks || '\u00a0';
    text.value = snap.text;
    morse.value = snap.morse;
    onOutput();
    if (snap.announcement?.kind === 'letter') {
      announce(`Letter ${snap.announcement.text}`);
    } else if (snap.announcement?.kind === 'word') {
      announce('Word break');
    }
  };

  const clearTick = () => {
    if (tickTimer) window.clearInterval(tickTimer);
    tickTimer = 0;
  };

  const ensureTick = () => {
    if (tickTimer) return;
    tickTimer = window.setInterval(() => {
      applySnapshot(engine.tick());
    }, 50);
  };

  const onPressStart = (event: PointerEvent) => {
    if (pressStarted !== null) return;
    event.preventDefault();
    pressStarted = performance.now();
    pad.dataset.pressed = 'true';
    pointerId = event.pointerId;
    try {
      pad.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (vibrateEnabled()) {
      try {
        navigator.vibrate?.(12);
      } catch {
        // ignore
      }
    }
  };

  const onPressEnd = (event: PointerEvent) => {
    if (pressStarted === null) return;
    if (pointerId !== null && event.pointerId !== pointerId) return;
    event.preventDefault();
    const duration = performance.now() - pressStarted;
    pressStarted = null;
    pointerId = null;
    pad.dataset.pressed = 'false';
    try {
      pad.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    haltAudio();
    applySnapshot(engine.press(duration));
    ensureTick();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' && event.key !== ' ') return;
    if (document.activeElement !== pad && !pad.contains(document.activeElement)) return;
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    if (pressStarted !== null) return;
    pressStarted = performance.now();
    pad.dataset.pressed = 'true';
    if (vibrateEnabled()) {
      try {
        navigator.vibrate?.(12);
      } catch {
        // ignore
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space' && event.key !== ' ') return;
    if (pressStarted === null) return;
    if (document.activeElement !== pad && !pad.contains(document.activeElement)) return;
    event.preventDefault();
    const duration = performance.now() - pressStarted;
    pressStarted = null;
    pad.dataset.pressed = 'false';
    haltAudio();
    applySnapshot(engine.press(duration));
    ensureTick();
  };

  pad.addEventListener('pointerdown', onPressStart);
  pad.addEventListener('pointerup', onPressEnd);
  pad.addEventListener('pointercancel', onPressEnd);
  pad.addEventListener('keydown', onKeyDown);
  pad.addEventListener('keyup', onKeyUp);

  wordBtn.addEventListener('click', () => {
    haltAudio();
    applySnapshot(engine.wordBreak());
    ensureTick();
  });
  undoBtn.addEventListener('click', () => {
    applySnapshot(engine.undoMark());
  });

  // Seed empty marks display
  marksEl.textContent = '\u00a0';

  return {
    focusPad() {
      pad.focus();
    },
    destroy() {
      clearTick();
      shell.remove();
    },
    clear() {
      applySnapshot(engine.clear());
    },
    syncFromSettings() {
      engine = createTapEngine({ now: () => performance.now() }, showSlash());
      marksEl.textContent = '\u00a0';
    },
  };
}
