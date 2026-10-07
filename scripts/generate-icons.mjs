/**
 * One-shot asset generator. Run with: node scripts/generate-icons.mjs
 * Writes PNGs into public/. Do not run at deploy time; commit the outputs.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const faviconSvg = fs.readFileSync(path.join(publicDir, 'favicon.svg'));

const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1218"/>
      <stop offset="100%" stop-color="#161b24"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="80" y="180" width="160" height="160" rx="28" fill="#0b4db8"/>
  <circle cx="120" cy="260" r="14" fill="#ffffff"/>
  <rect x="148" y="246" width="52" height="28" rx="6" fill="#ffffff"/>
  <circle cx="220" cy="260" r="14" fill="#ffffff"/>
  <text x="280" y="275" fill="#f3f6fa" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="64" font-weight="700">Morse Code Translator</text>
  <text x="280" y="340" fill="#b7d0ff" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="28">Text to Morse and Morse to text in your browser</text>
</svg>`;

await sharp(faviconSvg).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
await sharp(faviconSvg).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(path.join(publicDir, 'og-default.png'));

console.log('Wrote favicon-32x32.png, apple-touch-icon.png, og-default.png');
