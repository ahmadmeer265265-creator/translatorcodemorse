import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { draftPageMeta, pageMeta } from '../config/pages';
import { primaryNav } from '../config/nav';
import type { ImageMorseResult, ImagePixels, ImagePolarityMode } from './image-morse';
import {
  IMAGE_FILE_ACCEPT,
  IMAGE_READ_MESSAGE,
  IMAGE_TOO_SMALL_MESSAGE,
  IMAGE_TYPE_MESSAGE,
  ambiguousNote,
  decodeStoredImage,
  dropLabel,
  imageResultMessage,
  isSupportedImageType,
  nothingDetectedMessage,
  prefillTranslatorMorse,
} from './image-translator-ui';

const ok = (marks: ImageMorseResult['marks'] = []): ImageMorseResult => ({
  status: 'ok',
  morse: '... --- ...',
  polarity: 'dark-on-light',
  band: { y0: 1, y1: 4 },
  marks,
});

describe('image result messages', () => {
  it('uses one clear line for each nothing-detected reason', () => {
    expect(nothingDetectedMessage('no-foreground')).toBe(
      "Couldn't find a clear row of Morse marks in this image. Try a sharper, higher-contrast photo, or crop closer to just the code.",
    );
    expect(nothingDetectedMessage('no-band')).toBe(nothingDetectedMessage('no-foreground'));
    expect(nothingDetectedMessage('noise')).toBe(nothingDetectedMessage('no-foreground'));
    expect(nothingDetectedMessage('ambiguous-bands')).toBe(
      'This image has more than one row of marks, and this tool reads a single row. Crop it down to just the Morse code and try again.',
    );
    expect(nothingDetectedMessage('no-marks')).toBe('No marks were found in this image.');
  });

  it('says the image is too small, and stays quiet when no mark is uncertain', () => {
    expect(imageResultMessage({ ...ok(), status: 'too-small', morse: '', band: null, marks: [] })).toBe(
      IMAGE_TOO_SMALL_MESSAGE,
    );
    expect(imageResultMessage(ok())).toBe('Morse loaded.');
    expect(ambiguousNote(0)).toBe('');
  });

  it('names the uncertain-mark count because the Morse box is a plain textarea', () => {
    const one = ok([{ index: 0, symbol: '-', width: 20, ratio: 2, ambiguous: true }]);
    const three = ok([
      { index: 0, symbol: '.', width: 10, ratio: 1, ambiguous: false },
      { index: 1, symbol: '-', width: 20, ratio: 2, ambiguous: true },
      { index: 2, symbol: '-', width: 21, ratio: 2.1, ambiguous: true },
      { index: 3, symbol: '-', width: 22, ratio: 2.2, ambiguous: true },
    ]);
    expect(imageResultMessage(one)).toBe(
      'Morse loaded. 1 mark was uncertain, so double-check the Morse below against your image.',
    );
    expect(imageResultMessage(three)).toBe(
      'Morse loaded. 3 marks were uncertain, so double-check the Morse below against your image.',
    );
  });
});

describe('Translator prefill', () => {
  function harness(modeChecked = false) {
    const events: string[] = [];
    const field = {
      value: '',
      focus() {
        events.push('focus');
      },
      dispatchEvent(event: Event) {
        events.push(`input:${event.type}:${this.value}`);
        return true;
      },
    };
    const mode = {
      checked: modeChecked,
      dispatchEvent(event: Event) {
        events.push(`change:${event.type}:${this.checked}`);
        return true;
      },
    };
    const root = {
      querySelector(selector: string) {
        if (selector === '#translator-morse') return field;
        if (selector === 'input[data-mode][value="morse-to-text"]') return mode;
        return null;
      },
    };
    return { events, field, mode, root: root as unknown as ParentNode };
  }

  it('writes the Morse field and fires input, then selects Morse to Text', () => {
    const { events, field, mode, root } = harness(false);
    expect(prefillTranslatorMorse(root, '... --- ...')).toBe(true);
    expect(field.value).toBe('... --- ...');
    expect(events[0]).toBe('input:input:... --- ...');
    expect(mode.checked).toBe(true);
    expect(events).toContain('change:change:true');
    expect(events.at(-1)).toBe('focus');
    expect(events.join(' ')).not.toContain('hash');
  });

  it('does not re-fire the mode change when Morse to Text is already selected', () => {
    const { events, root } = harness(true);
    prefillTranslatorMorse(root, '-');
    expect(events.some((event) => event.startsWith('change:'))).toBe(false);
    expect(events[0]).toBe('input:input:-');
  });
});

describe('polarity re-decode', () => {
  it('runs the decoder again on the same pixels and does not ask for a new image', () => {
    const pixels = { data: new Uint8ClampedArray(16), width: 4, height: 1 } satisfies ImagePixels;
    const seen: ImagePixels[] = [];
    const polarities: ImagePolarityMode[] = [];
    const decode = (next: ImagePixels, options: { polarity: ImagePolarityMode }): ImageMorseResult => {
      seen.push(next);
      polarities.push(options.polarity);
      return ok();
    };

    decodeStoredImage(pixels, 'auto', decode);
    decodeStoredImage(pixels, 'light-on-dark', decode);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(pixels);
    expect(seen[1]).toBe(pixels);
    expect(polarities).toEqual(['auto', 'light-on-dark']);
  });
});

describe('upload contract', () => {
  it('accepts the Stage 1 MIME list and offers another image after a result', () => {
    expect(IMAGE_FILE_ACCEPT).toBe(
      'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/x-ms-bmp',
    );
    expect(isSupportedImageType('image/jpeg')).toBe(true);
    expect(isSupportedImageType('image/jpg')).toBe(true);
    expect(isSupportedImageType('image/x-ms-bmp')).toBe(true);
    expect(isSupportedImageType('image/svg+xml')).toBe(false);
    expect(dropLabel(false)).toBe('Drop an image here, or click to browse');
    expect(dropLabel(true)).toBe('Drop another image here, or click to browse');
    expect(IMAGE_TYPE_MESSAGE).toContain('PNG, JPEG, WEBP, GIF, or BMP');
    expect(IMAGE_READ_MESSAGE).toContain('Could not read');
  });

  it('is absent from the nav, the sitemap allowlist, and the homepage article', () => {
    expect(pageMeta.some((page) => page.path === '/morse-code-image-translator/')).toBe(false);
    expect(draftPageMeta.some((page) => page.path === '/morse-code-image-translator/')).toBe(true);
    expect(primaryNav.some((item) => item.href === '/morse-code-image-translator/')).toBe(false);
    const home = readFileSync(new URL('../components/HomeArticle.astro', import.meta.url), 'utf8');
    const nav = readFileSync(new URL('../config/nav.ts', import.meta.url), 'utf8');
    expect(home).not.toContain('morse-code-image-translator');
    expect(nav).not.toContain('morse-code-image-translator');
  });

  it('makes no network request in the upload UI or the file wrapper', () => {
    const files = [
      '../lib/image-translator-ui.ts',
      '../lib/image-morse-file.ts',
      '../lib/image-morse.ts',
      '../components/image-translator/ImageTranslator.astro',
      '../pages/morse-code-image-translator.astro',
    ];
    const source = files
      .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/\bnew WebSocket\b/);
    expect(source).not.toMatch(/\bWebSocket\s*\(/);
  });
});
