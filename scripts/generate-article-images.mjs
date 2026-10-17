/**
 * Regenerate annotated UI screenshots for the homepage article.
 *
 * Idempotent: safe to re-run after any UI change. Rebuilds `dist`, starts a
 * preview server, captures the 4 shots in a real Chromium (1280x900, 2x DPR),
 * overlays clean numbered amber badges + rounded-rect outlines, and overwrites
 * the WebP files in src/assets/article/. Run manually with `npm run images`.
 *
 * Annotation style (deliberately simple and proven): a plain numbered circle
 * badge next to each highlighted element plus a rounded-rect outline around the
 * element. NO text-label pills, NO connector lines — the <figcaption> under
 * each image explains what each number means. The crop region is the union of
 * the container context box, every highlighted element, and every badge, plus
 * padding, so nothing is ever sliced. Hard assertions verify: nothing is
 * clipped at any edge, every image is at least MIN_WIDTH px wide (catches a
 * zoom/crop bug), and no two badges overlap or leave the canvas.
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

// —— Shared visual constants (one system across all 4 images) ——
const ACCENT = '#9a3f06'; // brand amber/copper
const BADGE_R = 16; // numbered circle radius (output px)
const BADGE_FONT = 20;
const STROKE = 4; // outline weight
const OUTLINE_RX = 12; // outline corner radius
const OVERLAY_OPACITY = 0.95;
const EDGE_GUARD = 8; // min px any mark keeps from an edge
const PAD = 26; // breathing room around the captured group
const MAX_W = 1000; // max output width
const MIN_WIDTH = 600; // sanity floor — catches a zoom/crop bug

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

/**
 * Place a numbered badge just outside an element's top-right corner, clamped
 * inside the canvas. Returns badge rect + outline rect.
 */
function placeBadge(n, elem, canvas) {
  const outline = {
    x: Math.max(2, elem.x - 6),
    y: Math.max(2, elem.y - 6),
    width: elem.width + 12,
    height: elem.height + 12,
  };
  // Center the badge on the element's top-right corner so stacked rows keep
  // their badges vertically separated (one row-height apart), never overlapping.
  let cx = elem.x + elem.width - 2;
  let cy = elem.y + 2;
  if (cx + BADGE_R > canvas.width - EDGE_GUARD) cx = canvas.width - EDGE_GUARD - BADGE_R;
  if (cx - BADGE_R < EDGE_GUARD) cx = EDGE_GUARD + BADGE_R;
  cy = Math.max(EDGE_GUARD + BADGE_R, Math.min(cy, canvas.height - EDGE_GUARD - BADGE_R));
  return { n, cx, cy, r: BADGE_R, outline };
}

/** Render the SVG annotation layer. */
function annotationSvg(width, height, badges) {
  const parts = badges.map(
    (b) => `
    <rect x="${b.outline.x}" y="${b.outline.y}" width="${b.outline.width}" height="${b.outline.height}" rx="${OUTLINE_RX}" fill="none" stroke="${ACCENT}" stroke-width="${STROKE}" opacity="0.9"/>
    <circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${ACCENT}"/>
    <text x="${b.cx}" y="${b.cy + 7}" font-family="Arial, sans-serif" font-size="${BADGE_FONT}" font-weight="700" fill="#ffffff" text-anchor="middle">${b.n}</text>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" opacity="${OVERLAY_OPACITY}">${parts.join('')}</svg>`;
}

const overlap = (a, b) =>
  !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);

/**
 * Export a shot. `context` is an element that defines the full panel to show
 * (so a screenshot always shows the whole control group, never a close-up of
 * one part). `specs` are the elements to badge.
 */
