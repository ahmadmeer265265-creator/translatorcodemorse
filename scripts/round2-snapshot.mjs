/**
 * Fetch ranking-protection fields for every sitemap HTML URL.
 * Usage:
 *   node scripts/round2-snapshot.mjs --base https://translatorcodemorse.com --out round-2-baseline/baseline.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}
const base = (arg('--base', 'https://translatorcodemorse.com') || '').replace(/\/$/, '');
const outFile = path.resolve(root, arg('--out', 'round-2-baseline/baseline.json'));

function decodeEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

function attr(html, tag, name) {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, 'i');
  const match = html.match(re);
  if (!match) return '';
  const found = match[1].match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return found ? decodeEntities(found[2] ?? found[3] ?? '') : '';
}

function allMeta(html, key, value) {
  const out = [];
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = match[1];
    const keyMatch = attrs.match(new RegExp(`\\b${key}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
    if (!keyMatch) continue;
    const keyVal = keyMatch[2] ?? keyMatch[3] ?? '';
    if (keyVal.toLowerCase() !== value.toLowerCase()) continue;
    const content = attrs.match(/\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (content) out.push(decodeEntities(content[2] ?? content[3] ?? ''));
  }
  return out;
}

function headings(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return [...html.matchAll(re)].map((match) =>
    decodeEntities(match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()),
  );
}

function mainWordCount(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const inner = main ? main[1] : html;
  const text = inner
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}

function collectJsonLd(value, rows) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLd(item, rows);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const type = value['@type'];
  if (type) {
    const types = Array.isArray(type) ? type.join(',') : String(type);
    rows.push({ type: types, name: typeof value.name === 'string' ? value.name : '' });
  }
  for (const child of Object.values(value)) collectJsonLd(child, rows);
}

function jsonLdRows(html) {
  const rows = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      collectJsonLd(JSON.parse(match[1]), rows);
    } catch {
      rows.push({ type: 'INVALID_JSON', name: '' });
    }
  }
  return rows;
}

function internalLinks(html, pageUrl) {
  const origin = new URL(pageUrl).origin;
  const hrefs = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi)) {
    const href = match[2] ?? match[3] ?? '';
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    try {
      const url = new URL(href, pageUrl);
      if (url.origin === origin) hrefs.push(`${url.pathname}${url.search}`);
    } catch {
      /* skip */
    }
  }
  return [...new Set(hrefs)].sort();
}

function sitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
}

async function fetchText(url, redirect = 'manual') {
  const response = await fetch(url, { redirect, headers: { 'user-agent': 'round2-snapshot/1.0' } });
  const text = await response.text();
  return { response, text };
}

const artifactsDir = path.dirname(outFile);
fs.mkdirSync(artifactsDir, { recursive: true });

const sitemapIndexUrl = `${base}/sitemap-index.xml`;
const sitemap0Url = `${base}/sitemap-0.xml`;
const { text: sitemapIndex } = await fetchText(sitemapIndexUrl, 'follow');
const { text: sitemap0 } = await fetchText(sitemap0Url, 'follow');
fs.writeFileSync(path.join(artifactsDir, 'sitemap-index.xml'), sitemapIndex);
fs.writeFileSync(path.join(artifactsDir, 'sitemap-0.xml'), sitemap0);

for (const name of ['sitemap-video.xml', 'robots.txt']) {
  const { text } = await fetchText(`${base}/${name}`, 'follow');
  fs.writeFileSync(path.join(artifactsDir, name), text);
}

const pages = sitemapLocs(sitemap0).filter((loc) => !loc.endsWith('.xml'));
const results = [];

for (const loc of pages) {
  const { response, text } = await fetchText(loc, 'follow');
  const canonicals = [...text.matchAll(/<link\b([^>]*)>/gi)]
    .map((match) => match[1])
    .filter((attrs) => /\brel\s*=\s*["']canonical["']/i.test(attrs))
    .map((attrs) => {
      const href = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i);
      return href ? decodeEntities(href[2] ?? href[3] ?? '') : '';
    })
    .filter(Boolean);
  const jsonLd = jsonLdRows(text);
  const orgCount = jsonLd.filter((row) => row.type.split(',').includes('Organization')).length;
  results.push({
    url: loc,
    finalUrl: response.url,
    status: response.status,
    canonical: canonicals[0] ?? '',
    canonicals,
    robotsMeta: allMeta(text, 'name', 'robots')[0] ?? '',
    xRobotsTag: response.headers.get('x-robots-tag') ?? '',
    title: decodeEntities((text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()),
    description: allMeta(text, 'name', 'description')[0] ?? '',
    h1: headings(text, 'h1'),
    h2: headings(text, 'h2'),
    mainWordCount: mainWordCount(text),
    jsonLd,
    organizationCount: orgCount,
    personCount: jsonLd.filter((row) => row.type.split(',').includes('Person')).length,
    internalLinks: internalLinks(text, loc),
    internalLinkCount: internalLinks(text, loc).length,
    ogImage: allMeta(text, 'property', 'og:image')[0] ?? '',
    author: allMeta(text, 'name', 'author')[0] ?? '',
  });
  console.log(`${response.status} ${loc}`);
}

const payload = {
  capturedAt: new Date().toISOString(),
  base,
  pages: results,
};
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${outFile} (${results.length} pages)`);
