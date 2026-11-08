/**
 * Upload-widget decisions for the image translator.
 * No canvas, no network, no DOM construction. The page script applies these
 * strings and calls prefillTranslatorMorse, which drives the existing
 * Translator listeners instead of decoding Morse itself.
 */
import type { ImageMorseReason, ImageMorseResult, ImagePixels, ImagePolarityMode } from './image-morse';

/** Same MIME list image-morse-file.ts accepts, including the jpeg and bmp aliases. */
export const IMAGE_FILE_ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/x-ms-bmp';

const SUPPORTED_TYPES = new Set(IMAGE_FILE_ACCEPT.split(','));

export function isSupportedImageType(type: string): boolean {
  return SUPPORTED_TYPES.has(type.toLowerCase());
}

export function dropLabel(hasResult: boolean): string {
  return hasResult ? 'Drop another image here, or click to browse' : 'Drop an image here, or click to browse';
}

export const IMAGE_TOO_SMALL_MESSAGE = 'This image is too small to read. Use a larger photo of the Morse code.';

export const IMAGE_TYPE_MESSAGE =
  'That file is not a supported image. Choose a PNG, JPEG, WEBP, GIF, or BMP.';

export const IMAGE_READ_MESSAGE = 'Could not read that image. Try a PNG, JPEG, WEBP, GIF, or BMP.';

export function nothingDetectedMessage(reason: ImageMorseReason | undefined): string {
  switch (reason) {
    case 'ambiguous-bands':
      return 'This image has more than one row of marks, and this tool reads a single row. Crop it down to just the Morse code and try again.';
    case 'no-marks':
      return 'No marks were found in this image.';
    case 'no-foreground':
    case 'no-band':
    case 'noise':
    default:
      return "Couldn't find a clear row of Morse marks in this image. Try a sharper, higher-contrast photo, or crop closer to just the code.";
  }
}

/** Shown under the upload zone. Empty when every mark was confident. */
export function ambiguousNote(count: number): string {
  if (count <= 0) return '';
  if (count === 1) {
    return '1 mark was uncertain, so double-check the Morse below against your image.';
  }
  return `${count} marks were uncertain, so double-check the Morse below against your image.`;
}

export function ambiguousCount(result: ImageMorseResult): number {
  if (result.status !== 'ok') return 0;
  return result.marks.reduce((count, mark) => count + (mark.ambiguous ? 1 : 0), 0);
}

/**
 * One polite live-region string. A clean decode is a single sentence.
 * Uncertain marks add the note. Failures replace it with the reason.
 */
export function imageResultMessage(result: ImageMorseResult): string {
  if (result.status === 'too-small') return IMAGE_TOO_SMALL_MESSAGE;
  if (result.status === 'nothing-detected') return nothingDetectedMessage(result.reason);
  const note = ambiguousNote(ambiguousCount(result));
  return note ? `Morse loaded. ${note}` : 'Morse loaded.';
}

/**
 * Populate the Translator Morse panel the way a #morse= link does, without
 * writing the URL hash.
 *
 * Translator.astro keeps fromMorse() and applyMode() inside its page script.
 * The textarea `input` listener calls fromMorse(), and the Morse-to-Text
 * radio `change` listener calls applyMode(). Setting the value and firing
 * those two events is the direct call. This file does not decode Morse.
 */
export function prefillTranslatorMorse(root: ParentNode, morse: string): boolean {
  const field = root.querySelector('#translator-morse');
  if (!field || !('value' in field) || typeof (field as HTMLTextAreaElement).dispatchEvent !== 'function') {
    return false;
  }
  const area = field as HTMLTextAreaElement;
  area.value = morse;
  area.dispatchEvent(new Event('input', { bubbles: true }));

  const mode = root.querySelector('input[data-mode][value="morse-to-text"]');
  if (mode && 'checked' in mode && !(mode as HTMLInputElement).checked) {
    (mode as HTMLInputElement).checked = true;
    (mode as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (typeof area.focus === 'function') area.focus();
  return true;
}

export type ImageDecodeOptions = { polarity: ImagePolarityMode };

/**
 * Re-run the pure decoder on pixels already in memory.
 * The same object is passed through, so a polarity change does not re-read the file.
 */
export function decodeStoredImage(
  pixels: ImagePixels,
  polarity: ImagePolarityMode,
  decode: (pixels: ImagePixels, options: ImageDecodeOptions) => ImageMorseResult,
): ImageMorseResult {
  return decode(pixels, { polarity });
}
