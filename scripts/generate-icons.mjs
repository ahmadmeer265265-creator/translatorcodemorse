/**
 * One-shot asset generator. Run with: node scripts/generate-icons.mjs
 * Writes small-size favicons into public/ and header-ring PNGs into src/assets/brand/.
 * Do not run at deploy time; commit the outputs.
 *
 * Favicon 16/32 (+ ico 16/32/48): Version B — transparent, optically-bold strokes,
 * soft contrast glow. apple-touch-icon.png and og-default.jpg are NOT rewritten.
 *
 * Header chip art (64×64): optically-bold strokes, no glow. The CSS chip in
 * Header.astro stays; these PNGs are the mark that sits inside it.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const brandDir = path.join(root, 'src', 'assets', 'brand');
const lightMark = path.join(brandDir, 'profile-picture-light.png');
const darkMark = path.join(brandDir, 'profile-picture.png');

for (const file of [lightMark, darkMark]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing brand source: ${path.relative(root, file)}`);
  }
}

const W = 512;
const BOLD = 3;
const HALO = 9;

const variants = {
  light: {
    file: lightMark,
    ink: [29, 24, 18],
    amber: [201, 122, 0],
    halo: [255, 255, 255],
  },
  dark: {
    file: darkMark,
    ink: [239, 230, 212],
    amber: [242, 169, 59],
    halo: [20, 17, 13],
  },
};

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Build a multi-size .ico from PNG buffers (PNG-compressed ICO entries, with alpha). */
function encodeIco(images) {
  const count = images.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const dir = Buffer.alloc(headerSize);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2); // ICON
  dir.writeUInt16LE(count, 4);
  const chunks = [dir];
  for (let i = 0; i < count; i += 1) {
    const { size, png } = images[i];
    const entry = 6 + i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, entry);
    dir.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    dir.writeUInt8(0, entry + 2);
    dir.writeUInt8(0, entry + 3);
    dir.writeUInt16LE(1, entry + 4);
    dir.writeUInt16LE(32, entry + 6);
    dir.writeUInt32LE(png.length, entry + 8);
    dir.writeUInt32LE(offset, entry + 12);
    chunks.push(png);
    offset += png.length;
  }
  return Buffer.concat(chunks);
}

async function loadSquare(file) {
  const meta = await sharp(file).metadata();
  if (meta.width !== meta.height) throw new Error(`${file} must be square`);
  const crop = Math.round(meta.width * 0.05);
  return sharp(file)
    .extract({ left: crop, top: crop, width: meta.width - crop * 2, height: meta.height - crop * 2 })
    .resize(W, W, { kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer();
}

const blurRgb = (buf, sigma) =>
  sharp(buf, { raw: { width: W, height: W, channels: 3 } }).blur(sigma).raw().toBuffer();

function dist(a, i, b, j) {
  return Math.hypot(a[i] - b[j], a[i + 1] - b[j + 1], a[i + 2] - b[j + 2]);
}

async function estimateBackground(src) {
  let bg = await blurRgb(src, 24);
  for (let pass = 0; pass < 3; pass++) {
    const filled = Buffer.from(src);
    for (let p = 0; p < W * W; p++) {
      const i = p * 3;
      if (dist(src, i, bg, i) > 8) {
        filled[i] = bg[i];
        filled[i + 1] = bg[i + 1];
        filled[i + 2] = bg[i + 2];
      }
    }
    bg = await blurRgb(filled, 24);
  }
  return bg;
}

function unmixAlpha(src, i, bg, colour) {
  const dx = colour[0] - bg[i];
  const dy = colour[1] - bg[i + 1];
  const dz = colour[2] - bg[i + 2];
  const len2 = dx * dx + dy * dy + dz * dz || 1;
  const t =
    ((src[i] - bg[i]) * dx + (src[i + 1] - bg[i + 1]) * dy + (src[i + 2] - bg[i + 2]) * dz) / len2;
  return Math.min(1, Math.max(0, t));
}

function separate(src, bg, v) {
  const alpha = new Float32Array(W * W);
  const amber = new Uint8Array(W * W);
  for (let p = 0; p < W * W; p++) {
    const i = p * 3;
    const aInk = unmixAlpha(src, i, bg, v.ink);
    const aAmb = unmixAlpha(src, i, bg, v.amber);
    const sat = Math.max(src[i], src[i + 1], src[i + 2]) - Math.min(src[i], src[i + 1], src[i + 2]);
    const bgSat = Math.max(bg[i], bg[i + 1], bg[i + 2]) - Math.min(bg[i], bg[i + 1], bg[i + 2]);
    const isAmber = sat - bgSat > 40 && aAmb > 0.08;
    amber[p] = isAmber ? 1 : 0;
    alpha[p] = isAmber ? aAmb : aInk;
    if (alpha[p] < 0.02) alpha[p] = 0;
  }
  return { alpha, amber };
}

function diskOffsets(r) {
  const out = [];
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      if (x * x + y * y <= r * r + 0.25) out.push([x, y]);
    }
  }
  return out;
}

