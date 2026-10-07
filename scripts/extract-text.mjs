import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const sitemapPath = path.join(dist, 'sitemap-0.xml');
const outPath = path.join(root, 'docs', 'page-text.md');

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'path', 'circle']);

const BLOCK = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'summary', 'td', 'th', 'tr', 'caption',
  'dt', 'dd', 'blockquote', 'figcaption', 'option',
]);

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');
}

function htmlFileForLoc(loc) {
  const pathname = new URL(loc).pathname;
  if (pathname === '/') return path.join(dist, 'index.html');
  return path.join(dist, pathname.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
}

function attr(tag, name) {
  const match =
    tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i')) ||
    tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i'));
  return match ? decodeEntities(match[1]) : '';
}

function isHiddenTag(tag) {
  if (/aria-hidden\s*=\s*("true"|'true'|true)/i.test(tag)) return true;
  if (/(?:^|\s)hidden(?:\s|\/|>|=)/i.test(tag.replace(/^<\/?/, ''))) return true;
  const style = attr(tag, 'style').toLowerCase();
  if (/display\s*:\s*none/.test(style) || /visibility\s*:\s*hidden/.test(style)) return true;
  const classes = attr(tag, 'class').split(/\s+/);
  return classes.includes('sr-only') || classes.includes('hidden') || classes.includes('visually-hidden');
}

function linkPath(href) {
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return '';
  }
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      const url = new URL(href);
      return `${url.pathname}${url.search}${url.hash}` || '/';
    }
  } catch {
    return href;
  }
  return href;
}

function tokenize(html) {
  const tokens = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i);
      if (end === -1) break;
      tokens.push({ type: 'tag', value: html.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    const next = html.indexOf('<', i);
    const end = next === -1 ? html.length : next;
    tokens.push({ type: 'text', value: html.slice(i, end) });
    i = end;
  }
  return tokens;
}

function cleanText(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function extractBody(html) {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

function stripIgnored(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
}

function extractVisibleLines(html) {
  const tokens = tokenize(stripIgnored(extractBody(html)));
  const lines = [];
  const stack = [];
  let buffer = '';

  const hidden = () => stack.some((frame) => frame.hidden);

  const emit = (line) => {
    const value = cleanText(line);
    if (value) lines.push(value);
  };

  const takeBuffer = () => {
    const value = buffer;
    buffer = '';
    return value;
  };

  for (const token of tokens) {
    if (token.type === 'text') {
      if (!hidden()) buffer += token.value;
      continue;
    }

    const raw = token.value;
    const close = /^<\//.test(raw);
    const name = (raw.match(/^<\/?\s*([a-zA-Z0-9:-]+)/) || [, ''])[1].toLowerCase();
    const selfClosing = /\/>$/.test(raw) || VOID.has(name);

    if (close) {
      const frame = stack.pop();
      if (!frame) continue;
      if (frame.hidden || hidden()) continue;

      if (frame.name === 'a' && frame.hrefPath) {
        buffer += ` (${frame.hrefPath})`;
        continue;
      }

      if (!BLOCK.has(frame.name)) continue;

      const value = cleanText(takeBuffer());
      if (frame.name === 'h1') emit(`# ${value}`);
      else if (frame.name === 'h2') emit(`## ${value}`);
      else if (frame.name === 'h3') emit(`### ${value}`);
      else if (frame.name === 'h4') emit(`#### ${value}`);
      else if (frame.name === 'h5') emit(`##### ${value}`);
      else if (frame.name === 'h6') emit(`###### ${value}`);
      else if (frame.name === 'p') {
        if (value) {
          const inDetails = stack.some((f) => f.name === 'details');
          emit(inDetails && lines.at(-1)?.startsWith('Q: ') ? `A: ${value}` : value);
        }
      } else if (frame.name === 'li') emit(value ? `- ${value}` : '');
      else if (frame.name === 'summary') emit(value ? `Q: ${value}` : '');
      else if (frame.name === 'td' || frame.name === 'th') {
        const row = [...stack].reverse().find((f) => f.name === 'tr');
        if (row) row.cells.push(value);
        else if (value) emit(value);
      } else if (frame.name === 'tr') {
        // Row close: cells already collected from td/th. Buffer should be empty.
        takeBuffer();
        const cells = frame.cells.map((c) => c.trim()).filter(Boolean);
        if (cells.length === 2) emit(`${cells[0]}: ${cells[1]}`);
        else if (cells.length > 0) emit(cells.join(' | '));
      } else if (frame.name === 'caption' || frame.name === 'dt' || frame.name === 'dd' || frame.name === 'blockquote' || frame.name === 'figcaption') {
        if (value) emit(value);
      }
      continue;
    }

    if (SKIP.has(name)) {
      if (!selfClosing) stack.push({ name, hidden: true, cells: [], hrefPath: '' });
      continue;
    }

    const thisHidden = isHiddenTag(raw) || hidden();

    if (selfClosing) {
      if (!thisHidden && !hidden() && name === 'br') buffer += ' ';
      continue;
    }

    // Flush chrome text (nav links, buttons) before a new block starts.
    if (BLOCK.has(name) && !thisHidden && !hidden()) {
      const pending = cleanText(takeBuffer());
      if (pending) emit(pending);
    }

    const hrefPath = name === 'a' ? linkPath(attr(raw, 'href')) : '';
    stack.push({ name, hidden: thisHidden, cells: [], hrefPath });
  }

  const leftover = cleanText(buffer);
  if (leftover) lines.push(leftover);

  const out = [];
  for (const line of lines) {
    if (!line) continue;
    if (out.length && out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out;
}

function pageMeta(html) {
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const descMatch =
    html.match(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*"([^"]*)"/i) ||
    html.match(/<meta\b[^>]*content\s*=\s*"([^"]*)"[^>]*name\s*=\s*["']description["']/i) ||
    html.match(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*'([^']*)'/i);
  return { title, description: descMatch ? cleanText(descMatch[1]) : '' };
}

function wordCount(text) {
  const words = text.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g);
  return words ? words.length : 0;
}

if (!fs.existsSync(sitemapPath)) {
  console.error(`Missing ${path.relative(root, sitemapPath)}. Run a build first.`);
  process.exit(1);
}

const locs = [...fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) =>
  m[1].trim(),
);

const sections = [];
const counts = [];

for (const loc of locs) {
  const file = htmlFileForLoc(loc);
  if (!fs.existsSync(file)) {
    console.error(`No HTML for ${loc}`);
    process.exit(1);
  }
  const html = fs.readFileSync(file, 'utf8');
  const { title, description } = pageMeta(html);
  const body = extractVisibleLines(html).join('\n');
  const block = [`URL: ${loc}`, `Title: ${title}`, `Description: ${description}`, '', body].join('\n');
  sections.push(block);
  counts.push({ loc, words: wordCount(`${title}\n${description}\n${body}`) });
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${sections.join('\n\n---\n\n')}\n`);

console.log(path.relative(root, outPath).replaceAll('\\', '/'));
console.log(`pages: ${counts.length}`);
for (const row of counts) console.log(`${row.loc}\t${row.words}`);
