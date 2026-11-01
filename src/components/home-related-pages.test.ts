/**
 * Homepage body must link to the audio translator via RelatedPages.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import HomeArticle from './HomeArticle.astro';

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
    expect(block).toContain('href="/morse-code-alphabet/"');
    expect(block).toContain('href="/morse-code-numbers/"');
    expect(block).toContain('href="/sos-in-morse-code/"');

    const matches = block.match(/href="\/morse-code-audio-translator\/"/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});
