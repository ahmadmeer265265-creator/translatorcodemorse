/**
 * One-shot asset generator. Run with: node scripts/generate-icons.mjs
 * Writes PNG/ICO favicons and the Open Graph image into public/.
 * Do not run at deploy time; commit the outputs.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const assetsDir = path.join(root, 'src', 'assets');
const faviconSvg = fs.readFileSync(path.join(publicDir, 'favicon.svg'));

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

const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#14110e"/>
  <rect x="80" y="185" width="160" height="160" rx="36" fill="#14110e" stroke="#3a322a" stroke-width="2"/>
  <rect x="80" y="185" width="160" height="160" rx="36" fill="#1c1814"/>
  <circle cx="128" cy="265" r="22" fill="#f0a94e"/>
  <rect x="164" y="243" width="52" height="44" rx="22" fill="#f0a94e"/>
  <text x="280" y="275" fill="#f5efe6" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="64" font-weight="700">Morse Code Translator</text>
  <text x="280" y="340" fill="#f0a94e" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="28">Text to Morse and Morse to text in your browser</text>
</svg>`;

const png16 = await sharp(faviconSvg).resize(16, 16).png().toBuffer();
const png32 = await sharp(faviconSvg).resize(32, 32).png().toBuffer();
const png48 = await sharp(faviconSvg).resize(48, 48).png().toBuffer();

fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
await sharp(faviconSvg).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
fs.writeFileSync(
  path.join(publicDir, 'favicon.ico'),
  encodeIco([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ]),
);
await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(path.join(publicDir, 'og-default.png'));
// Header logo (Header.astro Picture) — same Dit-Dah mark as the favicon.
await sharp(faviconSvg).resize(64, 64).png().toFile(path.join(assetsDir, 'mark.png'));

console.log('Wrote favicon-32x32.png, favicon.ico (16/32/48), apple-touch-icon.png, og-default.png, src/assets/mark.png');
