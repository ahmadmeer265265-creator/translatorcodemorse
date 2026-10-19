/**
 * Probe: does Chromium --use-file-for-fake-audio-capture feed getUserMedia?
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Prefer a no-space path — Chromium flag parsing breaks on spaces.
const candidates = [
  'D:\\mic-e2e-fixtures\\sos.wav',
  path.join(root, 'tests', 'e2e', 'fixtures', 'sos.wav'),
];
const absWav = candidates.find((p) => fs.existsSync(p));
if (!absWav) {
  console.error('Missing sos.wav fixture');
  process.exit(1);
}
console.log('WAV:', absWav, 'size', fs.statSync(absWav).size);

const html = `<!doctype html><html><body><pre id="out">starting...</pre>
<script>
(async () => {
  const out = document.getElementById('out');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const tracks = stream.getAudioTracks().map(t => ({
      label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState,
      settings: t.getSettings(),
    }));
    const ctx = new AudioContext();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const samples = [];
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 50));
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let j = 0; j < buf.length; j++) sum += buf[j] * buf[j];
      samples.push(Math.sqrt(sum / buf.length));
    }
    const peak = Math.max(...samples);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    out.textContent = JSON.stringify({
      ok: true, tracks, peak, mean,
      nonzero: samples.filter((x) => x > 0.001).length,
    }, null, 2);
  } catch (e) {
    out.textContent = JSON.stringify({
      ok: false, error: String(e), name: e && e.name, stack: e && e.stack,
    }, null, 2);
  }
})();
</script></body></html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const args = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${absWav}`,
];
console.log('args:', args);

const browser = await chromium.launch({ headless: true, args });
const context = await browser.newContext();
await context.grantPermissions(['microphone'], { origin: url });
const page = await context.newPage();
page.on('console', (m) => console.log('PAGE', m.type(), m.text()));
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(url);
await page.waitForFunction(
  () => (document.getElementById('out')?.textContent || '').includes('"ok"'),
  null,
  { timeout: 20000 },
);
const result = await page.locator('#out').textContent();
console.log('RESULT:\n', result);
await browser.close();
server.close();

const parsed = JSON.parse(result || '{}');
if (!parsed.ok) {
  console.error('PROBE FAILED: getUserMedia error');
  process.exit(2);
}
if (!(parsed.peak > 0.001)) {
  console.error('PROBE FAILED: peak RMS too low — fake WAV may not be feeding the mic');
  process.exit(3);
}
console.log('PROBE OK: peak=', parsed.peak);
process.exit(0);
