import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { encode } from './morse';
import { draftPageMeta, pageMeta } from '../config/pages';
import { headerToolsNav, headerTopNav, primaryNav } from '../config/nav';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import LovePage from '../pages/i-love-you-in-morse-code.astro';

const PATH = '/i-love-you-in-morse-code/';
const PHRASE = '.. / .-.. --- ...- . / -.-- --- ..-';

const reciprocal = [
  { file: 'src/components/HomeArticle.astro', text: 'I love you in Morse code' },
  { file: 'src/pages/morse-code-alphabet.astro', text: 'I love you in Morse code' },
  { file: 'src/pages/morse-code-numbers.astro', text: 'I love you in Morse code' },
  { file: 'src/pages/sos-in-morse-code.astro', text: 'I love you in Morse code' },
  { file: 'src/pages/morse-code-audio-translator.astro', text: 'I love you in Morse code' },
  { file: 'src/components/morse-machine/MorseArticle.astro', text: 'I Love You in Morse Code' },
] as const;

const OG_IMAGE_PATH = '/i-love-you-in-morse-code-featured.webp';
const OG_IMAGE_ALT =
  'Illustration of Morse code dots and dashes arranged into a heart on a warm cream background';
const TITLE = 'I Love You in Morse Code: ILY, 143, and How to Send It';
const DESCRIPTION =
  'I love you in Morse code, letter by letter: the full International Morse phrase, ILY, 143, bead counts for jewelry, and how to send it by light or tap.';

describe('I love you in Morse code page', () => {
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

  it('encodes the headline phrase the way the translator does', () => {
    expect(encode('I LOVE YOU').output).toBe(PHRASE);
    expect(encode('ILY').output).toBe('.. .-.. -.--');
    expect(encode('LOVE').output).toBe('.-.. --- ...- .');
    expect(encode('I LOVE YOU TOO').output).toBe('.. / .-.. --- ...- . / -.-- --- ..- / - --- ---');
    expect(encode('I LOVE YOU I MISS YOU').output).toBe(
      '.. / .-.. --- ...- . / -.-- --- ..- / .. / -- .. ... ... / -.-- --- ..-',
    );
    expect(encode('I LOVE YOU FOREVER').output).toBe(
      '.. / .-.. --- ...- . / -.-- --- ..- / ..-. --- .-. . ...- . .-.',
    );
    expect(encode('143').output).toBe('.---- ....- ...--');
    expect(encode('1437').output).toBe('.---- ....- ...-- --...');
    expect(encode('637').output).toBe('-.... ...-- --...');
    expect(encode('459').output).toBe('....- ..... ----.');
    expect(PHRASE.length).toBe(35);
  });

  it('renders the ten sections, copy link, and no unverified audio claims', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(LovePage as never);
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain('>I Love You in Morse Code</h1>');
    expect(html).toContain(`<title>${TITLE}</title>`);
    expect(html).toContain(`name="description" content="${DESCRIPTION}"`);
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).not.toContain('name="keywords"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain(OG_IMAGE_PATH);
    expect(html).toContain(`property="og:image:alt" content="${OG_IMAGE_ALT}"`);
    expect(html).not.toContain('og-default.jpg');
    expect(html).toContain(OG_IMAGE_ALT);
    expect(html).toContain('What Is “I Love You” in Morse Code?');
    expect(html).toContain('Quick Facts');
    expect(html).toContain('Romantic Phrase Variants');
    expect(html).toContain('Why So Many Charts Are Wrong');
    expect(html).toContain('Secret History of Morse Code Love Letters');
    expect(html).toContain('Jewelry, Tattoos &amp; Gifts (With the Exact Bead Count)');
    expect(html).toContain('How to Send It Yourself');
    expect(html).toContain('Practice Sending It');
    expect(html).toContain('>FAQ</h2>');
    expect(html).toContain('Related Tools');
    expect(html).toContain(PHRASE);
    expect(html).toContain('href="/#text=I%20LOVE%20YOU"');
    expect(html).toContain('Type I LOVE YOU in the Morse code translator');
    expect(html).toContain('You can type it into the translator at the top of this page and copy the exact code');
    expect(html).toContain('generate the code here, then say the rhythm out loud to yourself');
    expect(html).toContain('Learn the rhythm first. Read through the pattern');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/morse-code-machine/"');
    expect(html).toContain('href="/morse-code-audio-translator/"');
    expect(html).toContain('href="/morse-code-alphabet/"');
    expect(html).toContain('href="/morse-code-numbers/"');
    expect(html).toContain('href="/sos-in-morse-code/"');
    expect(html.toLowerCase()).not.toContain('downloadable audio');
    expect(html.toLowerCase()).not.toContain('shareable link');
    expect(html.toLowerCase()).not.toContain('shareable pre-decoded');
  });

  it('puts every FAQ into JSON-LD word for word, without WebApplication schema', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(LovePage as never);
    const raw = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    expect(raw).toBeTruthy();
    const blocks = JSON.parse(raw!.replaceAll('\\u003c', '<')) as {
      '@type'?: string;
      image?: string;
      mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
    }[];
    expect(blocks.map((block) => block['@type']).sort()).toEqual(['BreadcrumbList', 'FAQPage', 'WebPage']);
    const page = blocks.find((block) => block['@type'] === 'WebPage');
    const faq = blocks.find((block) => block['@type'] === 'FAQPage');
    expect(page?.image).toContain(OG_IMAGE_PATH);
    const faqHtml = html.match(/<section class="cv cv-faq[\s\S]*?<\/section>/)?.[0] ?? '';
    const details = [...faqHtml.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map(
      (match) => ({
        question: match[1].replace(/<[^>]+>/g, '').trim(),
        answer: match[2].replace(/<[^>]+>/g, '').trim(),
      }),
    );
    expect(details).toHaveLength(8);
    expect(faq?.mainEntity?.map((entry) => ({ question: entry.name, answer: entry.acceptedAnswer.text }))).toEqual(
      details,
    );
  });

  it('adds one reciprocal related-tools link from each of the six destinations', () => {
    for (const item of reciprocal) {
      const src = readFileSync(resolve(item.file), 'utf8');
      expect(src, item.file).toContain('/i-love-you-in-morse-code/');
      expect(src, item.file).toContain(item.text);
    }
  });
});
