/**
 * Regenerate annotated UI screenshots for the homepage article.
 *
 * Idempotent: safe to re-run after any UI change. Rebuilds `dist`, starts a
 * preview server, captures the 4 shots in a real Chromium (1400x900, 2x DPR),
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
const BADGE_R = 22; // numbered circle radius (output px) — sized for ~1500px-wide crops
const BADGE_FONT = 26;
const STROKE = 5; // outline weight
const OUTLINE_RX = 12; // outline corner radius
const OVERLAY_OPACITY = 0.95;
const EDGE_GUARD = 10; // min px any mark keeps from an edge
const PAD = 36; // breathing room around the captured group
const MAX_W = 1500; // max output width (crisp at article display ~672 CSS px)
const MIN_WIDTH = 900; // sanity floor — catches a zoom/crop bug
const VIEWPORT = { width: 1400, height: 900 };
const DPR = 2;
const MIN_ELEM = 16; // min CSS-px box on any annotated element (empty-region guard)

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
  const context = {
    x: contextBox.x * DPR,
    y: contextBox.y * DPR,
    width: contextBox.width * DPR,
    height: contextBox.height * DPR,
  };

  const elems = [];
  for (const spec of specs) {
    const loc = page.locator(spec.selector).first();
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    const box = await loc.boundingBox();
    if (!box) throw new Error(`no bounding box for ${spec.selector}`);
    if (box.width < MIN_ELEM || box.height < MIN_ELEM) {
      throw new Error(
        `empty/tiny region for ${spec.selector}: ${Math.round(box.width)}x${Math.round(box.height)} (need ≥${MIN_ELEM}px)`,
      );
    }
    elems.push({
      n: elems.length + 1,
      box: { x: box.x * DPR, y: box.y * DPR, width: box.width * DPR, height: box.height * DPR },
    });
  }
  // Elements that expand the captured region for context but get no badge.
  const plain = [];
  for (const sel of extraContext) {
    const loc = page.locator(sel).first();
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    const box = await loc.boundingBox();
    if (!box) throw new Error(`no bounding box for extra context ${sel}`);
    plain.push({ x: box.x * DPR, y: box.y * DPR, width: box.width * DPR, height: box.height * DPR });
  }

  // Union of every highlighted element + every badge. The context box is used
  // only to bound the WIDTH (so the full panel is readable), never the height —
  // a tall [data-translator] context would otherwise balloon the image into a
  // full-page capture (the settings-panel zoom/crop bug was the inverse of this).
  const fullCanvas = { width: VIEWPORT.width * DPR, height: 100000 }; // tall enough for fullPage captures
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
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DPR });
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
        ['[data-panels]'],
      ),
    );

    // b. audio-controls — the playback dock (Play / Pause / Stop / Repeat / WAV / Flash).
    // Speed sliders live in a separate Audio section much further down; including them
    // would crop the entire translator. Caption talks about Play / Repeat / WAV.
    await page.locator('[data-playbar]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    results.push(
      await exportShot(
        'audio-controls',
        page,
        '[data-playbar]',
        [
          { selector: '#translator-play' },
          { selector: '#translator-repeat' },
          { selector: '#translator-wav' },
        ],
        ['[data-playbar]'],
      ),
    );

    // c. tap-input — capture before the 800ms letter-gap so live marks still show.
    await page.locator('[data-mode][value="tap-input"]').evaluate((el) => el.click());
    await page.waitForTimeout(500);
    const pad = page.locator('[data-tap-pad]');
    await pad.waitFor({ state: 'visible', timeout: 8000 });
    await pad.click();
    await pad.click({ delay: 180 });
    await page.waitForTimeout(120);
    results.push(
      await exportShot('tap-input', page, '[data-tap-shell]', [
        { selector: '[data-tap-pad]' },
        { selector: '[data-tap-marks]' },
        { selector: '[data-tap-word]' },
      ]),
    );
    await page.locator('[data-mode][value="text-to-morse"]').evaluate((el) => el.click());
    await page.waitForTimeout(250);
    await textArea.fill('SOS');
    await page.waitForTimeout(200);

    // d. settings-panel — Flash is a dock bolt now, not a Settings checkbox.
    // Badge the four remaining toggles; open disclosure is the width context.
    const details = page.locator('[data-translator] details').first();
    await details.locator('summary').scrollIntoViewIfNeeded();
    await details.locator('summary').click();
    await page.waitForTimeout(300);
    results.push(
      await exportShot(
        'settings-panel',
        page,
        '[data-translator] details',
        [
          { selector: '[data-translator] details [data-slash] ~ .toggle-ui' },
          { selector: '[data-translator] details [data-hide-text] ~ .toggle-ui' },
          { selector: '[data-translator] details [data-autoplay] ~ .toggle-ui' },
          { selector: '[data-translator] details [data-vibration] ~ .toggle-ui' },
        ],
        ['[data-translator] details > summary'],
      ),
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
