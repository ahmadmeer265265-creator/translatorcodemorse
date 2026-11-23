import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { onRequest } from '../../functions/_lib/embed-framing.js';
import { pageMeta } from '../config/pages';
import { headerToolsNav, headerTopNav, primaryNav } from '../config/nav';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import WidgetsPage from '../pages/widgets.astro';

const PATH = '/widgets/';
const TITLE = 'Free Morse Code Widgets for Your Website';
const DESCRIPTION =
  'Embed a free interactive Morse code chart or mini translator on your website. Copy the code, paste it in, and it runs in the browser. No account, no cost.';

const CHART_EMBED = `<iframe src="https://translatorcodemorse.com/embed/morse-code-chart/" width="100%" height="640" style="border:1px solid #d9dde3;border-radius:14px;max-width:720px" loading="lazy" title="Interactive Morse Code Chart by translatorcodemorse.com"></iframe>
<p style="font-size:13px;color:#666">Interactive <a href="https://translatorcodemorse.com/morse-code-alphabet/" rel="nofollow">Morse code chart</a> by translatorcodemorse.com</p>`;

const TRANSLATOR_EMBED = `<iframe src="https://translatorcodemorse.com/embed/morse-code-translator/" width="100%" height="430" style="border:1px solid #d9dde3;border-radius:14px;max-width:720px" loading="lazy" title="Morse Code Translator by translatorcodemorse.com"></iframe>
<p style="font-size:13px;color:#666"><a href="https://translatorcodemorse.com/" rel="nofollow">Morse code translator</a> by translatorcodemorse.com</p>`;

describe('embeddable Morse widgets', () => {
  it('lists /widgets/ in the sitemap and keeps it out of the header and footer nav', () => {
    expect(pageMeta.some((page) => page.path === PATH)).toBe(true);
    expect(primaryNav.some((item) => item.href === PATH)).toBe(false);
    expect(headerTopNav.some((item) => item.href === PATH)).toBe(false);
    expect(headerToolsNav.some((item) => item.href === PATH)).toBe(false);
    expect([...TITLE].length).toBeLessThanOrEqual(60);
    expect([...DESCRIPTION].length).toBeGreaterThanOrEqual(140);
    expect([...DESCRIPTION].length).toBeLessThanOrEqual(155);
  });

  it('keeps the supplied embed files byte-stable and noindex except when embedded', () => {
    for (const file of [
      'public/embed/morse-code-chart/index.html',
      'public/embed/morse-code-translator/index.html',
    ]) {
      const html = readFileSync(resolve(file), 'utf8');
      expect(html, file).toContain('<meta name="robots" content="noindex, indexifembedded">');
      expect(html, file).toContain('rel="nofollow noopener"');
      expect(html, file).toContain('target="_top"');
    }
    const headers = readFileSync(resolve('public/_headers'), 'utf8');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).not.toContain('/embed/morse-code-chart/');
    expect(headers).not.toContain('frame-ancestors *');
    const chartFn = readFileSync(resolve('functions/embed/morse-code-chart/[[path]].js'), 'utf8');
    const translatorFn = readFileSync(resolve('functions/embed/morse-code-translator/[[path]].js'), 'utf8');
    expect(chartFn).toContain("from '../../_lib/embed-framing.js'");
    expect(translatorFn).toContain("from '../../_lib/embed-framing.js'");
  });

  it('lets the embed routes be framed and leaves every other header alone', async () => {
    const source = new Headers();
    source.append('X-Frame-Options', 'DENY');
    source.append('X-Frame-Options', 'ALLOWALL');
    source.append('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'");
    source.append('Content-Security-Policy', "default-src 'self'; frame-ancestors *; script-src 'self' 'unsafe-inline'");
    source.set('Cache-Control', 'public, max-age=0, must-revalidate');
    const response = await onRequest({
      next: async () => new Response('widget', { status: 200, statusText: 'OK', headers: source }),
    });
    expect(await response.text()).toBe('widget');
    expect(response.headers.get('X-Frame-Options')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    const policies = [];
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-security-policy') policies.push(value);
    });
    expect(policies).toEqual(["default-src 'self'; frame-ancestors *; script-src 'self' 'unsafe-inline'"]);
  });

  it('renders the widgets page with both live previews and the exact embed codes', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(WidgetsPage as never);
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain(`>${TITLE}</h1>`);
    expect(html).toContain(`<title>${TITLE}</title>`);
    expect(html).toContain(`name="description" content="${DESCRIPTION}"`);
    expect(html).not.toContain('application/ld+json');
    expect(html).toContain('src="/embed/morse-code-chart/"');
    expect(html).toContain('src="/embed/morse-code-translator/"');
    const escaped = (value: string) =>
      value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    expect(html).toContain(escaped(CHART_EMBED));
    expect(html).toContain(escaped(TRANSLATOR_EMBED));
    expect(html).not.toContain('href="/embed/morse-code-chart/"');
    expect(html).not.toContain('href="/embed/morse-code-translator/"');
  });

  it('adds the two specified links and no others on existing pages', () => {
    const alphabet = readFileSync(resolve('src/pages/morse-code-alphabet.astro'), 'utf8');
    expect(alphabet).toContain('Teach Morse code or run a website? You can put this chart on your own page:');
    expect(alphabet).toContain('href="/widgets/">free Morse code widgets</a>');
    const home = readFileSync(resolve('src/components/HomeArticle.astro'), 'utf8');
    expect(home).toContain("href: '/widgets/', label: 'Free Morse code widgets for your website'");
  });
});
