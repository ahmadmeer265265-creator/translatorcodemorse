import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const TRANSLATOR = 'public/embed/morse-code-translator/index.html';
const CHART = 'public/embed/morse-code-chart/index.html';

type Osc = { startCalls: number[]; stopCalls: number[] };
type FakeEl = {
  id: string;
  value: string;
  textContent: string;
  innerHTML: string;
  disabled: boolean;
  type: string;
  className: string;
  children: FakeEl[];
  attrs: Record<string, string>;
  listeners: Record<string, Array<(event?: { key?: string }) => void>>;
  classList: { add: (c: string) => void; remove: (c: string) => void; contains: (c: string) => boolean };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (type: string, fn: (event?: { key?: string }) => void) => void;
  appendChild: (child: FakeEl) => FakeEl;
  focus: () => void;
};
type Ctx = { currentTime: number; oscs: Osc[] };

function makeEl(id: string): FakeEl {
  const node: FakeEl = {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    type: '',
    className: '',
    children: [],
    attrs: {},
    listeners: {},
    classList: {
      add(token: string) {
        const parts = node.className.split(/\s+/).filter(Boolean);
        if (!parts.includes(token)) parts.push(token);
        node.className = parts.join(' ');
      },
      remove(token: string) {
        node.className = node.className
          .split(/\s+/)
          .filter((part) => part && part !== token)
          .join(' ');
      },
      contains(token: string) {
        return node.className.split(/\s+/).includes(token);
      },
    },
    setAttribute(name: string, value: string) {
      node.attrs[name] = value;
    },
    getAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(node.attrs, name) ? node.attrs[name] : null;
    },
    addEventListener(type: string, fn: (event?: { key?: string }) => void) {
      (node.listeners[type] ??= []).push(fn);
    },
    appendChild(child: FakeEl) {
      node.children.push(child);
      return child;
    },
    focus() {},
  };
  return node;
}

function bootWidget(html: string, ids: string[]) {
  const byId: Record<string, FakeEl> = {};
  const roots = ids.map((id) => {
    const el = makeEl(id);
    byId[id] = el;
    return el;
  });
  const contexts: Ctx[] = [];
  const timers: Array<{ id: number; fn: () => void }> = [];
  let timerSeq = 1;
  let mark = 0;
  function walk(node: FakeEl, out: FakeEl[]) {
    out.push(node);
    node.children.forEach((child) => walk(child, out));
  }
  function AudioContext(this: Ctx & { state: string; destination: object }) {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
    this.oscs = [];
    contexts.push(this);
  }
  AudioContext.prototype.resume = function resume() {};
  AudioContext.prototype.createGain = function createGain() {
    return {
      connect() {},
      gain: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
        setTargetAtTime() {},
      },
    };
  };
  AudioContext.prototype.createOscillator = function createOscillator(this: Ctx) {
    const osc: Osc & {
      type: string;
      frequency: { value: number };
      onended: null | (() => void);
      connect: () => void;
      start: (t: number) => void;
      stop: (t?: number) => void;
    } = {
      type: 'sine',
      frequency: { value: 0 },
      onended: null,
      startCalls: [],
      stopCalls: [],
      connect() {},
      start(t: number) {
        this.startCalls.push(t);
      },
      stop(t?: number) {
        this.stopCalls.push(t ?? Number.NaN);
      },
    };
    this.oscs.push(osc);
    return osc;
  };
  const document = {
    getElementById(id: string) {
      return byId[id] ?? null;
    },
    createElement() {
      return makeEl('');
    },
    querySelectorAll(sel: string) {
      const classes = sel.split('.').filter(Boolean);
      const all: FakeEl[] = [];
      roots.forEach((root) => walk(root, all));
      return all.filter((node) => classes.every((token) => node.classList.contains(token)));
    },
  };
  const sandbox: Record<string, unknown> = {
    document,
    console,
    setTimeout(fn: () => void) {
      const id = timerSeq++;
      timers.push({ id, fn });
      return id;
    },
    clearTimeout(id: number) {
      const index = timers.findIndex((timer) => timer.id === id);
      if (index >= 0) timers.splice(index, 1);
    },
  };
  sandbox.window = sandbox;
  sandbox.AudioContext = AudioContext;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error('embed script missing');
  vm.runInNewContext(script, sandbox);
  function allOscs() {
    return contexts.flatMap((ctx) => ctx.oscs);
  }
  return {
    byId,
    contexts,
    click(id: string) {
      (byId[id].listeners.click ?? []).forEach((fn) => fn());
    },
    input(id: string) {
      (byId[id].listeners.input ?? []).forEach((fn) => fn());
    },
    key(ch: string) {
      const all: FakeEl[] = [];
      roots.forEach((root) => walk(root, all));
      const button = all.find((node) => node.getAttribute('data-ch') === ch);
      if (!button) throw new Error(`missing key ${ch}`);
      (button.listeners.click ?? []).forEach((fn) => fn());
    },
    fresh() {
      const oscs = allOscs().slice(mark);
      mark = allOscs().length;
      return oscs;
    },
  };
}

