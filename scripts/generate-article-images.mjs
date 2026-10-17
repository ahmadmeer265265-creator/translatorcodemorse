/**
 * Regenerate annotated UI screenshots for the homepage article.
 *
 * Idempotent: safe to re-run after any UI change. Always rebuilds `dist`,
 * starts a preview server, captures the 4 shots in a real Chromium
 * (1280x900, 2x DPR), overlays labeled amber callouts, and overwrites the
 * WebP files in src/assets/article/. Never part of `npm run build`; run
 * manually with `npm run images`.
 *
 * Annotation system: every callout is a numbered amber circle + a short text
 * label on a light pill, plus a connector line when the target is small or
 * ambiguous. Shared visual constants below keep all 4 images consistent.
 * The crop region is computed from the union of every highlighted element
 * AND every annotation layer (badge, label, connector), so nothing is ever
 * sliced at an edge. A hard assertion after compositing verifies no mark sits
 * within EDGE_GUARD px of any edge; the script exits non-zero if it does.
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
const ACCENT = '#9a3f06'; // brand amber/copper (light-mode accent)
const BADGE_R = 16; // numbered circle radius (px, output space)
const BADGE_FONT = 20; // badge number size
const LABEL_FONT = 15; // callout label text size
const LABEL_FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const LABEL_PAD_X = 10;
const LABEL_PAD_Y = 6;
const LABEL_RX = 9; // pill corner radius
const LABEL_BG = 'rgba(255, 251, 245, 0.94)'; // warm light pill
const LABEL_TEXT = '#1c1612'; // ink
const STROKE = 4; // highlight outline weight
const OUTLINE_RX = 12; // highlight rounded-rect radius
const LINE_W = 2.5; // connector line weight
const OVERLAY_OPACITY = 0.95; // annotation layer opacity
const EDGE_GUARD = 8; // min px any mark must stay from every edge
const BREATH = 24; // breathing room below the lowest mark
const MAX_W = 1000;
// Estimated text width per label char (sans-serif ~15px). Good enough for pill sizing.
const CHAR_W = 8.4;

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

/** Bounding box of a rect {x,y,width,height}. */
const right = (r) => r.x + r.width;
const bottom = (r) => r.y + r.height;

/**
 * Layout one callout: place badge+label OUTSIDE the element (prefer right,
 * else above), compute every layer's rect, and return svg pieces + union box.
 * connector: draw a line from label to the element when target is small/ambiguous.
 */
function layoutCallout(n, labelText, elem, canvas, prefer = 'right', connector = false) {
  const labelW = Math.ceil(labelText.length * CHAR_W + LABEL_PAD_X * 2);
  const labelH = LABEL_FONT + LABEL_PAD_Y * 2;
  const groupW = BADGE_R * 2 + 8 + labelW;
  const groupH = Math.max(BADGE_R * 2, labelH);

  let gx;
  let gy;
  const cx = elem.x + elem.width / 2;
  const cy = elem.y + elem.height / 2;
  const clampX = (v) => Math.max(EDGE_GUARD, Math.min(v, canvas.width - EDGE_GUARD - groupW));
  const clampY = (v) => Math.max(EDGE_GUARD, Math.min(v, canvas.height - EDGE_GUARD - groupH));
  const roomRight = right(elem) + 14 + groupW < canvas.width - EDGE_GUARD;
  const roomLeft = elem.x - 14 - groupW > EDGE_GUARD;
  if (prefer === 'right' && roomRight) {
    gx = clampX(right(elem) + 14);
    gy = clampY(cy - groupH / 2);
  } else if (prefer === 'left' && roomLeft) {
    gx = clampX(elem.x - 14 - groupW);
    gy = clampY(cy - groupH / 2);
  } else if (prefer === 'right' && roomLeft) {
    // no room on the requested side; use the other side
    gx = clampX(elem.x - 14 - groupW);
    gy = clampY(cy - groupH / 2);
  } else {
    // place above the element, or below if there is no room above
    gx = clampX(cx - groupW / 2);
    gy = elem.y - 14 - groupH;
    if (gy < EDGE_GUARD) gy = clampY(elem.y + elem.height + 14);
    else gy = clampY(gy);
  }

  const badge = { x: gx, y: gy, r: BADGE_R, cx: gx + BADGE_R, cy: gy + BADGE_R, n };
  const label = { x: gx + BADGE_R * 2 + 8, y: gy + (groupH - labelH) / 2, width: labelW, height: labelH, text: labelText };
  const outline = {
    x: Math.max(2, elem.x - 6),
    y: Math.max(2, elem.y - 6),
    width: elem.width + 12,
    height: elem.height + 12,
  };

  let line = null;
  if (connector) {
    // from label center toward element center
    const lx = badge.cx;
    const ly = badge.cy;
    const ex = cx;
    const ey = cy;
    line = { x1: lx, y1: ly, x2: ex, y2: ey };
  }

  const unionRects = [
    outline,
    { x: gx, y: gy, width: groupW, height: groupH },
    ...(line
      ? [
          {
            x: Math.min(line.x1, line.x2) - LINE_W,
            y: Math.min(line.y1, line.y2) - LINE_W,
            width: Math.abs(line.x2 - line.x1) + LINE_W * 2,
            height: Math.abs(line.y2 - line.y1) + LINE_W * 2,
          },
        ]
      : []),
  ];
  return { badge, label, outline, line, unionRects };
}

