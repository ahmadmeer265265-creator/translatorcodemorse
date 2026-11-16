import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { MACHINE_PAGE_PATH, MACHINE_THEME_PALETTE, type MachineTheme } from '../../lib/morse-machine-ui';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

const CYCLES = 10;
const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SHOT_DIR = path.join(ROOT, '.lighthouse', 'mm-theme-loop');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
};

const SURFACE: Record<MachineTheme, string> = {
  light: '#fffbf5',
  dark: '#1c1814',
};

type ThemeShot = {
  htmlTheme: string | null;
  mmTheme: string | null;
  colorScheme: string;
  machineBg: string;
  machineAccent: string;
  canvasVar: string;
  accentVar: string;
  bodyBg: string;
  pills: string[];
  tabBgs: string[];
  padBg: string;
  padAppearance: string;
  clearBg: string;
  clearAppearance: string;
  radioAppearances: string[];
  radioAccents: string[];
  rangeAccents: string[];
  checkboxAccents: string[];
  buttonBgs: { name: string; bg: string; appearance: string }[];
};

function hexToRgb(hex: string): string {
  const n = hex.replace('#', '');
  return `rgb(${Number.parseInt(n.slice(0, 2), 16)}, ${Number.parseInt(n.slice(2, 4), 16)}, ${Number.parseInt(n.slice(4, 6), 16)})`;
}

