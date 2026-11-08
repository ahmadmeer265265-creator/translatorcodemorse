/**
 * Static HTML contract for the image upload page.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import ImageTranslator from './ImageTranslator.astro';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import ImagePage from '../../pages/morse-code-image-translator.astro';

async function render(component: unknown): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(component as never);
}

describe('image translator markup', () => {
  it('exposes a keyboard button, the Stage 1 file types, and a live result line', async () => {
    const html = await render(ImageTranslator);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Upload a photo of Morse code"');
    expect(html).toContain('aria-describedby="image-translator-hint"');
    expect(html).toContain(
      'accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/x-ms-bmp"',
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('id="translator-morse"');
    expect(html).toContain('<textarea');
    expect(html).not.toContain('contenteditable');
  });

  it('keeps Marks look out of the way until a decode, with Auto selected', async () => {
    const html = await render(ImageTranslator);
    const fieldset = html.slice(html.indexOf('data-marks-look'), html.indexOf('</fieldset>'));
    expect(fieldset).toContain('hidden');
    expect(fieldset).toContain('Marks look');
    expect(fieldset).toContain('value="auto"');
    expect(fieldset).toContain('checked');
    expect(fieldset).toContain('Dark on light');
    expect(fieldset).toContain('Light on dark');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Marks look"');
  });

  it('is noindex and does not add a second homepage-style article', async () => {
    const html = await render(ImagePage);
    expect(html).toContain('content="noindex,follow"');
    expect(html).toContain('<h1');
    expect(html).toContain('Morse Code Image Translator');
    expect(html).not.toContain('Frequently Asked Questions');
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav).not.toContain('/morse-code-image-translator/');
  });
});
