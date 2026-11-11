/**
 * Static HTML contract for the American Morse translator page.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { primaryNav } from '../../config/nav';
import { AMERICAN_PAGE_PATH } from '../../lib/american-translator-ui';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import AmericanTranslator from './AmericanTranslator.astro';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import AmericanPage from '../../pages/american-morse-code-translator.astro';

async function render(component: unknown): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(component as never);
}

describe('American Morse translator markup', () => {
  it('offers both directions and the two special dash keys', async () => {
    const html = await render(AmericanTranslator);
    expect(html).toContain('for="am-text"');
    expect(html).toContain('id="am-text"');
    expect(html).toContain('for="am-morse"');
    expect(html).toContain('id="am-morse"');
    expect(html).toContain('data-insert="="');
    expect(html).toContain('>L long dash</button>');
    expect(html).toContain('data-insert="_"');
    expect(html).toContain('>0 extra-long dash</button>');
    expect(html).toContain('aria-label="Insert a dash that is not on the keyboard"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Start listening');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('accept=".wav,.mp3,.ogg,audio/wav,audio/mpeg,audio/ogg"');
    expect(html).toContain('Heard as text');
    expect(html).toContain('readonly');
    expect(html).not.toContain('application/ld+json');
    expect(html).toContain('>Play</button>');
    expect(html).toContain('>Stop</button>');
    expect(html).toContain('Telegraph sounder');
    expect(html).toContain('CW tone');
    expect(html).toContain('data-lamp');
    expect(html).toContain('The light follows CW tone only.');
    expect(html).toContain('for="am-speed"');
    expect(html).toContain('>Speed</span>');
    expect(html).toContain('for="am-volume"');
    expect(html).toContain('for="am-pitch"');
    expect(html).toContain('disabled');
    expect(html).toContain('for="am-sensitivity"');
    expect(html).toContain('Microphone pickup');
    expect(html).toContain('aria-label="Input mode"');
    expect(html).toContain('>Type</span>');
    expect(html).toContain('>Listen</span>');
    expect(html).toContain('>Playback settings</summary>');
    expect(html).toContain('>Listening settings</summary>');
    expect(html).not.toContain('<details open');
    expect(html).not.toContain('WPM');
  });
});

describe('American Morse page', () => {
  it('is a titled page with one heading and no schema block', async () => {
    const html = await render(AmericanPage);
    expect(html).toContain('<title>American Morse Code Translator</title>');
    expect(html).toContain('content="index, follow"');
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain('>American Morse Code Translator</h1>');
    const description = html.match(/name="description" content="([^"]*)"/)?.[1] ?? '';
    expect([...description].length).toBeGreaterThanOrEqual(140);
    expect([...description].length).toBeLessThanOrEqual(155);
    expect(html).not.toContain('application/ld+json');
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav).not.toContain(AMERICAN_PAGE_PATH);
    for (const item of primaryNav) expect(nav).toContain(item.href);
  });
});