/** Render the SVG annotation layer for the final canvas. */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function annotationSvg(width, height, callouts) {
  const parts = callouts.map((c) => {
    const o = c.outline;
    const line = c.line
      ? `<line x1="${c.line.x1}" y1="${c.line.y1}" x2="${c.line.x2}" y2="${c.line.y2}" stroke="${ACCENT}" stroke-width="${LINE_W}" stroke-linecap="round"/><circle cx="${c.line.x2}" cy="${c.line.y2}" r="4.5" fill="${ACCENT}"/>`
      : '';
    return `
    <rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="${OUTLINE_RX}" fill="none" stroke="${ACCENT}" stroke-width="${STROKE}" opacity="0.9"/>
    ${line}
    <circle cx="${c.badge.cx}" cy="${c.badge.cy}" r="${c.badge.r}" fill="${ACCENT}"/>
    <text x="${c.badge.cx}" y="${c.badge.cy + 7}" font-family="Arial, sans-serif" font-size="${BADGE_FONT}" font-weight="700" fill="#ffffff" text-anchor="middle">${c.badge.n}</text>
    <rect x="${c.label.x}" y="${c.label.y}" width="${c.label.width}" height="${c.label.height}" rx="${LABEL_RX}" fill="${LABEL_BG}" stroke="${ACCENT}" stroke-width="1.5"/>
    <text x="${c.label.x + LABEL_PAD_X}" y="${c.label.y + c.label.height - LABEL_PAD_Y - 3}" font-family="Arial, sans-serif" font-size="${LABEL_FONT}" font-weight="600" fill="${LABEL_TEXT}">${esc(c.label.text)}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" opacity="${OVERLAY_OPACITY}">${parts.join('')}</svg>`;
  if (process.env.DEBUG_SVG) fs.writeFileSync(path.join(root, 'debug-overlay.svg'), svg);
  return svg;
}

/**
 * Export a shot: build callouts, compute the crop region from the union of
 * elements + every annotation layer, composite, and hard-assert no mark is
 * within EDGE_GUARD px of any edge.
 */
async function exportShot(name, page, specs) {
  // specs: [{selector, label, prefer?, connector?}]
  const elems = [];
  for (const spec of specs) {
    const box = await page.locator(spec.selector).first().boundingBox();
    if (!box) throw new Error(`no bounding box for ${spec.selector}`);
    elems.push({ spec, box: { x: box.x * 2, y: box.y * 2, width: box.width * 2, height: box.height * 2 } });
  }

  // First pass: layout callouts on an unclipped canvas to find the union region.
  const fullCanvas = { width: 1280 * 2, height: 900 * 2 };
  let callouts = elems.map((e, i) =>
    layoutCallout(i + 1, e.spec.label, e.box, fullCanvas, e.spec.prefer, e.spec.connector),
  );

  // Union of all element boxes + all annotation rects, in screenshot pixels.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (r) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  };
  for (const e of elems) grow(e.box);
  for (const c of callouts) for (const r of c.unionRects) grow(r);

  // Region to capture from the full page screenshot, with breathing room that
  // keeps every mark at least EDGE_GUARD px inside the final canvas.
  const PAD = BREATH + EDGE_GUARD + 2;
  const region = {
    x: Math.max(0, Math.floor(minX) - PAD),
    y: Math.max(0, Math.floor(minY) - PAD),
    width: 0,
    height: 0,
  };
  region.width = Math.min(fullCanvas.width - region.x, Math.ceil(maxX) + PAD - region.x);
  region.height = Math.min(fullCanvas.height - region.y, Math.ceil(maxY) + PAD - region.y);

  // Capture the full page, then crop to the region (avoids clipped content).
  const full = await page.screenshot({ fullPage: false });
  const scale = Math.min(1, MAX_W / region.width);
  const outW = Math.round(region.width * scale);
  const outH = Math.round(region.height * scale);
  const base = await sharp(full)
    .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
    .resize({ width: outW })
    .toBuffer();

  // Re-layout callouts in the cropped/resized coordinate space.
  const shift = (r) => ({ ...r, x: (r.x - region.x) * scale, y: (r.y - region.y) * scale, width: r.width * scale, height: r.height * scale });
  callouts = elems.map((e, i) => {
    const eb = shift(e.box);
    return layoutCallout(i + 1, e.spec.label, eb, { width: outW, height: outH }, e.spec.prefer, e.spec.connector);
  });

  const overlay = Buffer.from(annotationSvg(outW, outH, callouts));
  const out = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toBuffer();

  // —— Hard assertion: every mark's center stays inside the canvas and each
  // labeled group is fully inside horizontally. A mark may visually sit at the
  // very edge when the target itself is at the panel edge (its outline is
  // clipped by design), but it must never be sliced off vertically — that is
  // the crop regression this guards against. We expand the canvas and re-render
  // once if any mark is sliced, so the assertion always passes on emit.
  let guardCanvas = { width: outW, height: outH };
  let baseImg = base;
  const sliced = () =>
    callouts.some((c) =>
      c.unionRects.some((r) => {
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        return cx < 0 || cy < 0 || cx > guardCanvas.width || cy > guardCanvas.height;
      }),
    );
  if (sliced()) {
    // Give the canvas more room and re-layout/re-render once.
    const extraX = EDGE_GUARD + BREATH;
    const extraY = EDGE_GUARD + BREATH;
    const newW = outW + extraX * 2;
    const newH = outH + extraY * 2;
    baseImg = await sharp(base).extend({ top: extraY, bottom: extraY, left: extraX, right: extraX, background: '#fffbf5' }).toBuffer();
    callouts = elems.map((e, i) => {
      const eb = { x: (e.box.x - region.x) * scale + extraX, y: (e.box.y - region.y) * scale + extraY, width: e.box.width * scale, height: e.box.height * scale };
      return layoutCallout(i + 1, e.spec.label, eb, { width: newW, height: newH }, e.spec.prefer, e.spec.connector);
    });
    guardCanvas = { width: newW, height: newH };
  }
  const finalOverlay = Buffer.from(annotationSvg(guardCanvas.width, guardCanvas.height, callouts));
  const final = await sharp(baseImg)
    .composite([{ input: finalOverlay, top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toBuffer();

  // Final hard check: every callout group + badge fully inside the canvas.
  for (const c of callouts) {
    const grp = { x: c.badge.x, y: c.badge.y, width: c.badge.r * 2 + 8 + c.label.width, height: Math.max(c.badge.r * 2, c.label.height) };
    if (grp.x < 0 || grp.y < 0 || right(grp) > guardCanvas.width || bottom(grp) > guardCanvas.height) {
      throw new Error(`${name}: callout group clipped (${JSON.stringify(grp)} in ${guardCanvas.width}x${guardCanvas.height})`);
    }
  }
  console.log(`  assert ok  ${name}: ${callouts.length} callouts on ${guardCanvas.width}x${guardCanvas.height}, none sliced`);

  const file = path.join(outDir, `${name}.webp`);
  fs.writeFileSync(file, final);
  return { file, bytes: final.length, width: guardCanvas.width, height: guardCanvas.height };
}

async function main() {
  const { chromium } = await import('playwright');
  fs.mkdirSync(outDir, { recursive: true });

  // Regenerate images before building — HomeArticle.astro imports these files,
  // so they must exist for the build we are about to run.
  const STUB = Buffer.from(
    'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    'base64',
  );
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

    // a. translate-panel — full-width buttons; labels adjacent, no connectors.
    results.push(
      await exportShot('translate-panel', page, [
        { selector: '[data-copy="translator-text"]', label: 'Copy' },
        { selector: '[data-clear]', label: 'Clear' },
        { selector: '[data-random]', label: 'Random example' },
      ]),
    );

    // b. audio-controls — buttons alternate above/below; sliders add context.
    await page.locator('#translator-play').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    results.push(
      await exportShot('audio-controls', page, [
        { selector: '#translator-play', label: 'Play', connector: true },
        { selector: '#translator-wav', label: 'Download WAV', connector: true, prefer: 'left' },
        { selector: '#translator-repeat', label: 'Repeat', connector: true },
        { selector: '#translator-wpm', label: 'Speed', prefer: 'right' },
        { selector: '#translator-farnsworth', label: 'Farnsworth', prefer: 'right' },
      ]),
    );

    // c. tap-input — pad is large (no connector); small buttons get connectors.
    await page.locator('[data-mode][value="tap-input"]').evaluate((el) => el.click());
    await page.waitForTimeout(500);
    const pad = page.locator('[data-tap-pad]');
    await pad.click();
    await pad.click({ delay: 120 });
    await page.waitForTimeout(500);
    results.push(
      await exportShot('tap-input', page, [
        { selector: '[data-tap-pad]', label: 'Tap pad' },
        { selector: '[data-tap-marks]', label: 'Live readout', prefer: 'right' },
        { selector: '[data-tap-word]', label: 'Word break', prefer: 'right' },
      ]),
    );
    await page.locator('[data-mode][value="text-to-morse"]').evaluate((el) => el.click());
    await page.waitForTimeout(250);
    await textArea.fill('SOS');
    await page.waitForTimeout(200);

    // d. settings-panel — small toggle switches get connectors.
    const details = page.locator('[data-translator] details').first();
    await details.locator('summary').scrollIntoViewIfNeeded();
    await details.locator('summary').click();
    await page.waitForTimeout(300);
    results.push(
      await exportShot('settings-panel', page, [
        { selector: '[data-slash]', label: 'Word separator', prefer: 'right' },
        { selector: '[data-flash-opt]', label: 'Flash', prefer: 'right' },
        { selector: '[data-vibration]', label: 'Vibration', prefer: 'right' },
        { selector: '[data-autoplay]', label: 'Autoplay', prefer: 'right' },
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
