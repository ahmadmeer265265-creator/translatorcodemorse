/**
 * One-shot asset generator. Run with: node scripts/generate-icons.mjs
 * Writes PNG/ICO favicons and the Open Graph image into public/.
 * Do not run at deploy time; commit the outputs.
 *
 * Does not regenerate src/assets/mark.png (header chip stays the Dit-Dah mark).
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
const ogSrc = path.join(brandDir, 'featured-image-1200x630.png');

for (const file of [lightMark, darkMark, ogSrc]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing brand source: ${path.relative(root, file)}`);
  }
}

/** Build a multi-size .ico from PNG buffers (PNG-compressed ICO entries). */
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

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function resizePng(src, size) {
  return sharp(src)
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

const light16 = await resizePng(lightMark, 16);
const light32 = await resizePng(lightMark, 32);
const light48 = await resizePng(lightMark, 48);
const dark16 = await resizePng(darkMark, 16);
const dark32 = await resizePng(darkMark, 32);
const apple = await sharp(lightMark)
  .resize(180, 180, { fit: 'cover' })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

const writes = [
  ['favicon-16x16.png', light16],
  ['favicon-32x32.png', light32],
  ['favicon-16x16-dark.png', dark16],
  ['favicon-32x32-dark.png', dark32],
  ['apple-touch-icon.png', apple],
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

const ogMeta = await sharp(ogSrc).metadata();
if (ogMeta.width !== 1200 || ogMeta.height !== 630) {
  throw new Error(`OG source must be 1200x630, got ${ogMeta.width}x${ogMeta.height}`);
}

const ogSourceBytes = fs.statSync(ogSrc).size;
const ogPng = await sharp(ogSrc).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
const ogJpeg = await sharp(ogSrc).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
console.log(`OG source PNG ${kb(ogSourceBytes)}`);
console.log(`OG compressed PNG (not used) ${kb(ogPng.length)}`);
console.log(`OG jpeg q86 ${kb(ogJpeg.length)}`);

// JPEG is ~8× smaller than compressed PNG for this gradient card; crawlers accept JPEG.
fs.writeFileSync(path.join(publicDir, 'og-default.jpg'), ogJpeg);
const stalePng = path.join(publicDir, 'og-default.png');
if (fs.existsSync(stalePng)) fs.unlinkSync(stalePng);
console.log(`wrote public/og-default.jpg ${kb(ogJpeg.length)} (1200x630)`);
console.log('Did not write src/assets/mark.png (header logo unchanged).');