function effectiveStop(osc: Osc) {
  return osc.stopCalls[osc.stopCalls.length - 1];
}

function assertSilenced(oscs: Osc[], now: number) {
  expect(oscs.length).toBeGreaterThan(0);
  for (const osc of oscs) {
    expect(effectiveStop(osc)).toBeLessThanOrEqual(now + 0.1);
  }
}

const translatorIds = ['mtText', 'mtMorse', 'mtMsg', 'mtSpeed', 'mtPlay', 'mtStop', 'mtCopy', 'mtClear'];
const chartIds = ['mcSpeed', 'mcPlayWord', 'mcStop', 'mcNow', 'mcWord', 'mcLetters', 'mcNumbers', 'mcPunct'];

describe('embed playback fixes', () => {
  it('keeps a 7-unit silence between E and E at 10, 15, and 22 WPM', () => {
    const html = readFileSync(resolve(TRANSLATOR), 'utf8');
    for (const wpm of [10, 15, 22]) {
      const widget = bootWidget(html, translatorIds);
      widget.byId.mtSpeed.value = String(wpm);
      widget.byId.mtMorse.value = '. / .';
      widget.click('mtPlay');
      const oscs = widget.fresh();
      expect(oscs).toHaveLength(2);
      const unitSec = 1200 / wpm / 1000;
      const silence = oscs[1].startCalls[0] - (oscs[0].startCalls[0] + unitSec);
      expect(silence / unitSec).toBeCloseTo(7, 8);
    }
  });

  it('silences a playing translator message on Stop and on Clear', () => {
    const html = readFileSync(resolve(TRANSLATOR), 'utf8');
    const widget = bootWidget(html, translatorIds);
    widget.byId.mtMorse.value = '... --- ... / ... --- ...';
    widget.click('mtPlay');
    const played = widget.fresh();
    const now = widget.contexts[0].currentTime;
    widget.click('mtStop');
    assertSilenced(played, now);

    widget.byId.mtMorse.value = '... --- ... / ... --- ...';
    widget.click('mtPlay');
    const again = widget.fresh();
    const nowClear = widget.contexts[0].currentTime;
    widget.click('mtClear');
    assertSilenced(again, nowClear);
    expect(widget.byId.mtMsg.textContent).toBe('');
  });

  it('silences the chart when Stop interrupts a word or a letter key', () => {
    const html = readFileSync(resolve(CHART), 'utf8');
    const widget = bootWidget(html, chartIds);
    widget.byId.mcWord.value = 'OO';
    widget.click('mcPlayWord');
    const word = widget.fresh();
    const now = widget.contexts[0].currentTime;
    widget.click('mcStop');
    assertSilenced(word, now);

    widget.key('O');
    const letter = widget.fresh();
    const nowLetter = widget.contexts[0].currentTime;
    widget.click('mcStop');
    assertSilenced(letter, nowLetter);
  });

  it('notes unsupported characters without changing encode or flagging ß', () => {
    const html = readFileSync(resolve(TRANSLATOR), 'utf8');
    const widget = bootWidget(html, translatorIds);
    const type = (value: string) => {
      widget.byId.mtText.value = value;
      widget.input('mtText');
    };
    type('hi é');
    expect(widget.byId.mtMsg.textContent).toBe('Not supported and skipped: é');
    expect(widget.byId.mtMorse.value).toBe('.... ..');
    type('hi');
    expect(widget.byId.mtMsg.textContent).toBe('');
    type('😀');
    expect(widget.byId.mtMsg.textContent).toBe('Not supported and skipped: 😀');
    type('ß');
    expect(widget.byId.mtMsg.textContent).toBe('');
    expect(widget.byId.mtMorse.value).toBe('... ...');
    type('éàèùçñö');
    expect(widget.byId.mtMsg.textContent).toBe('Not supported and skipped: é à è ù ç ñ ...');
    type('éé');
    expect(widget.byId.mtMsg.textContent).toBe('Not supported and skipped: é');
    type('hi é');
    widget.byId.mtMorse.value = '.';
    widget.input('mtMorse');
    expect(widget.byId.mtMsg.textContent).toBe('');
    type('hi é');
    widget.click('mtClear');
    expect(widget.byId.mtMsg.textContent).toBe('');
  });

  it('opens credit links in a new tab and keeps the robots meta', () => {
    const translator = readFileSync(resolve(TRANSLATOR), 'utf8');
    const chart = readFileSync(resolve(CHART), 'utf8');
    expect(translator).toContain(
      '<a href="https://translatorcodemorse.com/" target="_blank" rel="nofollow noopener">',
    );
    expect(chart).toContain(
      '<a href="https://translatorcodemorse.com/morse-code-alphabet/" target="_blank" rel="nofollow noopener">',
    );
    expect(translator).not.toContain('target="_top"');
    expect(chart).not.toContain('target="_top"');
    for (const html of [translator, chart]) {
      expect(html).toContain('<meta name="robots" content="noindex, indexifembedded">');
    }
  });
});