function normalizeColor(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'none' || trimmed === 'auto') return trimmed;
  if (trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)' || trimmed === 'rgba(0,0,0,0)') {
    return 'transparent';
  }
  const hex = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (hex) return hexToRgb(trimmed);
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)(?:\.0+)?\s*[,/ ]\s*(\d+)(?:\.0+)?\s*[,/ ]\s*(\d+)/);
  if (rgb) return `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
  return trimmed;
}

function startDistServer(): Promise<{ url: string; close: () => Promise<void> }> {
  if (!existsSync(DIST)) {
    throw new Error('dist/ missing — run pnpm build before the Morse Machine theme loop test');
  }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(DIST, p.replace(/^[/\\]+/, ''));
    res.setHeader('Cache-Control', 'no-store');
    try {
      const data = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const loc = server.address();
      if (!loc || typeof loc === 'string') {
        reject(new Error('theme loop server has no port'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${loc.port}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          }),
      });
    });
  });
}

async function collect(page: Page): Promise<ThemeShot> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-morse-machine]');
    if (!root) throw new Error('machine root missing');
    const styleOf = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo);
    const appearanceOf = (el: Element) => {
      const style = styleOf(el) as CSSStyleDeclaration & { webkitAppearance?: string };
      return style.appearance || style.webkitAppearance || '';
    };
    const buttons = [...root.querySelectorAll('button')].map((button) => ({
      name: (button.getAttribute('data-clear') != null ? 'clear' : button.textContent || '')
        .trim()
        .slice(0, 48),
      bg: getComputedStyle(button).backgroundColor,
      appearance: appearanceOf(button),
    }));
    return {
      htmlTheme: document.documentElement.getAttribute('data-theme'),
      mmTheme: root.getAttribute('data-mm-theme'),
      colorScheme: styleOf(root).colorScheme,
      machineBg: styleOf(root).backgroundColor,
      machineAccent: styleOf(root).accentColor,
      canvasVar: styleOf(root).getPropertyValue('--canvas').trim(),
      accentVar: styleOf(root).getPropertyValue('--accent').trim(),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      pills: [...root.querySelectorAll('.mm-tabs')].map((tab) => styleOf(tab, '::before').backgroundColor),
      tabBgs: [...root.querySelectorAll('.mm-tabs')].map((tab) => styleOf(tab).backgroundColor),
      padBg: styleOf(root.querySelector('.mm-pad') ?? root).backgroundColor,
      padAppearance: appearanceOf(root.querySelector('.mm-pad') ?? root),
      clearBg: styleOf(root.querySelector('[data-clear]') ?? root).backgroundColor,
      clearAppearance: appearanceOf(root.querySelector('[data-clear]') ?? root),
      radioAppearances: [...root.querySelectorAll("input[type='radio']")].map((el) => appearanceOf(el)),
      radioAccents: [...root.querySelectorAll("input[type='radio']")].map((el) => styleOf(el).accentColor),
      rangeAccents: [...root.querySelectorAll("input[type='range']")].map((el) => styleOf(el).accentColor),
      checkboxAccents: [...root.querySelectorAll("input[type='checkbox']")].map((el) => styleOf(el).accentColor),
      buttonBgs: buttons,
    };
  });
}

function assertShot(shot: ThemeShot, theme: MachineTheme, label: string) {
  const palette = MACHINE_THEME_PALETTE[theme];
  const canvas = hexToRgb(palette.canvas);
  const accent = hexToRgb(palette.accent);
  const surface = hexToRgb(SURFACE[theme]);
  const allowedBg = new Set([canvas, accent, surface, 'transparent', hexToRgb('#ffffff'), hexToRgb('#1a1208')]);
  const other = MACHINE_THEME_PALETTE[theme === 'dark' ? 'light' : 'dark'];
  const forbidden = new Set([
    hexToRgb(other.canvas),
    hexToRgb(other.accent),
    'rgb(18, 18, 18)',
    'rgb(0, 0, 0)',
    'rgb(255, 165, 0)',
    'rgb(0, 117, 255)',
  ]);

  const fail = (detail: string): never => {
    throw new Error(`${label}: ${detail}`);
  };

  if (shot.htmlTheme !== theme) fail(`html data-theme is ${shot.htmlTheme}, expected ${theme}`);
  if (shot.mmTheme !== theme) fail(`machine data-mm-theme is ${shot.mmTheme}, expected ${theme} (header/machine desync)`);
  if (!shot.colorScheme.includes(theme)) fail(`color-scheme is ${shot.colorScheme}, expected ${theme}`);
  if (normalizeColor(shot.canvasVar) !== palette.canvas && normalizeColor(shot.canvasVar) !== canvas) {
    fail(`--canvas is ${shot.canvasVar}, expected ${palette.canvas}`);
  }
  if (normalizeColor(shot.accentVar) !== palette.accent && normalizeColor(shot.accentVar) !== accent) {
    fail(`--accent is ${shot.accentVar}, expected ${palette.accent}`);
  }
  if (normalizeColor(shot.machineBg) !== canvas) fail(`machine background-color is ${shot.machineBg}, expected ${canvas}`);
  if (normalizeColor(shot.machineAccent) !== accent) {
    fail(`machine accent-color is ${shot.machineAccent}, expected ${accent}`);
  }
  if (normalizeColor(shot.bodyBg) !== canvas) fail(`body background-color is ${shot.bodyBg}, expected ${canvas}`);
  if (shot.pills.length === 0) fail('no tab pills found');
  for (const [index, pill] of shot.pills.entries()) {
    if (normalizeColor(pill) !== accent) fail(`tab ${index} ::before is ${pill}, expected ${accent}`);
  }
  for (const [index, bg] of shot.tabBgs.entries()) {
    if (normalizeColor(bg) !== canvas) fail(`tab ${index} background-color is ${bg}, expected ${canvas}`);
  }
  if (normalizeColor(shot.padBg) !== canvas) fail(`key pad background-color is ${shot.padBg}, expected ${canvas}`);
  if (shot.padAppearance !== 'none') fail(`key pad appearance is ${shot.padAppearance}, expected none`);
  if (normalizeColor(shot.clearBg) !== canvas) fail(`Clear background-color is ${shot.clearBg}, expected ${canvas}`);
  if (shot.clearAppearance !== 'none') fail(`Clear appearance is ${shot.clearAppearance}, expected none`);
  if (shot.radioAppearances.some((value) => value !== 'none')) {
    fail(`radio appearance is ${shot.radioAppearances.join(', ')}, expected none`);
  }
  for (const [index, value] of shot.radioAccents.entries()) {
    const color = normalizeColor(value);
    if (color !== accent && color !== 'none' && color !== 'auto') {
      fail(`radio ${index} accent-color is ${value}, expected ${accent}`);
    }
  }
  for (const [index, value] of shot.rangeAccents.entries()) {
    if (normalizeColor(value) !== accent) fail(`range ${index} accent-color is ${value}, expected ${accent}`);
  }
  for (const [index, value] of shot.checkboxAccents.entries()) {
    if (normalizeColor(value) !== accent) fail(`checkbox ${index} accent-color is ${value}, expected ${accent}`);
  }
  for (const button of shot.buttonBgs) {
    const bg = normalizeColor(button.bg);
    if (forbidden.has(bg) || !allowedBg.has(bg)) {
      fail(`button "${button.name}" background-color ${button.bg} is outside the ${theme} palette`);
    }
    if (button.appearance && button.appearance !== 'none' && button.appearance !== 'auto') {
      fail(`button "${button.name}" appearance is ${button.appearance}, expected none`);
    }
  }
}

describe('Morse Code Machine theme toggle + reload loop', () => {
  let server: { url: string; close: () => Promise<void> };
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    mkdirSync(SHOT_DIR, { recursive: true });
    server = await startDistServer();
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    page = await context.newPage();
    await page.addInitScript(() => {
      try {
        if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light');
      } catch {
        // ignore
      }
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it(
    `keeps Send/Key on the defined palettes across ${CYCLES} header-toggle and hard-reload cycles`,
    async () => {
      const url = `${server.url}${MACHINE_PAGE_PATH}`;
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('[data-morse-machine]');
      await page.waitForSelector('[data-theme-toggle]');
      await page.evaluate(() => localStorage.setItem('theme', 'light'));
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => {
        return (
          document.documentElement.getAttribute('data-theme') === 'light' &&
          document.querySelector('[data-morse-machine]')?.getAttribute('data-mm-theme') === 'light'
        );
      });

      for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
        const before = (await page.locator('html').getAttribute('data-theme')) === 'dark' ? 'dark' : 'light';
        const expected: MachineTheme = before === 'dark' ? 'light' : 'dark';
        await page.locator('[data-theme-toggle]').click();
        await page.waitForFunction((theme) => {
          const html = document.documentElement.getAttribute('data-theme');
          const mm = document.querySelector('[data-morse-machine]')?.getAttribute('data-mm-theme');
          return html === theme && mm === theme;
        }, expected);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const afterClick = await collect(page);
        await page.screenshot({
          path: path.join(SHOT_DIR, `cycle-${String(cycle).padStart(2, '0')}-after-toggle.png`),
          fullPage: false,
        });
        assertShot(afterClick, expected, `cycle ${cycle} after header toggle`);

        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-morse-machine]');
        await page.waitForFunction((theme) => {
          const html = document.documentElement.getAttribute('data-theme');
          const mm = document.querySelector('[data-morse-machine]')?.getAttribute('data-mm-theme');
          return html === theme && mm === theme;
        }, expected);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const afterReload = await collect(page);
        await page.screenshot({
          path: path.join(SHOT_DIR, `cycle-${String(cycle).padStart(2, '0')}-after-reload.png`),
          fullPage: false,
        });
        assertShot(afterReload, expected, `cycle ${cycle} after hard reload`);
      }

      expect(CYCLES).toBe(10);
    },
    180_000,
  );
});
