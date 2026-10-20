import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const astroDir = path.join(dist, '_astro');
const homepage = path.join(dist, 'index.html');
const FORBIDDEN = ['example.com', 'TODO', 'lorem'];
const REQUIRED_ASSETS = [
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-16x16-dark.png',
  'favicon-32x32-dark.png',
  'apple-touch-icon.png',
  'og-default.jpg',
];

const errors = [];

function fail(message) {
  errors.push(message);
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

function isDraft(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---')) return false;
  const end = text.indexOf('\n---', 3);
  const front = end === -1 ? '' : text.slice(3, end);
  return /^draft:\s*true\s*$/m.test(front);
}

function hasPublishedBlogPosts() {
  const dir = path.join(root, 'src', 'content', 'blog');
  return walk(dir).some((file) => /\.mdx?$/.test(file) && !isDraft(file));
}

function scriptAndPreloadRefs(html) {
  const refs = [];
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1];
    const src = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (src) refs.push({ kind: 'script', href: src[2] ?? src[3] });
  }
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = match[1];
    if (!/\brel\s*=\s*("modulepreload"|'modulepreload')/i.test(attrs)) continue;
    const href = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (href) refs.push({ kind: 'modulepreload', href: href[2] ?? href[3] });
  }
  return refs;
}

function fileNameOf(href) {
  const clean = href.split('?')[0].split('#')[0];
  return path.posix.basename(clean.replace(/\\/g, '/'));
}

function dynamicImportFiles(code) {
  const names = new Set();
  for (const match of code.matchAll(/import\(\s*(["'`])(\.?\.?\/[^"'`]+)\1\s*\)/g)) {
    names.add(path.posix.basename(match[2]));
  }
  return [...names];
}

function sitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
}

function decodeEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

function htmlFileForLoc(loc) {
  const pathname = new URL(loc).pathname;
  if (pathname === '/') return path.join(dist, 'index.html');
  return path.join(dist, pathname.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
}

function pageSeo(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : '';
  const descMatch = html.match(
    /<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/i,
  ) || html.match(
    /<meta\b[^>]*content\s*=\s*("([^"]*)"|'([^']*)')[^>]*name\s*=\s*["']description["'][^>]*>/i,
  );
  const description = descMatch ? decodeEntities(descMatch[2] ?? descMatch[3] ?? '') : '';
  const canonicals = [...html.matchAll(/<link\b([^>]*)>/gi)]
    .map((match) => match[1])
    .filter((attrs) => /\brel\s*=\s*["']canonical["']/i.test(attrs))
    .map((attrs) => {
      const href = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i);
      return href ? decodeEntities(href[2] ?? href[3] ?? '') : '';
    })
    .filter(Boolean);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    decodeEntities(match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()),
  );
  return { title, description, canonicals, h1s };
}

async function parseModule(file) {
  const relative = path.relative(root, file);
  const code = fs.readFileSync(file, 'utf8');
  try {
    esbuild.transformSync(code, {
      loader: 'js',
      format: 'esm',
      sourcefile: relative.replace(/\.js$/i, '.mjs'),
      logLevel: 'silent',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`${relative} failed esbuild ESM parse:\n${detail}`);
    return;
  }
  try {
    await import(`${pathToFileURL(file).href}?verify=${Date.now()}-${Math.random()}`);
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail(`${relative} is not valid ES module JS: ${error.message}`);
    }
  }
}

if (!fs.existsSync(dist)) fail('dist/ does not exist');
if (!fs.existsSync(astroDir)) fail('dist/_astro/ does not exist');
if (!fs.existsSync(homepage)) fail('dist/index.html does not exist');

for (const asset of REQUIRED_ASSETS) {
  if (!fs.existsSync(path.join(dist, asset))) fail(`Missing built asset: ${asset}`);
}

const jsFiles = walk(astroDir).filter((file) => file.endsWith('.js'));
if (jsFiles.length === 0) fail('No .js files in dist/_astro');

for (const file of jsFiles) {
  await parseModule(file);
}

const homeHtml = fs.existsSync(homepage) ? fs.readFileSync(homepage, 'utf8') : '';
const homeRefs = scriptAndPreloadRefs(homeHtml);
const translatorRefs = homeRefs.filter((ref) => /\/_astro\/[^/]+\.js$/i.test(ref.href.split('?')[0]));
const translatorScript = translatorRefs.find((ref) => ref.kind === 'script');

if (!translatorScript) {
  fail('Homepage HTML does not reference the translator script');
} else {
  const translatorName = fileNameOf(translatorScript.href);
  const translatorPath = path.join(astroDir, translatorName);
  if (!fs.existsSync(translatorPath)) {
    fail(`Homepage translator script is missing on disk: ${translatorName}`);
  } else {
    const translatorCode = fs.readFileSync(translatorPath, 'utf8');
    const lazyNames = dynamicImportFiles(translatorCode);
    if (lazyNames.length === 0) {
      fail('Translator script has no dynamic import for lazy chunks (audio/actions/tap)');
    }
    for (const name of lazyNames) {
      const lazyPath = path.join(astroDir, name);
      if (!fs.existsSync(lazyPath)) fail(`Lazy chunk is missing on disk: ${name}`);
      const leaked = homeRefs.filter((ref) => fileNameOf(ref.href) === name);
      for (const ref of leaked) {
        fail(`Homepage HTML references a lazy chunk in a ${ref.kind} tag: ${ref.href}`);
      }
    }
  }
}

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  let block = 0;
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    block += 1;
    const raw = match[1].trim();
    try {
      JSON.parse(raw);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(`${relative} JSON-LD block ${block} is not valid JSON: ${detail}`);
    }
  }
  const lower = html.toLowerCase();
  for (const token of FORBIDDEN) {
    if (lower.includes(token.toLowerCase())) {
      fail(`${relative} contains forbidden text "${token}"`);
    }
  }
}

