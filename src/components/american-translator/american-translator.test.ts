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
    expect(html).toContain('data-phase="stopped"');
    expect(html).toContain('>Play</span>');
    expect(html).toContain('>Stop</span>');
    expect(html).toContain('>Download</span>');
    expect(html).toContain('data-download');
    expect(html.indexOf('data-play')).toBeLessThan(html.indexOf('data-stop'));
    expect(html.indexOf('data-stop')).toBeLessThan(html.indexOf('data-download'));
    expect(html).toContain('Telegraph sounder');
    expect(html).toContain('CW tone');
    expect(html).toContain('data-playbar');
    expect(html).toContain('data-flash-lit="false"');
    expect(html).not.toContain('data-lamp');
    expect(html).toContain('Not suitable for people sensitive to flashing lights.');
    const settingsAt = html.indexOf('>Playback settings</summary>');
    const warningAt = html.indexOf('Not suitable for people sensitive to flashing lights.');
    const listenAt = html.indexOf('>Listening settings</summary>');
    expect(warningAt).toBeGreaterThan(settingsAt);
    expect(listenAt).toBeGreaterThan(warningAt);
    expect(html.indexOf('data-copy="text"')).toBeLessThan(html.indexOf('id="am-morse"'));
    expect(html.indexOf('data-random')).toBeLessThan(html.indexOf('data-insert="="'));
    expect(html.indexOf('data-insert="_"')).toBeLessThan(html.indexOf('data-play'));
    expect(html).toContain('aria-label="Copy text"');
    expect(html).toContain('aria-label="Copy Morse code"');
    expect(html).toContain('data-clear');
    expect(html).toContain('>Clear</button>');
    expect(html).toContain('data-random');
    expect(html).toContain('>Random example</button>');
    expect(html).toContain('data-share-copy');
    expect(html).toContain('>Copy share link</button>');
    expect(html).toContain('data-share');
    expect(html).toContain('>Share</button>');
    expect(html).toContain('data-puzzle');
    expect(html).toContain('>Copy puzzle link</button>');
    expect(html).toContain('data-reveal');
    expect(html).toContain('>Show text</button>');
    expect(html).toContain('data-swap');
    expect(html).toContain('>Swap</span>');
    expect(html).toContain('href="#american-morse-chart"');
    expect(html).toContain('Full character chart');
    expect(html).not.toContain('Export TXT');
    expect(html).toContain('No sound on iPhone? Turn off silent mode.');
    expect(html).toContain('id="am-waveform"');
    expect(html).toContain('value="sine" selected');
    expect(html).toContain('value="square"');
    expect(html).toContain('Waveform applies to CW tone only.');
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
  it('is a titled page with schema, one heading, and a nav link', async () => {
    const html = await render(AmericanPage);
    expect(html).toContain('<title>American Morse Code Translator</title>');
    expect(html).toContain('content="index, follow"');
    expect(html).not.toContain('name="keywords"');
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain('>American Morse Code Translator</h1>');
    const description = html.match(/name="description" content="([^"]*)"/)?.[1] ?? '';
    expect([...description].length).toBeGreaterThanOrEqual(140);
    expect([...description].length).toBeLessThanOrEqual(155);
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"WebPage"');
    expect(html).toContain('og-default.jpg');
    expect(html).toContain('href="/"');
    expect(html).toContain('.......-..');
    expect(html).toContain('. ...');
    expect(html).toContain('... ..');
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav).toContain(AMERICAN_PAGE_PATH);
    for (const item of primaryNav) expect(nav).toContain(item.href);
  });
});
