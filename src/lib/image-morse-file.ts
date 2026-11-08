/**
 * Browser-only bridge from a local File/Blob to decodeImage.
 *
 * Not unit-tested: Vitest has no real canvas. Verify with a real image once
 * the upload UI exists.
 *
 * GIF: createImageBitmap decodes the first frame only. Later frames are ignored.
 * Network: this file never calls fetch, XHR, or a web socket. createImageBitmap
 * reads the blob's own bytes. The downscale is a local canvas drawImage.
 */
import {
  decodeImage,
  IMAGE_MORSE_MAX_WIDTH,
  type DecodeImageOptions,
  type ImageMorseResult,
  type ImagePixels,
} from './image-morse';

export { IMAGE_MORSE_MAX_WIDTH };

/**
 * Cap the width at 2000px.
 * The classifier only needs width ratios, and those survive a uniform scale.
 * 2000px still leaves a typical one-line message at well above the 3px unit
 * where raster dots and dashes start to collide, and it cuts a 4000–8000px
 * phone photo down before the pixel loops run. Height follows the aspect ratio
 * (a portrait frame stays taller than 2000; that is still one line of Morse).
 */
const MAX_WIDTH = IMAGE_MORSE_MAX_WIDTH;

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-ms-bmp',
]);

export class UnsupportedImageTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported image type: ${type || 'unknown'}`);
    this.name = 'UnsupportedImageTypeError';
  }
}

/**
 * Decode a local image file to pixels, downscaling wide photos first.
 * Returns the ImageData-shaped buffer so a later polarity change can call
 * decodeImage again without reading the file a second time.
 */
export async function imageFileToPixels(file: Blob): Promise<ImagePixels> {
  const type = file.type.toLowerCase();
  if (!ALLOWED_TYPES.has(type)) throw new UnsupportedImageTypeError(file.type);

  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new Error('imageFileToPixels needs a browser canvas');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not read pixels from the image');
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}

export async function decodeImageFile(file: Blob, options: DecodeImageOptions = {}): Promise<ImageMorseResult> {
  return decodeImage(await imageFileToPixels(file), options);
}
