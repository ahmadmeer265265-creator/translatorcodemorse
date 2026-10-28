/**
 * Static HTML contract for the homepage Text-to-Morse playbar.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import Translator from './Translator.astro';

async function renderTranslator(): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Translator);
}

describe('homepage Translator playbar', () => {
  it('merges Play/Stop into one control and keeps Pause as a separate dock button', async () => {
    const html = await renderTranslator();
    expect(html).toContain('id="translator-play"');
    expect(html).toContain('aria-label="Play"');
    expect(html).toContain('href="#i-play"');
    expect(html).toContain('id="translator-pause"');
    expect(html).not.toContain('id="translator-stop"');
    expect(html).not.toContain('data-stop');
  });

  it('defaults flash on for a fresh visitor (no stored preference in markup)', async () => {
    const html = await renderTranslator();
    const flashAt = html.indexOf('data-flash-toggle');
    expect(flashAt).toBeGreaterThan(-1);
    expect(html.slice(flashAt, flashAt + 280)).toContain('aria-pressed="true"');
  });

  it('captions the Repeat and Flash controls with actual behavior', async () => {
    const html = await renderTranslator();
    expect(html).toContain('Repeat loops the message until you stop it.');
    expect(html).toContain('Flash pulses this dock with each beep.');
  });
});
