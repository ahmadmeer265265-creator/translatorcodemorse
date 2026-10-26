/**
 * Component render tests via the Astro container API: verifies the static
 * HTML contract the wiring scripts and users both rely on (labels, ARIA,
 * defaults, keyboard-reachable real controls).
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
// @ts-expect-error .astro imports are resolved by the Astro Vite plugin
import AudioDecoder from './AudioDecoder.astro';
// @ts-expect-error .astro import
import AudioGenerator from './AudioGenerator.astro';
// @ts-expect-error .astro import
import ResultBox from './ResultBox.astro';

async function render(component: unknown, props?: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(component as never, { props });
}

describe('AudioDecoder component', () => {
  it('renders a labelled 2-option sound source radiogroup', async () => {
    const html = await render(AudioDecoder);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Sound source"');
    expect(html).toContain('Microphone');
    expect(html).toContain('Audio File');
    const radios = html.match(/type="radio"/g) ?? [];
    expect(radios.length).toBe(2);
    expect(html).toContain('value="mic"');
    expect(html).toContain('value="file"');
  });

  it('mic panel: real button, level meter, alert region, privacy note', async () => {
    const html = await render(AudioDecoder);
    expect(html).toContain('data-mic-toggle');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-label="Microphone level"');
    expect(html).toContain('data-mic-error');
    expect((html.match(/role="alert"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('never recorded or sent anywhere');
  });

  it('file panel: dropzone button, hidden file input with accept, starts hidden', async () => {
    const html = await render(AudioDecoder);
    expect(html).toContain('data-panel="file"');
    expect(html).toContain('data-drop');
    expect(html).toContain('type="file"');
    expect(html).toMatch(/accept="[^"]*\.wav[^"]*\.mp3[^"]*\.ogg/);
    expect(html).toContain('aria-label="Choose an audio file"');
    expect(html).toContain('at-source-panels');
    expect(html).toMatch(/data-panel="file"[^>]*inert|inert[^>]*data-panel="file"/);
  });

  it('configuration panel: all 7 controls labelled, AFT checked and Freq disabled', async () => {
    const html = await render(AudioDecoder);
    for (const label of [
      'WPM Rate',
      'Farnsworth WPM',
      'Freq (Hz)',
      'Filter Q',
      'Vol dB Min',
      'Vol dB Max',
      'Automatic Frequency Tracking',
    ]) {
      expect(html).toContain(label);
    }
    // AFT defaults on, so the Freq input starts disabled (Stage 1 contract).
    expect(html).toContain('data-cfg-aft');
    expect(html).toMatch(/data-cfg-freq[^>]*disabled|disabled[^>]*data-cfg-freq/);
    // Collapsed by default (no open attribute on the details element).
    expect(html).not.toMatch(/<details[^>]*open/);
  });

  it('spectrogram canvas + live status + marks + result box are present', async () => {
    const html = await render(AudioDecoder);
    expect(html).toContain('data-spectrogram');
    expect(html).toContain('aria-label="Spectrogram of the incoming audio"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-marks');
    expect(html).toContain('data-output="decode"');
    expect(html).toContain('data-copy="decode"');
    expect(html).toContain('aria-label="Copy translation"');
  });
});

describe('AudioGenerator component', () => {
  it('renders labelled text input and real buttons, disabled until text', async () => {
    const html = await render(AudioGenerator);
    expect(html).toContain('for="at-gen-text"');
    expect(html).toContain('id="at-gen-text"');
    expect(html).toContain('data-gen-play');
    expect(html).toContain('data-gen-stop');
    expect(html).toContain('data-gen-wav');
    expect(html).toContain('data-gen-mp3');
    expect(html).toMatch(/data-gen-play[^>]*disabled|disabled[^>]*data-gen-play/);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="alert"');
  });

  it('renders the four sound sliders with labels and defaults', async () => {
    const html = await render(AudioGenerator);
    for (const label of ['Speed (WPM)', 'Farnsworth (overall speed)', 'Tone (Hz)', 'Volume']) {
      expect(html).toContain(label);
    }
    const ranges = html.match(/type="range"/g) ?? [];
    expect(ranges.length).toBe(4);
    expect(html).toContain('Sound settings');
  });
});

describe('ResultBox component', () => {
  it('renders readonly output wired to its label and a copy button', async () => {
    const html = await render(ResultBox, {
      id: 'x',
      label: 'Translation',
      outputAttr: 'decode',
      copyAttr: 'decode',
    });
    expect(html).toContain('for="x-output"');
    expect(html).toContain('id="x-output"');
    expect(html).toContain('readonly');
    expect(html).toContain('data-output="decode"');
    expect(html).toContain('aria-label="Copy translation"');
    expect(html).toContain('type="button"');
  });
});
