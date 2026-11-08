import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { decodeImage } from './image-morse';
import { draftPageMeta, pageMeta } from '../config/pages';
import { primaryNav } from '../config/nav';
import type { ImageMorseResult, ImagePixels, ImagePolarityMode } from './image-morse';
import { sampleFile } from './image-translator-samples';
import {
  CAMERA_DENIED_MESSAGE,
  IMAGE_FILE_ACCEPT,
  IMAGE_READ_MESSAGE,
  IMAGE_TOO_SMALL_MESSAGE,
  IMAGE_TYPE_MESSAGE,
  ambiguousNote,
  cameraButtonVisible,
  cameraErrorMessage,
  decodeStoredImage,
  dropLabel,
  imageFileFromPaste,
  imageResultMessage,
  isSupportedImageType,
  nothingDetectedMessage,
  overlayBoxes,
  overlayClass,
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
    const one = ok([{ index: 0, symbol: '-', x: 4, width: 20, ratio: 2, ambiguous: true }]);
    const three = ok([
      { index: 0, symbol: '.', x: 0, width: 10, ratio: 1, ambiguous: false },
      { index: 1, symbol: '-', x: 14, width: 20, ratio: 2, ambiguous: true },
      { index: 2, symbol: '-', x: 40, width: 21, ratio: 2.1, ambiguous: true },
      { index: 3, symbol: '-', x: 66, width: 22, ratio: 2.2, ambiguous: true },
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
      '../lib/image-translator-samples.ts',
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
    expect(source).not.toMatch(/getUserMedia\([^)]*audio:\s*true/);
  });
});

describe('overlay boxes', () => {
  it('places dot, dash, and uncertain marks as percentages of the image', () => {
    const boxes = overlayBoxes(
      {
        status: 'ok',
        morse: '.-',
        polarity: 'dark-on-light',
        band: { y0: 10, y1: 30 },
        marks: [
          { index: 0, symbol: '.', x: 20, width: 10, ratio: 1, ambiguous: false },
          { index: 1, symbol: '-', x: 40, width: 30, ratio: 3, ambiguous: true },
        ],
      },
      200,
      100,
    );
    expect(boxes).toEqual([
      { left: '10%', top: '10%', width: '5%', height: '20%', kind: 'dot' },
      { left: '20%', top: '10%', width: '15%', height: '20%', kind: 'uncertain' },
    ]);
    expect(overlayClass('dot')).toBe('it-box it-box--dot');
    expect(overlayClass('dash')).toBe('it-box it-box--dash');
    expect(overlayClass('uncertain')).toBe('it-box it-box--uncertain');
  });

  it('draws nothing when the decode found no band', () => {
    expect(
      overlayBoxes(
        { status: 'nothing-detected', morse: '', polarity: 'dark-on-light', band: null, marks: [], reason: 'noise' },
        200,
        100,
      ),
    ).toBeNull();
    expect(
      overlayBoxes(
        { status: 'too-small', morse: '', polarity: null, band: null, marks: [], reason: 'too-small' },
        2,
        2,
      ),
    ).toBeNull();
  });
});

describe('camera, paste, and samples', () => {
  it('hides the camera button unless a secure camera API can ask for a facing mode', () => {
    expect(cameraButtonVisible({ secure: true, getUserMedia: true, facingMode: true })).toBe(true);
    expect(cameraButtonVisible({ secure: true, getUserMedia: false, facingMode: true })).toBe(false);
    expect(cameraButtonVisible({ secure: false, getUserMedia: true, facingMode: true })).toBe(false);
    expect(cameraButtonVisible({ secure: true, getUserMedia: true, facingMode: false })).toBe(false);
    expect(cameraErrorMessage('NotAllowedError')).toBe(CAMERA_DENIED_MESSAGE);
    expect(cameraErrorMessage('NotFoundError')).not.toBe(CAMERA_DENIED_MESSAGE);
  });

  it('decodes an image paste and ignores text or a paste aimed at a field', () => {
    const photo = new File(['png'], 'clip.png', { type: 'image/png' });
    expect(imageFileFromPaste([{ kind: 'file', type: 'image/png', file: photo }], null)).toBe(photo);
    expect(imageFileFromPaste([{ kind: 'string', type: 'text/plain', file: null }], null)).toBeNull();
    expect(
      imageFileFromPaste([{ kind: 'file', type: 'image/png', file: photo }], { closest: () => ({}) }),
    ).toBeNull();
  });

  it('loads the bundled SOS and HELLO samples as PNG files with the same bytes as the assets', async () => {
    const sosAsset = readFileSync(new URL('../assets/image-translator/sample-sos.png', import.meta.url));
    const helloAsset = readFileSync(new URL('../assets/image-translator/sample-hello.png', import.meta.url));
    const sos = sampleFile('sos');
    const hello = sampleFile('hello');
    expect(sos.type).toBe('image/png');
    expect(hello.type).toBe('image/png');
    expect(sos.size).toBe(sosAsset.length);
    expect(hello.size).toBe(helloAsset.length);
    expect(Buffer.from(await sos.arrayBuffer())).toEqual(sosAsset);
    expect(Buffer.from(await hello.arrayBuffer())).toEqual(helloAsset);
    expect(sosAsset.length).toBeLessThan(2000);
    expect(helloAsset.length).toBeLessThan(2000);
    const decoded = async (file: File) => {
      const { data, info } = await sharp(Buffer.from(await file.arrayBuffer())).ensureAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      return decodeImage({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
    };
    expect((await decoded(sos)).morse).toBe('... --- ...');
    expect((await decoded(hello)).morse).toBe('.... . .-.. .-.. ---');
  });
});
