/**
 * Homepage body must link to the audio translator via RelatedPages.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import HomeArticle from './HomeArticle.astro';

const relatedPagesFiles = [
  'src/components/HomeArticle.astro',
  'src/components/american-translator/AmericanArticle.astro',
  'src/components/image-translator/ImageArticle.astro',
  'src/pages/morse-code-audio-translator.astro',
  'src/pages/morse-code-alphabet.astro',
  'src/pages/morse-code-numbers.astro',
  'src/pages/sos-in-morse-code.astro',
];

describe('homepage More Morse tools block', () => {
  it('links once to the Morse code audio translator page', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(HomeArticle);

    const headingAt = html.indexOf('More Morse tools');
    expect(headingAt).toBeGreaterThan(-1);

    const sectionEnd = html.indexOf('</section>', headingAt);
    const block = html.slice(headingAt, sectionEnd);
    expect(block).toContain('href="/morse-code-audio-translator/"');
    expect(block).toMatch(/>\s*Morse code audio translator\s*</);
    expect(block).toContain('Decode Morse audio from a file or your microphone into text.');
    expect(block).toContain('href="/morse-code-machine/"');
    expect(block).toMatch(/>\s*Morse code machine\s*</);
    expect(block).toContain('Send Morse code yourself with a key, paddle, or keyboard.');
    expect(block).toContain('href="/morse-code-alphabet/"');
    expect(block).toContain('href="/morse-code-numbers/"');
    expect(block).toContain('href="/sos-in-morse-code/"');

    const matches = block.match(/href="\/morse-code-audio-translator\/"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('lists Morse code machine in every RelatedPages block, with no self-link on the Machine page', () => {
    for (const file of relatedPagesFiles) {
      const src = readFileSync(resolve(file), 'utf8');
      const start = src.lastIndexOf('<RelatedPages');
      expect(start, file).toBeGreaterThan(-1);
      const block = src.slice(start);
      expect(block, file).toContain("href: '/morse-code-machine/'");
      expect(block, file).toContain("'Morse code machine'");
    }
    const machineArticle = readFileSync(resolve('src/components/morse-machine/MorseArticle.astro'), 'utf8');
    const relatedAt = machineArticle.indexOf('Related Tools');
    expect(relatedAt).toBeGreaterThan(-1);
    expect(machineArticle.slice(relatedAt)).not.toContain('href="/morse-code-machine/"');
  });
});
