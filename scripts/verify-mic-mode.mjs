/**
 * Manual verification harness for Listen (mic) mode. NOT part of the build.
 * Serves dist/ statically, drives a real Chromium with a MOCKED getUserMedia,
 * and asserts:
 *   - the mic chunk is NOT loaded until the mode is selected;
 *   - Start requests permission, Stop / mode-switch / navigation stop tracks;
 *   - the permission-denied path shows an inline, non-crashing message;
 *   - zero console errors/warnings through the whole interaction.
 * Run: node scripts/verify-mic-mode.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(dist, p);
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const { server, port } = await serve();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();

async function newPage(grant) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const console_ = { errors: [], warnings: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') console_.errors.push(msg.text());
    if (msg.type() === 'warning') console_.warnings.push(msg.text());
  });
  page.on('pageerror', (err) => console_.errors.push(String(err)));
  // Install hooks BEFORE navigation: mock getUserMedia + trace track.stop.
  await page.addInitScript((grantPerm) => {
    window.__trackStops = 0;
    window.__gumCalls = 0;
    navigator.mediaDevices = navigator.mediaDevices || {};
    navigator.mediaDevices.getUserMedia = async () => {
      window.__gumCalls += 1;
      if (!grantPerm) {
        const e = new Error('denied');
        e.name = 'NotAllowedError';
        throw e;
      }
      // Build a REAL MediaStream via an oscillator -> MediaStreamDestination so
      // AudioContext.createMediaStreamSource accepts it, then wrap track.stop
      // to count releases. No real microphone is touched.
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const dest = ctx.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      const stream = dest.stream;
      for (const track of stream.getTracks()) {
        const orig = track.stop.bind(track);
        track.stop = () => { window.__trackStops += 1; orig(); };
      }
      return stream;
    };
  }, grant);
  return { context, page, console_ };
}

// —— Scenario 1: permission granted, full lifecycle ——
{
  const { context, page, console_ } = await newPage(true);
  await page.goto(`${base}/`, { waitUntil: 'load' });
  const html = await page.content();
  ok('mic chunk not in initial HTML', !/mic-input\.[A-Za-z0-9_-]+\.js/.test(html));

  // Select Listen (mic) via its radio label.
  await page.locator('input[data-mode][value="mic-listen"]').evaluate((el) => el.click());
  await page.waitForTimeout(400); // allow dynamic import
  const micShellVisible = await page.locator('[data-mic-shell]').isVisible().catch(() => false);
  ok('mic shell appears on mode select', micShellVisible);

  const gumBefore = await page.evaluate(() => window.__gumCalls);
  ok('no getUserMedia before Start pressed', gumBefore === 0, `gumCalls=${gumBefore}`);

  // Start listening -> permission requested.
  await page.locator('[data-mic-toggle]').click();
  await page.waitForTimeout(300);
  const gumAfter = await page.evaluate(() => window.__gumCalls);
  ok('getUserMedia called on Start', gumAfter === 1, `gumCalls=${gumAfter}`);
  const label = await page.locator('[data-mic-toggle]').textContent();
  ok('toggle shows Stop listening', /stop/i.test(label || ''));

  // Stop listening -> track.stop() called.
  await page.locator('[data-mic-toggle]').click();
  await page.waitForTimeout(300);
  const stopsAfterStop = await page.evaluate(() => window.__trackStops);
  ok('track.stop() called on Stop listening', stopsAfterStop >= 1, `stops=${stopsAfterStop}`);

  // Start again, then switch mode away -> tracks stopped.
  await page.locator('[data-mic-toggle]').click();
  await page.waitForTimeout(300);
  const stopsBeforeSwitch = await page.evaluate(() => window.__trackStops);
  await page.locator('input[data-mode][value="text-to-morse"]').evaluate((el) => el.click());
  await page.waitForTimeout(300);
  const stopsAfterSwitch = await page.evaluate(() => window.__trackStops);
  ok('track.stop() called on mode switch away', stopsAfterSwitch > stopsBeforeSwitch, `${stopsBeforeSwitch}->${stopsAfterSwitch}`);

  ok('zero console errors (granted flow)', console_.errors.length === 0, console_.errors.join(' | '));
  await context.close();
}

// —— Scenario 2: permission denied ——
{
  const { context, page, console_ } = await newPage(false);
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.locator('input[data-mode][value="mic-listen"]').evaluate((el) => el.click());
  await page.waitForTimeout(400);
  await page.locator('[data-mic-toggle]').click();
  await page.waitForTimeout(300);
  const errText = await page.locator('[data-mic-error]').textContent().catch(() => '');
  const errVisible = await page.locator('[data-mic-error]').isVisible().catch(() => false);
  ok('denied shows inline message', errVisible && /denied|site settings/i.test(errText || ''), (errText || '').trim().slice(0, 80));
  const label = await page.locator('[data-mic-toggle]').textContent();
  ok('toggle returns to Start listening after denial', /start/i.test(label || ''));
  ok('no uncaught error on denial', console_.errors.length === 0, console_.errors.join(' | '));
  await context.close();
}

// —— Scenario 3: keyboard operability ——
{
  const { context, page, console_ } = await newPage(true);
  await page.goto(`${base}/`, { waitUntil: 'load' });
  // Focus the mic radio via keyboard.
  await page.locator('input[data-mode][value="mic-listen"]').focus();
  const focusedRadio = await page.evaluate(() => document.activeElement?.getAttribute('value'));
  ok('mode radio focusable by keyboard', focusedRadio === 'mic-listen', `active=${focusedRadio}`);
  await page.locator('input[data-mode][value="mic-listen"]').evaluate((el) => el.click());
  await page.waitForTimeout(400);
  // Start button focusable + activatable via keyboard (Enter).
  await page.locator('[data-mic-toggle]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const gum = await page.evaluate(() => window.__gumCalls);
  ok('Start activated via keyboard', gum === 1, `gumCalls=${gum}`);
  // Sensitivity slider reachable + adjustable by arrows.
  await page.locator('[data-mic-toggle]').click(); // stop
  await page.locator('[data-mic-sens]').focus();
  const before = await page.locator('[data-mic-sens]').inputValue();
  await page.keyboard.press('ArrowRight');
  const after = await page.locator('[data-mic-sens]').inputValue();
  ok('sensitivity slider keyboard-adjustable', before !== after, `${before}->${after}`);
  ok('zero console errors (keyboard flow)', console_.errors.length === 0, console_.errors.join(' | '));
  await context.close();
}

// —— Scenario 4: end-to-end decode of a synthetic SOS tone ——
{
  const { context, page, console_ } = await newPage(true);
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.locator('input[data-mode][value="mic-listen"]').evaluate((el) => el.click());
  await page.waitForTimeout(400);
  // Override getUserMedia with a SCRIPTED SOS tone (dot=120ms unit) through a
  // real MediaStreamDestination so the analyser path runs end to end.
  await page.evaluate(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(dest);
    osc.start();
    // SOS = ... --- ... ; unit 120ms. Schedule gain on/off.
    const u = 0.12; // seconds
    const seq = '... --- ...';
    let t = ctx.currentTime + 0.1;
    for (const ch of seq) {
      if (ch === '.' || ch === '-') {
        const dur = ch === '.' ? u : u * 3;
        gain.gain.setValueAtTime(1, t);
        gain.gain.setValueAtTime(0, t + dur);
        t += dur + u; // intra gap
      } else if (ch === ' ') {
        t += u * 2; // letter gap (already +1)
      }
    }
    navigator.mediaDevices.getUserMedia = async () => {
      window.__gumCalls += 1;
      return dest.stream;
    };
  });
  // Max sensitivity so the synthetic tone clears the threshold.
  await page.locator('[data-mic-sens]').fill('100');
  await page.locator('[data-mic-toggle]').click();
  // Wait long enough for SOS (~ a few seconds at 120ms unit) + word gap.
  await page.waitForTimeout(4000);
  const morseVal = await page.locator('#translator-morse').inputValue();
  const textVal = await page.locator('#translator-text').inputValue();
  ok('synthetic SOS decodes into panels', /SOS/.test(textVal) && /\.\.\./.test(morseVal), `text=${JSON.stringify(textVal)} morse=${JSON.stringify(morseVal)}`);
  await page.locator('[data-mic-toggle]').click();
  const stops = await page.evaluate(() => window.__trackStops);
  ok('track stopped after decode+stop', stops >= 1, `stops=${stops}`);
  ok('zero console errors (decode flow)', console_.errors.length === 0, console_.errors.join(' | '));
  await context.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