async function exportShot(name, page, contextSelector, specs, extraContext = []) {
  const contextBox = await page.locator(contextSelector).first().boundingBox();
  if (!contextBox) throw new Error(`no bounding box for context ${contextSelector}`);
  const context = { x: contextBox.x * 2, y: contextBox.y * 2, width: contextBox.width * 2, height: contextBox.height * 2 };

  const elems = [];
  for (const spec of specs) {
    const box = await page.locator(spec.selector).first().boundingBox();
    if (!box) throw new Error(`no bounding box for ${spec.selector}`);
    elems.push({ n: elems.length + 1, box: { x: box.x * 2, y: box.y * 2, width: box.width * 2, height: box.height * 2 } });
  }
  // Elements that expand the captured region for context but get no badge.
  const plain = [];
  for (const sel of extraContext) {
    const box = await page.locator(sel).first().boundingBox();
    if (box) plain.push({ x: box.x * 2, y: box.y * 2, width: box.width * 2, height: box.height * 2 });
  }

  // Union of every highlighted element + every badge. The context box is used
  // only to bound the WIDTH (so the full panel is readable), never the height —
  // a tall [data-translator] context would otherwise balloon the image into a
  // full-page capture (the settings-panel zoom/crop bug was the inverse of this).
  const fullCanvas = { width: 1280 * 2, height: 100000 }; // tall enough for fullPage captures
  let badges = elems.map((e) => placeBadge(e.n, e.box, fullCanvas));
  let minX = context.x;
  let maxX = context.x + context.width;
  let minY = Infinity;
  let maxY = -Infinity;
  const grow = (r) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  };
  for (const e of elems) grow(e.box);
  for (const p of plain) grow(p);
  for (const b of badges) grow({ x: b.cx - b.r, y: b.cy - b.r, width: b.r * 2, height: b.r * 2 });

  const region = {
    x: Math.max(0, Math.floor(minX) - PAD),
    y: Math.max(0, Math.floor(minY) - PAD),
    width: 0,
    height: 0,
  };
  region.width = Math.min(fullCanvas.width - region.x, Math.ceil(maxX) + PAD - region.x);
  region.height = Math.min(fullCanvas.height - region.y, Math.ceil(maxY) + PAD - region.y);

  // Capture the full scrollable page — content may extend past the 900px
  // viewport, and cropping needs every marked element present in the bitmap.
  const full = await page.screenshot({ fullPage: true });
  const scale = Math.min(1, MAX_W / region.width);
  const outW = Math.round(region.width * scale);
  const outH = Math.round(region.height * scale);
  const base = await sharp(full)
    .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
    .resize({ width: outW })
    .toBuffer();

  // Re-place badges in the cropped/resized space.
  badges = elems.map((e) => {
    const eb = {
      x: (e.box.x - region.x) * scale,
      y: (e.box.y - region.y) * scale,
      width: e.box.width * scale,
      height: e.box.height * scale,
    };
    return placeBadge(e.n, eb, { width: outW, height: outH });
  });

  const overlay = Buffer.from(annotationSvg(outW, outH, badges));
  const final = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toBuffer();

  // —— Hard assertions ——
  if (outW < MIN_WIDTH) {
    throw new Error(`${name}: width ${outW}px < ${MIN_WIDTH}px minimum (zoom/crop bug)`);
  }
  const rects = badges.map((b) => ({ x: b.cx - b.r, y: b.cy - b.r, width: b.r * 2, height: b.r * 2 }));
  for (const r of rects) {
    if (r.x < 0 || r.y < 0 || r.x + r.width > outW || r.y + r.height > outH) {
      throw new Error(`${name}: badge clipped (${JSON.stringify(r)} in ${outW}x${outH})`);
    }
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (overlap(rects[i], rects[j])) {
        throw new Error(
          `${name}: badges ${i + 1} and ${j + 1} overlap on ${outW}x${outH}\n` +
            badges.map((b, k) => `  b${k + 1} cx=${b.cx.toFixed(1)} cy=${b.cy.toFixed(1)}`).join('\n') +
            '\n' +
            elems.map((e, k) => `  e${k + 1} ${JSON.stringify(e.box)}`).join('\n'),
        );
      }
    }
  }
  console.log(`  assert ok  ${name}: ${badges.length} badges on ${outW}x${outH}, no clip/overlap`);

  const file = path.join(outDir, `${name}.webp`);
  fs.writeFileSync(file, final);
  return { file, bytes: final.length, width: outW, height: outH };
}

async function main() {
  const { chromium } = await import('playwright');
  fs.mkdirSync(outDir, { recursive: true });

  // Stub the images before building — HomeArticle.astro imports these files,
  // so they must exist for the build about to run.
  const STUB = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  for (const n of ['translate-panel', 'audio-controls', 'tap-input', 'settings-panel']) {
    const f = path.join(outDir, `${n}.webp`);
    if (!fs.existsSync(f)) fs.writeFileSync(f, STUB);
  }

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
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

    const textArea = page.locator('#translator-text');
    await textArea.fill('SOS');
    await page.waitForTimeout(350);

    // a. translate-panel — Morse panel shown for context above the button row.
    results.push(
      await exportShot(
        'translate-panel',
        page,
        '[data-panels]',
        [
          { selector: '[data-copy="translator-text"]' },
          { selector: '[data-clear]' },
          { selector: '[data-random]' },
        ],
        ['[data-morse-shell]'],
      ),
    );

    // b. audio-controls — badges on transport + sliders so the group is bounded.
    await page.locator('#translator-play').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    results.push(
      await exportShot('audio-controls', page, '#translator-wpm', [
        { selector: '#translator-play' },
        { selector: '#translator-wav' },
        { selector: '#translator-repeat' },
        { selector: '#translator-wpm' },
        { selector: '#translator-farnsworth' },
      ]),
    );

    // c. tap-input
    await page.locator('[data-mode][value="tap-input"]').evaluate((el) => el.click());
    await page.waitForTimeout(500);
    const pad = page.locator('[data-tap-pad]');
    await pad.click();
    await pad.click({ delay: 120 });
    await page.waitForTimeout(500);
    results.push(
      await exportShot('tap-input', page, '[data-tap-mount]', [
        { selector: '[data-tap-pad]' },
        { selector: '[data-tap-marks]' },
        { selector: '[data-tap-word]' },
      ]),
    );
    await page.locator('[data-mode][value="text-to-morse"]').evaluate((el) => el.click());
    await page.waitForTimeout(250);
    await textArea.fill('SOS');
    await page.waitForTimeout(200);

    // d. settings-panel — context is the whole open Settings disclosure so the
    // capture shows every toggle row at the same readable scale (fixes the
    // earlier close-up-of-one-toggle zoom bug).
    const details = page.locator('[data-translator] details').first();
    await details.locator('summary').scrollIntoViewIfNeeded();
    await details.locator('summary').click();
    await page.waitForTimeout(300);
    results.push(
      await exportShot('settings-panel', page, '[data-translator] details', [
        { selector: '[data-translator] details [data-slash] ~ .toggle-ui' },
        { selector: '[data-translator] details [data-hide-text] ~ .toggle-ui' },
        { selector: '[data-translator] details [data-autoplay] ~ .toggle-ui' },
        { selector: '[data-translator] details [data-flash-opt] ~ .toggle-ui' },
        { selector: '[data-translator] details [data-vibration] ~ .toggle-ui' },
      ]),
    );
  } finally {
    if (browser) await browser.close();
    kill(preview);
  }

  console.log('\nGenerated article images:');
  for (const r of results) {
    console.log(`  ${path.basename(r.file)}  ${r.bytes} bytes  ${r.width}x${r.height}`);
  }
}

await main();