const sitemapIndex = path.join(dist, 'sitemap-index.xml');
const sitemap0 = path.join(dist, 'sitemap-0.xml');
if (!fs.existsSync(sitemapIndex)) fail('dist/sitemap-index.xml is missing');
if (!fs.existsSync(sitemap0)) fail('dist/sitemap-0.xml is missing');

const published = hasPublishedBlogPosts();
const pageLocs = [];
if (fs.existsSync(sitemapIndex) && fs.existsSync(sitemap0)) {
  const locs = [
    ...sitemapLocs(fs.readFileSync(sitemapIndex, 'utf8')),
    ...sitemapLocs(fs.readFileSync(sitemap0, 'utf8')),
  ];
  if (locs.length === 0) fail('Sitemaps contain no <loc> URLs');
  for (const loc of locs) {
    if (loc.endsWith('.xml')) continue;
    pageLocs.push(loc);
    if (!published) {
      if (loc.includes('/blog/')) fail(`Sitemap includes blog URL while there are no published posts: ${loc}`);
      if (loc.includes('/404/')) fail(`Sitemap includes 404 URL: ${loc}`);
    }
  }
}

const titles = new Map();
const descriptions = new Map();
const headings = new Map();

for (const loc of pageLocs) {
  const file = htmlFileForLoc(loc);
  const relative = path.relative(root, file);
  if (!fs.existsSync(file)) {
    fail(`Sitemap URL has no built HTML: ${loc}`);
    continue;
  }
  const seo = pageSeo(fs.readFileSync(file, 'utf8'));
  if (seo.h1s.length !== 1) fail(`${relative} must have exactly one <h1> (found ${seo.h1s.length})`);
  if (seo.canonicals.length !== 1) {
    fail(`${relative} must have exactly one canonical (found ${seo.canonicals.length})`);
  } else if (seo.canonicals[0] !== loc) {
    fail(`${relative} canonical is "${seo.canonicals[0]}" but sitemap URL is "${loc}"`);
  }
  if (!seo.title) fail(`${relative} is missing a title`);
  else if ([...seo.title].length > 60) fail(`${relative} title is ${[...seo.title].length} characters (max 60): ${seo.title}`);
  if (!seo.description) fail(`${relative} is missing a meta description`);
  else {
    const len = [...seo.description].length;
    if (len < 140 || len > 155) {
      fail(`${relative} meta description is ${len} characters (need 140–155)`);
    }
  }
  if (seo.title) {
    if (titles.has(seo.title)) fail(`Duplicate title "${seo.title}" on ${titles.get(seo.title)} and ${relative}`);
    else titles.set(seo.title, relative);
  }
  if (seo.description) {
    if (descriptions.has(seo.description)) {
      fail(`Duplicate description on ${descriptions.get(seo.description)} and ${relative}`);
    } else descriptions.set(seo.description, relative);
  }
  if (seo.h1s[0]) {
    if (headings.has(seo.h1s[0])) fail(`Duplicate H1 "${seo.h1s[0]}" on ${headings.get(seo.h1s[0])} and ${relative}`);
    else headings.set(seo.h1s[0], relative);
  }
}

if (errors.length > 0) {
  console.error(`verify-dist failed (${errors.length}):`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log('verify-dist: ok');
