import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { primaryNav } from '../../config/nav';
import { MACHINE_DESCRIPTION, MACHINE_PAGE_PATH, MACHINE_TITLE } from '../../lib/morse-machine-ui';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import MorseMachine from './MorseMachine.astro';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import MachinePage from '../../pages/morse-code-machine.astro';

async function render(component: unknown): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(component as never);
}

describe('Morse Code Machine markup', () => {
  it('wires five input methods, live output, speed, and a collapsed chart', async () => {
    const html = await render(MorseMachine);
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    expect(html).toContain('data-morse-machine');
    expect(html).toContain('aria-label="Input mode"');
    expect(html).toContain('aria-label="Activity"');
    expect(html).toContain('>Key</span>');
    expect(html).toContain('>Type</span>');
    expect(html).toContain('>Paddle</span>');
    expect(html).toContain('>Send</span>');
    expect(html).toContain('Listen &amp; Guess');
    expect(html).toContain('>Morse the Letter</span>');
    expect(html).toContain('data-morse-out');
    expect(html).toContain('data-text-out');
    expect(html).toContain('Tap or hold · Space');
    expect(html).toContain('Spacebar does the same');
    expect(html).toContain('id="mm-type"');
    expect(html).toContain('data-paddle="dot"');
    expect(html).toContain('data-paddle="dash"');
    expect(html).toContain('Dit · J / ←');
    expect(html).toContain('Dah · K / →');
    expect(html).toContain('for="mm-speed"');
    expect(html).toContain('>Speed</span>');
    expect(html).toContain('min="5"');
    expect(html).toContain('max="40"');
    expect(html).toContain('>Sidetone</span>');
    expect(html).toContain('>Volume</span>');
    expect(html).toContain('>Pitch</span>');
    expect(html).toContain('min="400"');
    expect(html).toContain('max="1000"');
    expect(html).toContain('value="600"');
    expect(html).toContain('>Theme</span>');
    expect(html).toContain('>Light</span>');
    expect(html).toContain('>Dark</span>');
    expect(html).toContain('>Settings</summary>');
    expect(html).toContain('>Play again</button>');
    expect(html).toContain('>Next</button>');
    expect(html).toContain('>Check</button>');
    expect(html).toContain('>Character</span>');
    expect(html).toContain('>Word</span>');
    expect(html).toContain('data-activity="send"');
    expect(html).toContain('>Clear</button>');
    expect(html).toContain('>Characters and keybinds</summary>');
    expect(html).not.toContain('<details open');
    expect(html).toContain('href="/morse-code-alphabet/"');
    expect(html).toContain('Full Morse alphabet chart');
    expect(markup).not.toContain('AudioContext');
  });
});

describe('Morse Code Machine page', () => {
  it('is a titled tool page with schema and a nav link', async () => {
    const html = await render(MachinePage);
    expect(html).toContain(`<title>${MACHINE_TITLE}</title>`);
    expect(html).toContain(`content="${MACHINE_DESCRIPTION}"`);
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain(`>${MACHINE_TITLE}</h1>`);
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"WebPage"');
    expect(html).not.toContain('"@type":"FAQPage"');
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav).toContain(MACHINE_PAGE_PATH);
    for (const item of primaryNav) expect(nav).toContain(item.href);
  });

  it('is not linked from the homepage article', () => {
    const home = readFileSync(resolve(process.cwd(), 'src/components/HomeArticle.astro'), 'utf8');
    const index = readFileSync(resolve(process.cwd(), 'src/pages/index.astro'), 'utf8');
    expect(home).not.toContain(MACHINE_PAGE_PATH);
    expect(index).not.toContain(MACHINE_PAGE_PATH);
  });
});
