/**
 * Fake-mic end-to-end: Chromium feeds a real Morse WAV into getUserMedia via
 * --use-file-for-fake-audio-capture, then the UI Listen (mic) mode must decode
 * it through AnalyserNode → envelope → adaptive classifier → panels.
 *
 * Fixtures: scripts/generate-mic-e2e-fixtures.mjs (site encodeWav / buildTimeline).
 * Runner:  npm run test:mic-e2e  →  scripts/run-mic-e2e.mjs
 *
 * Uses the installed `playwright` package (chromium API) rather than
 * @playwright/test so no extra lockfile dependency is required.
 *
 * Note: Chromium loops the fake-capture file from browser launch. Fixtures
 * include ~8s leading silence so Start listening can happen before Morse.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturesDir = path.join(root, 'tests', 'e2e', 'fixtures');
/** Chromium flag parsing breaks on paths with spaces — use the D: copy. */
const runtimeDir = 'D:\\mic-e2e-fixtures';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

export const fixtures = [
  // waitMs covers remaining lead (~8s worst case) + Morse + trail flush
  // waitMs must cover up to one full loop (lead+morse+trail) plus a retry.
  { name: 'SOS (steady 20 WPM)', wav: 'sos.wav', expected: 'SOS', waitMs: 28000 },
  { name: 'PARIS (steady 20 WPM)', wav: 'paris.wav', expected: 'PARIS', waitMs: 30000 },
  { name: 'HELLO (uneven ±18%)', wav: 'hello-uneven.wav', expected: 'HELLO', waitMs: 32000 },
];

function ensureRuntimeCopy(wavName) {
  const src = path.join(fixturesDir, wavName);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing fixture ${src}. Run: node scripts/generate-mic-e2e-fixtures.mjs`);
  }
  fs.mkdirSync(runtimeDir, { recursive: true });
  const dest = path.join(runtimeDir, wavName);
  fs.copyFileSync(src, dest);
  return dest;
}

async function openWithFakeMic(wavAbs, baseURL) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${wavAbs}`,
    ],
  });
  const context = await browser.newContext();
  await context.grantPermissions(['microphone'], { origin: baseURL });
  const page = await context.newPage();
  return { browser, page };
}

async function driveListenMode(page, baseURL, expected, waitMs) {
  // Race the 8s lead silence — open UI and start listening ASAP.
  await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[data-mode][value="mic-listen"]').evaluate((el) => {
    el.click();
  });
  await page.waitForSelector('[data-mic-shell]', { state: 'visible', timeout: 15000 });
  await page.locator('[data-mic-sens]').fill('70');
  await page.locator('[data-mic-toggle]').click();
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-mic-toggle]');
      return btn && /Stop listening/i.test(btn.textContent || '');
    },
    { timeout: 8000 },
  );

  const errEarly = await page.locator('[data-mic-error]').textContent();
  if (errEarly && errEarly.trim()) {
    throw new Error(`Mic UI error after Start: ${errEarly.trim()}`);
  }

  // Chromium may start the looping WAV mid-file. Whenever the Text panel is
  // non-empty but not an exact match, wait for sustained quiet (lead/trail
  // silence on the level meter) then Clear so the next Morse pass can write
  // a clean exact match.
  const deadline = Date.now() + waitMs;
  let lastClear = 0;
  let quietSince = 0;
  let last = '';

  while (Date.now() < deadline) {
    last = (await page.locator('#translator-text').inputValue()).trim();
    if (last === expected) break;

    const level = Number(
      (await page.locator('[data-mic-meter]').getAttribute('aria-valuenow')) || '0',
    );
    const now = Date.now();
    if (level <= 2) {
      if (!quietSince) quietSince = now;
    } else {
      quietSince = 0;
    }

    const quietLongEnough = quietSince && now - quietSince >= 700;
    if (last.length > 0 && quietLongEnough && now - lastClear > 1200) {
      await page.locator('[data-clear]').click();
      lastClear = now;
      quietSince = 0;
      await page.waitForTimeout(80);
    }

    await page.waitForTimeout(80);
  }

  // Stop immediately so a Chromium loop cannot append another copy.
  const listening = await page.locator('[data-mic-toggle]').textContent();
  if (/Stop listening/i.test(listening || '')) {
    await page.locator('[data-mic-toggle]').click();
    await page.waitForTimeout(250);
  }
  last = (await page.locator('#translator-text').inputValue()).trim().replace(/\s+$/, '');
  const morse = (await page.locator('#translator-morse').inputValue()).trim();
  return { text: last, morse };
}

/** Run all fixtures against a live baseURL. Returns { ok, results }. */
export async function runMicDecoderE2E(baseURL = 'http://127.0.0.1:4173') {
  const results = [];
  let ok = true;
  for (const fixture of fixtures) {
    const wavAbs = ensureRuntimeCopy(fixture.wav);
    const { browser, page } = await openWithFakeMic(wavAbs, baseURL);
    let actual = '';
    let morse = '';
    let error = null;
    try {
      const got = await driveListenMode(page, baseURL, fixture.expected, fixture.waitMs);
      actual = got.text;
      morse = got.morse;
      const pass = actual === fixture.expected;
      if (!pass) ok = false;
      results.push({
        name: fixture.name,
        expected: fixture.expected,
        actual,
        morse,
        pass,
      });
      console.log(
        `[${pass ? 'PASS' : 'FAIL'}] ${fixture.name}: expected=${JSON.stringify(fixture.expected)} actual=${JSON.stringify(actual)} morse=${JSON.stringify(morse)}`,
      );
    } catch (err) {
      ok = false;
      error = err instanceof Error ? err.message : String(err);
      results.push({
        name: fixture.name,
        expected: fixture.expected,
        actual: actual || '',
        morse,
        pass: false,
        error,
      });
      console.log(`[FAIL] ${fixture.name}: ${error}`);
    } finally {
      await browser.close();
    }
  }
  return { ok, results };
}
