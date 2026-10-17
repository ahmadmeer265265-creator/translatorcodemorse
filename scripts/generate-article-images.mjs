/**
 * Regenerate annotated UI screenshots for the homepage article.
 *
 * Idempotent: safe to re-run after any UI change. Always rebuilds `dist`,
 * starts a preview server, captures the 4 shots in a real Chromium
 * (1280x900, 2x DPR), overlays numbered amber callouts, and overwrites the
 * WebP files in src/assets/article/. Never part of `npm run build`; run
 * manually with `npm run images`.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

process.env.ASTRO_TELEMETRY_DISABLED = '1';
// System C: is nearly full on this machine; keep Playwright browsers on D:.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src', 'assets', 'article');
const port = 4321;
const astroBin = path.join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
const ACCENT = '#9a3f06';
const MAX_W = 1000;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

function kill(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

async function waitForPreview() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) return;
    } catch {
      // starting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview did not start');
}

/** Build an SVG annotation layer sized to the *resized* WebP canvas. */
function annotationSvg(width, height, marks) {
  const badgeR = 17;
  const parts = marks.map((m, i) => {
    const n = i + 1;
    const pad = 9;
    const x = Math.max(4, m.x - pad);
    const y = Math.max(4, m.y - pad);
    const w = m.width + pad * 2;
    const h = m.height + pad * 2;
    const cx = Math.min(width - badgeR - 4, x + w + badgeR - 6);
    const cy = Math.max(badgeR + 4, y - badgeR + 6);
    return `
    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="12"
      fill="none" stroke="${ACCENT}" stroke-width="4.5"/>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${badgeR}" fill="${ACCENT}"/>
    <text x="${cx.toFixed(1)}" y="${(cy + 6).toFixed(1)}" font-family="ui-sans-serif,system-ui,Arial" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle">${n}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" opacity="0.82">${parts.join('')}</svg>`;
}

async function exportShot(name, buffer, marks) {
  // Resize to max width (keeps sharp 2x detail), then scale marks to that canvas.
  const image = sharp(buffer);
  const meta = await image.metadata();
  const scale = Math.min(1, MAX_W / meta.width);
  const width = Math.round(meta.width * scale);
  const resized = await image.resize({ width }).toBuffer();
  const meta2 = await sharp(resized).metadata();
  const scaledMarks = marks.map((m) => ({
    x: m.x * scale,
    y: m.y * scale,
    width: m.width * scale,
    height: m.height * scale,
  }));
  const overlay = Buffer.from(annotationSvg(meta2.width, meta2.height, scaledMarks));
  const out = await sharp(resized)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toBuffer();
  const file = path.join(outDir, `${name}.webp`);
  fs.writeFileSync(file, out);
  return { file, bytes: out.length, width: meta2.width, height: meta2.height };
}

/** Convert a locator boundingBox (CSS px) to screenshot pixels at 2x, relative to clip. */
function boxToMark(box, clip) {
  return {
    x: box.x * 2 - clip.x,
    y: box.y * 2 - clip.y,
    width: box.width * 2,
    height: box.height * 2,
  };
}

async function main() {
  const { chromium } = await import('playwright');
  fs.mkdirSync(outDir, { recursive: true });

  await run(process.execPath, [astroBin, 'build']);
  await run(process.execPath, [path.join(root, 'scripts', 'verify-dist.mjs')]);

  const preview = spawn(process.execPath, [astroBin, 'preview', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let browser;
  const results = [];
  try {
    await waitForPreview();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    // Force light theme for consistent screenshots.
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });

    const textArea = page.locator('#translator-text');
    await textArea.fill('SOS');
    await page.waitForTimeout(350);

    const clipFor = async (locator, expandX = 8, expandY = 8) => {
      const box = await locator.boundingBox();
      const cw = 1280;
      const ch = 900;
      return {
        x: Math.max(0, Math.floor(box.x - expandX)),
        y: Math.max(0, Math.floor(box.y - expandY)),
        width: Math.min(cw, Math.ceil(box.width + expandX * 2)),
        height: Math.min(ch, Math.ceil(box.height + expandY * 2)),
      };
    };

    // a. translate-panel
    {
      const clip = await clipFor(page.locator('[data-panels]'), 10, 12);
      const shot = await page.screenshot({ clip });
      const marks = [];
      const copyBtn = page.locator('[data-copy="translator-text"]');
      const clearBtn = page.locator('[data-clear]');
      const randomBtn = page.locator('[data-random]');
      for (const loc of [copyBtn, clearBtn, randomBtn]) {
        const b = await loc.boundingBox();
        if (b) marks.push(boxToMark(b, { x: clip.x * 2, y: clip.y * 2 }));
      }
      results.push(await exportShot('translate-panel', shot, marks));
    }

    // b. audio-controls
    {
      // Scroll audio area into view.
      await page.locator('#translator-play').scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const clip = await clipFor(page.locator('#translator-wpm'), 10, 10);
      // Include the transport row above the sliders: widen upward.
      const playBox = await page.locator('#translator-play').boundingBox();
      clip.y = Math.max(0, Math.floor(playBox.y - 14));
      clip.height = Math.min(900 - clip.y, Math.ceil((await page.locator('#translator-farnsworth').boundingBox()).y + 44 - clip.y));
      const shot = await page.screenshot({ clip });
      const marks = [];
      for (const sel of ['#translator-play', '#translator-wav', '#translator-repeat']) {
        const b = await page.locator(sel).boundingBox();
        if (b) marks.push(boxToMark(b, { x: clip.x * 2, y: clip.y * 2 }));
      }
      results.push(await exportShot('audio-controls', shot, marks));
    }

    // c. tap-input
    {
      await page.locator('[data-mode][value="tap-input"]').evaluate((el) => el.click());
      await page.waitForTimeout(500);
      // Tap a short pattern on the pad so the readout is populated.
      const pad = page.locator('[data-tap-pad]');
      await pad.click();
      await pad.click({ delay: 120 });
      await page.waitForTimeout(500);
      const clip = await clipFor(page.locator('[data-tap-mount]'), 12, 14);
      const shot = await page.screenshot({ clip });
      const marks = [];
      for (const sel of ['[data-tap-pad]', '[data-tap-marks]', '[data-tap-word]']) {
        const b = await page.locator(sel).boundingBox();
        if (b) marks.push(boxToMark(b, { x: clip.x * 2, y: clip.y * 2 }));
      }
      results.push(await exportShot('tap-input', shot, marks));
      // Back to text-to-morse for the settings shot.
      await page.locator('[data-mode][value="text-to-morse"]').evaluate((el) => el.click());
      await page.waitForTimeout(250);
      await textArea.fill('SOS');
      await page.waitForTimeout(200);
    }

    // d. settings-panel
    {
      const details = page.locator('[data-translator] details').first();
      const summary = details.locator('summary');
      await summary.scrollIntoViewIfNeeded();
      await summary.click();
      await page.waitForTimeout(300);
      const clip = await clipFor(details, 10, 12);
      const shot = await page.screenshot({ clip });
      const marks = [];
      for (const sel of ['[data-flash-opt]', '[data-vibration]', '[data-autoplay]', '[data-slash]']) {
        const b = await page.locator(sel).boundingBox();
        if (b) marks.push(boxToMark(b, { x: clip.x * 2, y: clip.y * 2 }));
      }
      results.push(await exportShot('settings-panel', shot, marks));
    }
  } finally {
    if (browser) await browser.close();
    kill(preview);
  }

  console.log('\nGenerated article images:');
  for (const r of results) {
    console.log(
      `  ${path.basename(r.file)}  ${r.bytes} bytes  ${r.width}x${r.height}`,
    );
  }
}

await main();
