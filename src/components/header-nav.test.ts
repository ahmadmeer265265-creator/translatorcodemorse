import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { chromium, type Browser, type Page } from 'playwright';
import { headerToolsNav, primaryNav } from '../config/nav';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import Header from './Header.astro';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function lin(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const n = hex.replace('#', '');
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function startDistServer(): Promise<{ url: string; close: () => Promise<void> }> {
  if (!existsSync(DIST)) {
    throw new Error('dist/ missing — run pnpm build before the header nav layout test');
  }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(DIST, p.replace(/^[/\\]+/, ''));
    res.setHeader('Cache-Control', 'no-store');
    try {
      const data = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const loc = server.address();
      if (!loc || typeof loc === 'string') {
        reject(new Error('header nav server has no port'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${loc.port}`,
        close: () =>
          new Promise((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          }),
      });
    });
  });
}

describe('header nav structure', () => {
  it('renders Morse Tools as crawlable links, not JS-only items', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Header as never);
    expect(html).toContain('>Morse Tools</summary>');
    expect(html).toContain('data-nav-tools');
    expect(html).not.toContain('class="truncate"');
    expect(html).toContain('data-site-name');
    for (const link of headerToolsNav) {
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(link.label);
    }
    for (const item of primaryNav) expect(html).toContain(`href="${item.href}"`);
    const headerSrc = readFileSync(path.join(ROOT, 'src/components/Header.astro'), 'utf8');
    expect(headerSrc).toContain("from '../lib/site-header-nav'");
    expect(headerSrc).toContain('initSiteHeaderNav');
    const translator = readFileSync(path.join(ROOT, 'src/components/Translator.astro'), 'utf8');
    expect(translator).not.toContain('site-header-nav');
  });

  it('raises dark --line to at least 3:1 against the dark canvas', () => {
    const css = readFileSync(path.join(ROOT, 'src/styles/global.css'), 'utf8');
    const dark = css.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1] ?? '';
    const canvas = dark.match(/--canvas:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const line = dark.match(/--line:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(canvas).toBe('#14110e');
    expect(line).toBe('#7a6c5c');
    expect(contrast(line!, canvas!)).toBeGreaterThanOrEqual(3);
    expect(contrast('#3a322a', '#14110e')).toBeLessThan(3);
  });

  it('adds one Morse Code Machine link on each of the four contextual pages', () => {
    const files = [
      'src/components/american-translator/AmericanArticle.astro',
      'src/pages/morse-code-audio-translator.astro',
      'src/pages/morse-code-alphabet.astro',
      'src/pages/sos-in-morse-code.astro',
    ];
    for (const file of files) {
      const src = readFileSync(path.join(ROOT, file), 'utf8');
      const matches = src.match(/href="\/morse-code-machine\/"/g) ?? [];
      expect(matches.length, file).toBe(1);
    }
  });
});

describe('header nav layout and dark borders', () => {
  let server: { url: string; close: () => Promise<void> };
  let browser: Browser;

  beforeAll(async () => {
    server = await startDistServer();
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  async function measureName(page: Page) {
    return page.evaluate(() => {
      const name = document.querySelector('[data-site-name]');
      if (!(name instanceof HTMLElement)) throw new Error('site name missing');
      const style = getComputedStyle(name);
      return {
        text: name.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        overflow: style.textOverflow,
        scrollWidth: name.scrollWidth,
        clientWidth: name.clientWidth,
      };
    });
  }

  it(
    'keeps the site name untruncated at 390×844 and 400×650, with crawlable tool links and 3:1 borders',
    async () => {
      const homeHtml = readFileSync(path.join(DIST, 'index.html'), 'utf8');
      expect(homeHtml).toContain('href="/morse-code-audio-translator/"');
      expect(homeHtml).toContain('href="/morse-code-image-translator/"');
      expect(homeHtml).toContain('href="/american-morse-code-translator/"');
      expect(homeHtml).toContain('href="/morse-code-machine/"');
      expect(homeHtml).toContain('Audio Translator');
      expect(homeHtml).toContain('Morse Code Machine');
      expect(homeHtml).toContain('>Morse Tools</summary>');

      for (const viewport of [
        { width: 390, height: 844 },
        { width: 400, height: 650 },
      ]) {
        const page = await browser.newPage({ viewport });
        await page.goto(`${server.url}/`, { waitUntil: 'load' });
        const shot = await measureName(page);
        expect(shot.text).toBe('Morse Code Translator');
        expect(shot.overflow).not.toBe('ellipsis');
        expect(shot.scrollWidth).toBeLessThanOrEqual(shot.clientWidth + 1);
        await page.close();
      }

      const contrastPages = ['/', '/morse-code-audio-translator/', '/morse-code-alphabet/'];
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
      for (const pathName of contrastPages) {
        await page.goto(`${server.url}${pathName}`, { waitUntil: 'load' });
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        const ratio = await page.evaluate(() => {
          const lin = (channel: number) => {
            const c = channel / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          const parse = (value: string) => {
            const trimmed = value.trim();
            const hex = trimmed.match(/^#([0-9a-f]{6})$/i);
            if (hex) {
              const n = hex[1]!;
              return {
                r: Number.parseInt(n.slice(0, 2), 16),
                g: Number.parseInt(n.slice(2, 4), 16),
                b: Number.parseInt(n.slice(4, 6), 16),
              };
            }
            const m = trimmed.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
            if (!m) return null;
            return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
          };
          const lum = (rgb: { r: number; g: number; b: number }) =>
            0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
          const root = getComputedStyle(document.documentElement);
          const canvas = parse(root.getPropertyValue('--canvas')) ?? parse(getComputedStyle(document.body).backgroundColor);
          const line = parse(root.getPropertyValue('--line'));
          if (!canvas || !line) return 0;
          const [hi, lo] = lum(canvas) > lum(line) ? [lum(canvas), lum(line)] : [lum(line), lum(canvas)];
          return (hi + 0.05) / (lo + 0.05);
        });
        expect(ratio, pathName).toBeGreaterThanOrEqual(3);
      }
      await page.close();
    },
    120_000,
  );
});
