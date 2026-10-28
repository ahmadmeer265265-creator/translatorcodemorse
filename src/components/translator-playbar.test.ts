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

  it('puts a one-word visible caption under Repeat and Flash with the full sentence as the accessible name', async () => {
    const html = await renderTranslator();
    expect(html).not.toContain('playbar-captions');

    const repeatBtnAt = html.indexOf('id="translator-repeat"');
    const repeatCapAt = html.indexOf('data-repeat-caption');
    expect(repeatBtnAt).toBeGreaterThan(-1);
    expect(repeatCapAt).toBeGreaterThan(repeatBtnAt);
    expect(html.slice(repeatBtnAt, repeatCapAt)).toContain(
      'aria-label="Repeat loops the message until you stop it."',
    );
    expect(html.slice(repeatCapAt, repeatCapAt + 400)).toMatch(/>Loop</);

    const flashBtnAt = html.indexOf('data-flash-toggle');
    const flashCapAt = html.indexOf('data-flash-caption');
    expect(flashBtnAt).toBeGreaterThan(-1);
    expect(flashCapAt).toBeGreaterThan(flashBtnAt);
    expect(html.slice(flashBtnAt, flashCapAt)).toContain(
      'aria-label="Flash pulses this dock with each beep."',
    );
    expect(html.slice(flashCapAt, flashCapAt + 400)).toMatch(/>Flash</);
  });
});
