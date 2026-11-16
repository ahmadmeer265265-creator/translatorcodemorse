import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { headerTopNav, primaryNav } from '../config/nav';
import { pageMeta } from '../config/pages';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import SpeedPage from '../pages/morse-code-speed-statistics.astro';

const PATH = '/morse-code-speed-statistics/';

describe('Morse code speed statistics page', () => {
  it('is in the sitemap index and both nav lists', () => {
    expect(pageMeta.some((page) => page.path === PATH)).toBe(true);
    expect(primaryNav.some((item) => item.href === PATH)).toBe(true);
    expect(headerTopNav.some((item) => item.href === PATH)).toBe(true);
  });

  it('renders the audited headline figures, chart, tables, and internal links', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SpeedPage as never);
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain('>How Fast Does the World Actually Send Morse Code?</h1>');
    expect(html).toContain('<title>How Fast Does the World Actually Send Morse Code?</title>');
    expect(html).toContain('24');
    expect(html).toContain('WPM');
    expect(html).toContain('16,703,487');
    expect(html).toContain('110,003');
    expect(html).toContain('width:14.8%');
    expect(html).toContain('width:49.3%');
    expect(html).toContain('width:100%');
    expect(html).toContain('width:97.2%');
    expect(html).toContain('width:60.3%');
    expect(html).toContain('width:19.7%');
    expect(html).toContain('width:2.8%');
    expect(html).toContain('4.3%');
    expect(html).toContain('5,388,114');
    expect(html).toContain('10,764,507');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/morse-code-alphabet/"');
    expect(html).toContain('href="/morse-code-audio-translator/"');
    expect(html).toContain('Cite this study: Mir Labs / translatorcodemorse.com');
    expect(html).toContain('https://www.reversebeacon.net/');
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/)?.[1] ?? '';
    expect([...desc].length).toBeGreaterThanOrEqual(140);
    expect([...desc].length).toBeLessThanOrEqual(155);
  });

  it('adds one inbound sentence link from the alphabet page', () => {
    const src = readFileSync(resolve('src/pages/morse-code-alphabet.astro'), 'utf8');
    expect(src).toContain('href="/morse-code-speed-statistics/"');
    expect(src).toContain('how fast people actually send Morse code?');
    expect((src.match(/href="\/morse-code-speed-statistics\/"/g) ?? []).length).toBe(1);
  });
});