const CENTRE = { x0: 120, x1: 392, y0: 222, y1: 292 };
const inCentre = (x, y) => x >= CENTRE.x0 && x <= CENTRE.x1 && y >= CENTRE.y0 && y <= CENTRE.y1;

function dilate(alpha, cls, r) {
  if (r <= 0) return { alpha: alpha.slice(), cls: cls.slice() };
  const disk = diskOffsets(r);
  const column = [];
  for (let oy = -Math.ceil(r); oy <= Math.ceil(r); oy++) column.push([0, oy]);
  const outA = new Float32Array(W * W);
  const outC = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let best = 0;
      let bestC = 0;
      const offs = inCentre(x, y) ? column : disk;
      for (const [ox, oy] of offs) {
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
        const q = yy * W + xx;
        if (alpha[q] > best) {
          best = alpha[q];
          bestC = cls[q];
        }
      }
      outA[y * W + x] = best;
      outC[y * W + x] = bestC;
    }
  }
  return { alpha: outA, cls: outC };
}

function toRgba({ alpha, cls }, v, haloAlpha) {
  const buf = Buffer.alloc(W * W * 4);
  for (let p = 0; p < W * W; p++) {
    const c = cls[p] ? v.amber : v.ink;
    const a = alpha[p];
    let r = c[0];
    let g = c[1];
    let b = c[2];
    let outA = a;
    if (haloAlpha) {
      const h = haloAlpha[p];
      outA = a + h * (1 - a);
      if (outA > 0) {
        r = (c[0] * a + v.halo[0] * h * (1 - a)) / outA;
        g = (c[1] * a + v.halo[1] * h * (1 - a)) / outA;
        b = (c[2] * a + v.halo[2] * h * (1 - a)) / outA;
      }
    }
    buf[p * 4] = Math.round(r);
    buf[p * 4 + 1] = Math.round(g);
    buf[p * 4 + 2] = Math.round(b);
    buf[p * 4 + 3] = Math.round(outA * 255);
  }
  return buf;
}

const rgbaToPng = (buf, size) =>
  sharp(buf, { raw: { width: W, height: W, channels: 4 } })
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

async function opticalSet(v) {
  const src = await loadSquare(v.file);
  const bg = await estimateBackground(src);
  const base = separate(src, bg, v);
  const core = base.alpha.map((a) => (a >= 0.3 ? a : 0));
  const grown = dilate(core, base.amber, BOLD);
  const bold = {
    alpha: grown.alpha.map((a, p) => Math.max(a, base.alpha[p])),
    cls: grown.cls.map((c, p) => (grown.alpha[p] >= base.alpha[p] ? c : base.amber[p])),
  };
  const haloSrc = Buffer.from(dilate(core, base.amber, BOLD + 2).alpha.map((a) => Math.round(a * 255)));
  const haloBlur = await sharp(haloSrc, { raw: { width: W, height: W, channels: 1 } })
    .blur(HALO / 2)
    .extractChannel(0)
    .raw()
    .toBuffer();
  if (haloBlur.length !== W * W) throw new Error(`halo buffer ${haloBlur.length} != ${W * W}`);
  const haloA = Float32Array.from(haloBlur, (b) => Math.min(1, (b / 255) * 1.6) * 0.85);
  return {
    bold: toRgba(bold, v),
    halo: toRgba(bold, v, haloA),
  };
}

const light = await opticalSet(variants.light);
const dark = await opticalSet(variants.dark);

const light16 = await rgbaToPng(light.halo, 16);
const light32 = await rgbaToPng(light.halo, 32);
const light48 = await rgbaToPng(light.halo, 48);
const dark16 = await rgbaToPng(dark.halo, 16);
const dark32 = await rgbaToPng(dark.halo, 32);
const headerLight = await rgbaToPng(light.bold, 64);
const headerDark = await rgbaToPng(dark.bold, 64);

const writes = [
  ['favicon-16x16.png', light16],
  ['favicon-32x32.png', light32],
  ['favicon-16x16-dark.png', dark16],
  ['favicon-32x32-dark.png', dark32],
  [
    'favicon.ico',
    encodeIco([
      { size: 16, png: light16 },
      { size: 32, png: light32 },
      { size: 48, png: light48 },
    ]),
  ],
];

for (const [name, buf] of writes) {
  fs.writeFileSync(path.join(publicDir, name), buf);
  console.log(`wrote public/${name} ${kb(buf.length)}`);
}

fs.writeFileSync(path.join(brandDir, 'header-ring-light.png'), headerLight);
fs.writeFileSync(path.join(brandDir, 'header-ring-dark.png'), headerDark);
console.log(`wrote src/assets/brand/header-ring-light.png ${kb(headerLight.length)}`);
console.log(`wrote src/assets/brand/header-ring-dark.png ${kb(headerDark.length)}`);
console.log('Skipped apple-touch-icon.png and og-default.jpg (unchanged, opaque / share assets).');
