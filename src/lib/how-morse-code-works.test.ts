import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { draftPageMeta, pageMeta } from '../config/pages';
import { headerToolsNav, headerTopNav, primaryNav } from '../config/nav';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import HowPage from '../pages/how-morse-code-works.astro';

const PATH = '/how-morse-code-works/';
const TITLE = 'How Morse Code Works: Timing, Alphabet, and Gaps';
const DESCRIPTION =
  'How Morse code works: a short mark and a long mark, held for fixed lengths, become letters, numbers, and words you can send by sound, light, or a tap.';
const OG_IMAGE_PATH = '/how-morse-code-works-featured.jpg';
const ALT_LIGHT =
  'Illustration of a vintage telegraph key with a Morse code wave of dots and dashes radiating outward, on a warm cream background';
const ALT_DARK =
  'Illustration of a vintage telegraph key with a Morse code wave of dots and dashes radiating outward, on a dark brown background';

const headings = [
  'What Morse Code Actually Is',
  'How a Dot Becomes a Dash: The Timing Rules',
  'Why E Is One Dot and Q Takes Four Symbols',
  'The Alphabet, Numbers, and Punctuation at a Glance',
  'A Quick History: From Telegraph Key to Radio Wave',
  'American Morse vs. International Morse',
  'Common Shorthand: Prosigns, Q-Codes, and Confusable Pairs',
  'Beyond Sound: Sending Morse Without a Sounder',
  'Why a 180-Year-Old Code Still Beats Voice Sometimes',
  'How to Learn It (Methods That Actually Work)',
  'FAQ',
  'Related Tools',
] as const;

const outbound = [
  'href="/"',
  'href="/morse-code-audio-translator/"',
  'href="/american-morse-code-translator/"',
  'href="/morse-code-machine/"',
  'href="/morse-code-alphabet/"',
  'href="/morse-code-numbers/"',
  'href="/sos-in-morse-code/"',
] as const;

const reciprocal = [
  'src/components/HomeArticle.astro',
  'src/pages/morse-code-audio-translator.astro',
  'src/components/american-translator/AmericanArticle.astro',
  'src/components/morse-machine/MorseArticle.astro',
  'src/pages/morse-code-alphabet.astro',
  'src/pages/morse-code-numbers.astro',
  'src/pages/sos-in-morse-code.astro',
] as const;

describe('How Morse code works page', () => {
  it('is live and indexable, but not in the header or footer nav', () => {
    expect(pageMeta.some((page) => page.path === PATH)).toBe(true);
    expect(draftPageMeta.some((page) => page.path === PATH)).toBe(false);
    expect(primaryNav.some((item) => item.href === PATH)).toBe(false);
    expect(headerTopNav.some((item) => item.href === PATH)).toBe(false);
    expect(headerToolsNav.some((item) => item.href === PATH)).toBe(false);
    expect([...TITLE].length).toBeLessThanOrEqual(60);
    expect([...DESCRIPTION].length).toBeGreaterThanOrEqual(140);
    expect([...DESCRIPTION].length).toBeLessThanOrEqual(155);
  });

  it('renders the twelve sections in order, with schema and no phrase translator', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HowPage as never);
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain(
      '>How Morse Code Works (Timing, the Alphabet, and Why It Still Works)</h1>',
    );
    expect(html).toContain(`<title>${TITLE}</title>`);
    expect(html).toContain(`name="description" content="${DESCRIPTION}"`);
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).not.toContain('name="keywords"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain(OG_IMAGE_PATH);
    expect(html).toContain(`property="og:image:alt" content="${ALT_LIGHT}"`);
    expect(html).not.toContain('og-default.jpg');
    expect(html).toContain(ALT_LIGHT);
    expect(html).toContain(ALT_DARK);
    expect(html).toContain('data-theme-src="light"');
    expect(html).toContain('data-theme-src="dark"');
    expect(html).toContain('data-article-feature');
    expect(html).toContain('application/ld+json');
    expect(html).not.toContain('href="/#text=');
    expect(html).not.toContain('i-love-you-copy');

    let cursor = 0;
    for (const heading of headings) {
      const at = html.indexOf(`>${heading}</h2>`, cursor);
      expect(at, heading).toBeGreaterThan(cursor);
      cursor = at;
    }
    const article = html.slice(html.indexOf('<article'), html.lastIndexOf('</article>') + 10);
    expect(article.match(/<h2\b/g)?.length).toBe(headings.length);

    const relatedAt = html.indexOf('>Related Tools</h2>');
    const related = html.slice(relatedAt);
    for (const href of outbound) {
      expect(related, href).toContain(href);
    }
    expect(html).toContain('120 ms');
    expect(html).toContain('420 ms');
    expect(html).toContain('What is Morse code?');
    expect(html).toContain('What does SK mean at the end of a Morse message?');
    const faq = html.slice(html.indexOf('>FAQ</h2>'), html.indexOf('>Related Tools</h2>'));
    expect(faq.match(/<details\b/g)?.length).toBe(10);

    const raw = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    expect(raw).toBeTruthy();
    const blocks = JSON.parse(raw!.replaceAll('\\u003c', '<')) as {
      '@type'?: string;
      image?: string;
      mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
    }[];
    expect(blocks.map((block) => block['@type']).sort()).toEqual(['BreadcrumbList', 'FAQPage', 'WebPage']);
    expect(blocks.some((block) => block['@type'] === 'WebApplication')).toBe(false);
    const page = blocks.find((block) => block['@type'] === 'WebPage');
    const faqLd = blocks.find((block) => block['@type'] === 'FAQPage');
    expect(page?.image).toContain(OG_IMAGE_PATH);
    const details = [...faq.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map(
      (match) => ({
        question: match[1].replace(/<[^>]+>/g, '').trim(),
        answer: match[2].replace(/<[^>]+>/g, '').trim(),
      }),
    );
    expect(details).toHaveLength(10);
    expect(faqLd?.mainEntity?.map((entry) => ({ question: entry.name, answer: entry.acceptedAnswer.text }))).toEqual(
      details,
    );
  });

  it('does not repeat the numbers page or American page sentences', () => {
    const page = readFileSync(resolve('src/pages/how-morse-code-works.astro'), 'utf8');
    expect(page).toContain('single short mark in front of four long ones');
    expect(page).toContain('6 opens on one long mark');
    expect(page).toContain('copied as HOG');
    expect(page).toContain('four-mark rhythm an International operator takes for C');
    expect(page).not.toContain('one dot followed by four dashes');
    expect(page).not.toContain('two dots and three dashes');
    expect(page).not.toContain('five dots and no dashes');
    expect(page).not.toContain('one dash and four dots');
    expect(page).not.toContain('five dashes and no dots');
    expect(page).not.toContain('HOME arriving as HOG');
    expect(page).not.toContain('dash-dot-dash-dot means C');
    expect(page).not.toContain('retraining every working operator');
  });

  it('is linked back from each of the seven related-tools blocks', () => {
    for (const file of reciprocal) {
      const src = readFileSync(resolve(file), 'utf8');
      expect(src, file).toContain('/how-morse-code-works/');
      expect(src.toLowerCase(), file).toContain('how morse code works');
    }
  });
});
