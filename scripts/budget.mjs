/**
 * Dev-only payload report. Not imported by the site.
 * Builds, then prints gzip-9 and brotli sizes for every sitemap HTML page.
 * Compression uses Node zlib only: gzip level 9, brotli quality 11.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const astroDir = path.join(dist, '_astro');

if (!process.argv.includes('--no-build')) {
  execSync('corepack pnpm build', { cwd: root, stdio: 'inherit' });
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function htmlPath(url) {
  const pathname = new URL(url).pathname;
  if (pathname === '/') return path.join(dist, 'index.html');
  return path.join(dist, pathname.replace(/^\/+|\/+$/g, ''), 'index.html');
}

function uniqueAttr(html, tagRe, attr) {
  const found = new Set();
  for (const match of html.matchAll(tagRe)) {
    const value = match[1];
    if (value && !value.startsWith('data:')) found.add(value.split(/\s+/)[0]);
  }
  return found;
}

function measure(html) {
  const raw = Buffer.from(html);
  const gzip = zlib.gzipSync(raw, { level: 9 });
  const brotli = zlib.brotliCompressSync(raw, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  });
  let styleBytes = 0;
  let styleBlocks = 0;
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    styleBlocks += 1;
    styleBytes += Buffer.byteLength(match[1]);
  }
  const scripts = uniqueAttr(html, /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi);
  const sheets = new Set();
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = match[1];
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(attrs)) continue;
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (href) sheets.add(href[1]);
  }
  const images = uniqueAttr(html, /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi);
  const cssRefs = [...sheets].filter((href) => /\/_astro\/[^/]+\.css(?:$|\?)/i.test(href));
  return {
    gzip: gzip.length,
    brotli: brotli.length,
    requests: 1 + scripts.size + sheets.size + images.size,
    scripts: scripts.size,
    sheets: sheets.size,
    images: images.size,
    styleBytes,
    styleBlocks,
    cssRefs: cssRefs.length,
  };
}

const cssFiles = walk(astroDir).filter((file) => file.endsWith('.css'));
const sitemapPath = path.join(dist, 'sitemap-0.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const pages = locs(sitemap).filter((url) => !url.endsWith('.xml'));

const kb = (bytes) => (bytes / 1024).toFixed(1);

console.log('');
console.log(`/_astro/*.css files: ${cssFiles.length}`);
console.log('Requests = 1 HTML document + script src + stylesheet href + img src (srcset candidates not counted).');
console.log('gzip-9 and brotli q11 are computed locally from the built HTML file.');
console.log('');
console.log(
  ['path', 'gzip9', 'br11', 'req', 'style', 'blocks', 'css'].map((cell, index) =>
    cell.padEnd([28, 8, 8, 5, 8, 7, 4][index]),
  ).join(''),
);

for (const url of pages) {
  const file = htmlPath(url);
  const html = fs.readFileSync(file, 'utf8');
  const row = measure(html);
  const pathname = new URL(url).pathname;
  console.log(
    [
      pathname.padEnd(28),
      kb(row.gzip).padStart(6),
      kb(row.brotli).padStart(7),
      String(row.requests).padStart(4),
      String(row.styleBytes).padStart(8),
      String(row.styleBlocks).padStart(6),
      String(row.cssRefs).padStart(4),
    ].join(' '),
  );
}

const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const scriptMatch = home.match(/\/_astro\/(Translator\.astro_astro_type_script_index_0_lang\.([^"/]+)\.js)/);
if (!scriptMatch) {
  console.error('Homepage translator script reference was not found.');
  process.exit(1);
}
const scriptFile = path.join(astroDir, `${scriptMatch[1].split('/').pop()}`);
const scriptBuf = fs.readFileSync(scriptFile);
const scriptGzip = zlib.gzipSync(scriptBuf, { level: 9 }).length;
const scriptRefs = [...home.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']*Translator\.astro[^"']*)["']/gi)];
console.log('');
console.log('Homepage translator script');
console.log(`file: ${path.basename(scriptFile)}`);
console.log(`hash: ${scriptMatch[2]}`);
console.log(`raw: ${scriptBuf.length}`);
console.log(`gzip-9: ${scriptGzip}`);
console.log(`homepage script requests for this file: ${scriptRefs.length}`);
