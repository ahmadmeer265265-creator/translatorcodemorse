import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { primaryNav } from '../../config/nav';
import { machineFaqs } from './machine-faqs';
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
    expect(html).toContain('data-mm-theme-toggle');
    expect(html).toContain('aria-label="Switch to dark theme"');
    expect(html).toContain('Switch to dark theme');
    expect(html).not.toContain('>Light</span>');
    expect(html).not.toContain('>Dark</span>');
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
    expect(html).toContain(`<title>${MACHINE_TITLE.replaceAll('&', '&amp;')}</title>`);
    expect(html).toContain(`content="${MACHINE_DESCRIPTION.replaceAll('&', '&amp;')}"`);
    expect(html.match(/<h1\b/g)?.length).toBe(1);
    expect(html).toContain('>Morse Code Machine</h1>');
    expect(html).toContain('>Morse Code Machine: Free Online Key and Keyer Simulator</h2>');
    expect(html).toContain('href="/american-morse-code-translator/"');
    expect(html).toContain('href="/morse-code-alphabet/"');
    expect(html).toContain('href="/sos-in-morse-code/"');
    expect(html).toContain('href="/morse-code-audio-translator/"');
    expect(html).toContain('>full Morse code alphabet chart</a>');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('og-default.jpg');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"@type":"WebPage"');
    expect(html).toContain('"@type":"FAQPage"');
    for (const item of machineFaqs) expect(html).toContain(item.question);
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav).toContain(MACHINE_PAGE_PATH);
    for (const item of primaryNav) expect(nav).toContain(item.href);
  });

  it('puts every FAQ into JSON-LD word for word', async () => {
    const html = await render(MachinePage);
    const raw = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    expect(raw).toBeTruthy();
    const blocks = JSON.parse(raw!.replaceAll('\\u003c', '<')) as { '@type'?: string; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] }[];
    const faq = blocks.find((block) => block['@type'] === 'FAQPage');
    expect(faq?.mainEntity?.map((entry) => ({ question: entry.name, answer: entry.acceptedAnswer.text }))).toEqual(
      machineFaqs.map((item) => ({ question: item.question, answer: item.answer })),
    );
  });

  it('does not auto-focus the key on load so reload cannot stick a focus ring', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/morse-machine/MorseMachine.astro'), 'utf8');
    expect(src).toContain('setMode(\'key\')');
    expect(src).not.toContain("setMode('key', { focusInput: true })");
    expect(src).toContain('options.focusInput');
    expect(src).toContain("setMode(input.value, { focusInput: true })");
    expect(src).toContain('releaseBootFocus');
    expect(src).toContain("addEventListener('pageshow', releaseBootFocus");
  });

  it('does not steal spacebar from links or page chrome', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/morse-machine/MorseMachine.astro'), 'utf8');
    expect(src).toContain("target.closest('a')");
    expect(src).toContain("target.closest('[data-morse-machine]')");
  });

  it('scopes machine ink so dark-theme labels stay readable', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/morse-machine.css'), 'utf8');
    expect(css).toMatch(/\[data-morse-machine\]\s*\{[^}]*color:\s*var\(--ink\)/s);
    expect(css).toMatch(/\.mm-ref > summary,\s*\n\.mm-settings > summary \{[^}]*color:\s*var\(--ink\)/s);
    expect(css).toContain('.mm-type-field::placeholder');
    expect(css).toContain('caret-color: var(--ink)');
    expect(css).toContain('accent-color: var(--accent)');
    expect(css).toMatch(/\[data-morse-machine\]\s*\{[^}]*accent-color:\s*var\(--accent\)/s);
    expect(css).toMatch(/\[data-morse-machine\] input\[type='radio'\]\s*\{[^}]*appearance:\s*none/s);
    expect(css).toMatch(/\.mm-pad,\s*\n\.mm-paddle-btn \{[^}]*appearance:\s*none/s);
    expect(css).toMatch(/\.mm-btn \{[^}]*appearance:\s*none/s);
    expect(css).toContain("html[data-theme='dark'] [data-morse-machine]");
    expect(css).toContain("html[data-theme='light'] [data-morse-machine]");
    expect(css).toContain("html[data-theme='dark'] [data-morse-machine] .mm-tabs::before");
    expect(css).toContain('background-color: #14110e');
    expect(css).toContain('accent-color: #f0a94e');
    expect(css).toContain('background-color: #f3efe8');
    expect(css).toContain('accent-color: #9a3f06');
  });

  it('syncs machine theme from html data-theme on click, not only on boot', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/morse-machine/MorseMachine.astro'), 'utf8');
    expect(src).toContain('MutationObserver');
    expect(src).toContain("attributeFilter: ['data-theme']");
    expect(src).toContain('syncThemeFromPage');
    expect(src).toContain("querySelector<HTMLButtonElement>('[data-theme-toggle]')");
  });

  it('is linked from an isolated homepage reverse-link block', () => {
    const home = readFileSync(resolve(process.cwd(), 'src/components/HomeArticle.astro'), 'utf8');
    const block = readFileSync(resolve(process.cwd(), 'src/components/MorseMachineBlock.astro'), 'utf8');
    const index = readFileSync(resolve(process.cwd(), 'src/pages/index.astro'), 'utf8');
    expect(home).toContain('MorseMachineBlock');
    expect(block).toContain(MACHINE_PAGE_PATH);
    expect(index).not.toContain(MACHINE_PAGE_PATH);
  });
});
