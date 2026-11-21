/**
 * Visual QA for /i-love-you-in-morse-code/: desktop/mobile × light/dark.
 *
 * Serves dist/, screenshots four combinations, and fails on console errors,
 * page errors, or broken images (including the YouTube facade poster).
 *
 * Run after a production build: pnpm build && pnpm qa:love
 *
 * Screenshots: .lighthouse/i-love-you-qa/
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const shotDir = path.join(root, '.lighthouse', 'i-love-you-qa');
const PAGE = '/i-love-you-in-morse-code/';
const YOUTUBE_EMBED = 'https://www.youtube-nocookie.com/embed/Ni3vz9gQCgA?autoplay=1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
};

const combos = [
  { name: 'desktop-light', width: 1280, height: 800, theme: 'light' },
  { name: 'desktop-dark', width: 1280, height: 800, theme: 'dark' },
  { name: 'mobile-light', width: 390, height: 844, theme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, theme: 'dark' },
];

function startDistServer() {
  if (!fs.existsSync(dist)) {
    throw new Error('dist/ missing — run pnpm build before qa:love');
  }
  const server = http.createServer((req, res) => {
    let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(dist, pathname.replace(/^[/\\]+/, ''));
    res.setHeader('Cache-Control', 'no-store');
    try {
      const data = fs.readFileSync(file);
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
        reject(new Error('qa server has no port'));
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

async function waitDecoded(page, selector, expectedTheme) {
  await page.waitForFunction(
    ({ sel, theme }) => {
      const el = document.querySelector(sel);
      if (!(el instanceof HTMLImageElement)) return false;
      if (theme && el.getAttribute('data-theme-src') !== theme) return false;
      return el.complete && el.naturalWidth > 0;
    },
    { sel: selector, theme: expectedTheme ?? null },
    { timeout: 20000 },
  );
}

async function waitFeatureDecoded(page, index, theme) {
  await page.waitForFunction(
    ({ i, expected }) => {
      const feature = document.querySelectorAll('[data-article-feature]')[i];
      const img = feature?.querySelector('img[data-theme-src]');
      if (!(img instanceof HTMLImageElement)) return false;
      if (img.getAttribute('data-theme-src') !== expected) return false;
      return img.complete && img.naturalWidth > 0;
    },
    { i: index, expected: theme },
    { timeout: 20000 },
  );
}

async function armThemeImages(page, theme) {
  await page.evaluate((nextTheme) => {
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // private mode
    }
  }, theme);

  const features = page.locator('[data-article-feature]');
  const count = await features.count();
  if (count !== 2) throw new Error(`expected 2 [data-article-feature] figures, got ${count}`);

  for (let i = 0; i < count; i++) {
    await features.nth(i).scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
    });
    await waitFeatureDecoded(page, i, theme);
    await features.nth(i).locator(`img[data-theme-src="${theme}"]`).evaluate((el) => {
      if (!(el instanceof HTMLImageElement)) return;
      el.loading = 'eager';
    });
  }

  const video = page.locator('[data-demo-video-figure]');
  await video.scrollIntoViewIfNeeded();
  await page.locator('[data-demo-video] img').evaluate((el) => {
    if (el instanceof HTMLImageElement) el.loading = 'eager';
  });
  await waitDecoded(page, '[data-demo-video] img', null);
}

async function runCombo(browser, origin, combo) {
  const errors = [];
  const failed = [];
  const page = await browser.newPage({ viewport: { width: combo.width, height: combo.height } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(String(err));
  });
  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    if (status >= 400 && /\.(png|jpe?g|webp|avif|gif|svg|ico)(\?|$)/i.test(url)) {
      failed.push(`${status} ${url}`);
    }
  });

  await page.addInitScript((theme) => {
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // private mode
    }
  }, combo.theme);

  await page.goto(`${origin}${PAGE}`, { waitUntil: 'networkidle' });
  await page.evaluate((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  }, combo.theme);
  await armThemeImages(page, combo.theme);

  const youtube = await page.evaluate((embed) => {
    const root = document.querySelector('[data-demo-video]');
    const poster = document.querySelector('[data-demo-video] img');
    return {
      present: Boolean(root),
      embed: root?.getAttribute('data-embed') ?? '',
      embedOk: root?.getAttribute('data-embed') === embed,
      posterOk: poster instanceof HTMLImageElement && poster.complete && poster.naturalWidth > 0,
    };
  }, YOUTUBE_EMBED);

  const images = await page.evaluate((expectedTheme) => {
    return [...document.querySelectorAll('[data-article-feature] img[data-theme-src]')].map((img) => ({
      theme: img.getAttribute('data-theme-src'),
      src: img.getAttribute('src'),
      ok: img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0,
      themeOk: img.getAttribute('data-theme-src') === expectedTheme,
    }));
  }, combo.theme);

  fs.mkdirSync(shotDir, { recursive: true });
  const shotPath = path.join(shotDir, `${combo.name}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  await page.close();

  const imagesOk = images.length === 2 && images.every((row) => row.ok && row.themeOk);
  const ok =
    errors.length === 0 &&
    failed.length === 0 &&
    imagesOk &&
    youtube.present &&
    youtube.embedOk &&
    youtube.posterOk;

  return {
    name: combo.name,
    theme: combo.theme,
    viewport: `${combo.width}x${combo.height}`,
    screenshot: path.relative(root, shotPath),
    consoleErrors: errors,
    brokenImages: failed,
    images,
    youtube,
    pass: ok,
  };
}

const server = await startDistServer();
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const combo of combos) {
    results.push(await runCombo(browser, server.url, combo));
  }
} finally {
  await browser.close();
  await server.close();
}

const failedRuns = results.filter((row) => !row.pass);
console.log(JSON.stringify({ shotDir: path.relative(root, shotDir), results }, null, 2));
if (failedRuns.length > 0) {
  console.error(`qa:love failed (${failedRuns.length}/${results.length})`);
  process.exit(1);
}
console.log('qa:love: ok');
