import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeImage, IMAGE_MORSE_BUDGET_MS, type ImagePixels } from './image-morse';
import { AMBIGUITY_BAND, DASH_RATIO } from './morse-runs';
import { encode } from './morse';

type RGBA = [number, number, number, number];

const PAPER: RGBA = [255, 255, 255, 255];
const INK: RGBA = [0, 0, 0, 255];

function makeImage(width: number, height: number, fill: RGBA = PAPER): ImagePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return { data, width, height };
}

function fillRect(image: ImagePixels, x: number, y: number, w: number, h: number, color: RGBA) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(image.width, x + w);
  const y1 = Math.min(image.height, y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const i = (yy * image.width + xx) * 4;
      image.data[i] = color[0];
      image.data[i + 1] = color[1];
      image.data[i + 2] = color[2];
      image.data[i + 3] = color[3];
    }
  }
}

function fillCircle(image: ImagePixels, cx: number, cy: number, r: number, color: RGBA) {
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(image.height, Math.ceil(cy + r));
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(image.width, Math.ceil(cx + r));
  const r2 = r * r;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = (y * image.width + x) * 4;
        image.data[i] = color[0];
        image.data[i + 1] = color[1];
        image.data[i + 2] = color[2];
        image.data[i + 3] = color[3];
      }
    }
  }
}

/**
 * Draw an encoded Morse string as solid bars.
 * Dot = 1 unit wide, dash = 3, intra gap = 1, letter gap = 3, word gap = 7.
 */
function paintMorse(
  morse: string,
  unit: number,
  options: {
    polarity?: 'dark-on-light' | 'light-on-dark';
    marginX?: number;
    marginY?: number;
    stroke?: number;
  } = {},
): ImagePixels {
  const marginX = options.marginX ?? unit * 2;
  const stroke = options.stroke ?? unit;
  const marginY = options.marginY ?? unit * 2;
  const words = morse.split(' / ').filter((word) => word.length > 0);
  let content = 0;
  for (let w = 0; w < words.length; w += 1) {
    const letters = words[w]!.split(' ').filter((letter) => letter.length > 0);
    for (let i = 0; i < letters.length; i += 1) {
      const code = letters[i]!;
      for (let k = 0; k < code.length; k += 1) {
        content += code[k] === '-' ? unit * 3 : unit;
        if (k < code.length - 1) content += unit;
      }
      if (i < letters.length - 1) content += unit * 3;
    }
    if (w < words.length - 1) content += unit * 7;
  }

  const paper = options.polarity === 'light-on-dark' ? INK : PAPER;
  const ink = options.polarity === 'light-on-dark' ? PAPER : INK;
  const image = makeImage(content + marginX * 2, stroke + marginY * 2, paper);
  let x = marginX;
  const y = marginY;
  for (let w = 0; w < words.length; w += 1) {
    const letters = words[w]!.split(' ').filter((letter) => letter.length > 0);
    for (let i = 0; i < letters.length; i += 1) {
      const code = letters[i]!;
      for (let k = 0; k < code.length; k += 1) {
        const width = code[k] === '-' ? unit * 3 : unit;
        fillRect(image, x, y, width, stroke, ink);
        x += width;
        if (k < code.length - 1) x += unit;
      }
      if (i < letters.length - 1) x += unit * 3;
    }
    if (w < words.length - 1) x += unit * 7;
  }
  return image;
}

function blurHorizontal(image: ImagePixels, radius: number): ImagePixels {
  const out = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const xx = x + dx;
        if (xx < 0 || xx >= image.width) continue;
        const i = (y * image.width + xx) * 4;
        r += image.data[i]!;
        g += image.data[i + 1]!;
        b += image.data[i + 2]!;
        a += image.data[i + 3]!;
        n += 1;
      }
      const o = (y * image.width + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = a / n;
    }
  }
  return { data: out, width: image.width, height: image.height };
}

const messages = ['SOS', 'PARIS', 'HELLO WORLD'] as const;

describe('clean dark-on-light decode', () => {
  for (const text of messages) {
    it(`decodes ${text}`, () => {
      const morse = encode(text).output;
      const result = decodeImage(paintMorse(morse, 8));
      expect(result.status).toBe('ok');
      expect(result.morse).toBe(morse);
      expect(result.polarity).toBe('dark-on-light');
      expect(result.marks.every((mark) => mark.ambiguous === false)).toBe(true);
    });
  }
});

describe('light-on-dark and manual polarity', () => {
  for (const text of messages) {
    it(`auto-detects light-on-dark for ${text}`, () => {
      const morse = encode(text).output;
      const image = paintMorse(morse, 8, { polarity: 'light-on-dark' });
      const auto = decodeImage(image);
      const forced = decodeImage(image, { polarity: 'light-on-dark' });
      expect(auto.polarity).toBe('light-on-dark');
      expect(auto.morse).toBe(morse);
      expect(forced.morse).toBe(morse);
    });
  }

  it('explicit dark-on-light override matches auto on a normal light page', () => {
    const morse = encode('SOS').output;
    const image = paintMorse(morse, 8);
    expect(decodeImage(image, { polarity: 'dark-on-light' }).morse).toBe(morse);
  });

  it('override recovers a page whose black corners fool auto polarity', () => {
    const morse = encode('SOS').output;
    const image = paintMorse(morse, 8, { marginX: 24, marginY: 20 });
    fillRect(image, 0, 0, 8, 8, INK);
    fillRect(image, image.width - 8, 0, 8, 8, INK);
    fillRect(image, 0, image.height - 8, 8, 8, INK);
    fillRect(image, image.width - 8, image.height - 8, 8, 8, INK);

    const auto = decodeImage(image);
    const forced = decodeImage(image, { polarity: 'dark-on-light' });
    expect(auto.polarity).toBe('light-on-dark');
    expect(auto.morse).not.toBe(morse);
    expect(forced.polarity).toBe('dark-on-light');
    expect(forced.morse).toBe(morse);
  });
});

describe('scale, margin, and blur', () => {
  it('decodes the same message at 3px and 30px units', () => {
    const morse = encode('HELLO WORLD').output;
    const small = decodeImage(paintMorse(morse, 3));
    const large = decodeImage(paintMorse(morse, 30));
    expect(small.morse).toBe(morse);
    expect(large.morse).toBe(morse);
  });

  it('ignores blank margin and speckles outside the mark band', () => {
    const morse = encode('PARIS').output;
    const image = paintMorse(morse, 6, { marginX: 30, marginY: 18 });
    let seed = 9;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let n = 0; n < 24; n += 1) {
      const x = next() % image.width;
      const y = next() % 10;
      fillRect(image, x, y, 1, 1, INK);
      fillRect(image, x, image.height - 1 - (next() % 10), 1, 1, INK);
    }
    expect(decodeImage(image).morse).toBe(morse);
  });

  it('survives a 1px horizontal blur and breaks once the blur closes the gaps', () => {
    const morse = encode('SOS').output;
    const unit = 12;
    const sharp = paintMorse(morse, unit, { marginX: 16, marginY: 8 });
    expect(decodeImage(blurHorizontal(sharp, 1)).morse).toBe(morse);
    // Radius equal to the unit fills the 1-unit intra gaps, so neighbours merge.
    expect(decodeImage(blurHorizontal(sharp, unit)).morse).not.toBe(morse);
  });
});

describe('ambiguity flag', () => {
  it('flags a mark sitting on the dot/dash boundary and still returns the nearest class', () => {
    const unit = 10;
    const image = makeImage(unit * 12, unit * 4);
    // dot (1u), boundary mark (2u), clear dash (3u), intra gaps of 1u
    fillRect(image, unit, unit, unit, unit, INK);
    fillRect(image, unit * 3, unit, unit * 2, unit, INK);
    fillRect(image, unit * 6, unit, unit * 3, unit, INK);

    const result = decodeImage(image);
    expect(result.status).toBe('ok');
    expect(result.morse).toBe('.--');
    expect(result.marks.map((mark) => mark.ambiguous)).toEqual([false, true, false]);
    expect(result.marks[1]!.symbol).toBe('-');
    expect(Math.abs(result.marks[1]!.ratio - DASH_RATIO)).toBeLessThanOrEqual(AMBIGUITY_BAND);
    expect(result.marks[0]!.ambiguous).toBe(false);
    expect(result.marks[2]!.ambiguous).toBe(false);
  });
});

describe('printed glyphs and unimodal fallback', () => {
  it('reads circular dots and thinner dashes without a separate print mode', () => {
    const morse = encode('SOS').output;
    const unit = 16;
    const margin = 20;
    const letters = morse.split(' ');
    let content = 0;
    for (let i = 0; i < letters.length; i += 1) {
      const letter = letters[i]!;
      for (let k = 0; k < letter.length; k += 1) {
        content += letter[k] === '-' ? unit * 3 : unit;
        if (k < letter.length - 1) content += unit;
      }
      if (i < letters.length - 1) content += unit * 3;
    }
    const image = makeImage(content + margin * 2, unit + margin * 2);
    let x = margin;
    const mid = image.height / 2;
    for (let i = 0; i < letters.length; i += 1) {
      const letter = letters[i]!;
      for (let k = 0; k < letter.length; k += 1) {
        if (letter[k] === '.') {
          fillCircle(image, x + unit / 2, mid, unit / 2, INK);
          x += unit;
        } else {
          const dashH = Math.max(2, Math.round(unit * 0.55));
          fillRect(image, x, Math.round(mid - dashH / 2), unit * 3, dashH, INK);
          x += unit * 3;
        }
        if (k < letter.length - 1) x += unit;
      }
      if (i < letters.length - 1) x += unit * 3;
    }
    const result = decodeImage(image);
    expect(result.status).toBe('ok');
    expect(result.morse).toBe(morse);
  });

  it('classifies an all-dash letter and an all-dot letter by stroke height', () => {
    expect(decodeImage(paintMorse(encode('T').output, 8)).morse).toBe('-');
    expect(decodeImage(paintMorse(encode('M').output, 8)).morse).toBe('--');
    expect(decodeImage(paintMorse(encode('O').output, 8)).morse).toBe('---');
    expect(decodeImage(paintMorse(encode('5').output, 8)).morse).toBe('.....');
  });
});

describe('empty, tiny, and competing bands', () => {
  it('returns nothing-detected for a blank image', () => {
    const result = decodeImage(makeImage(80, 40));
    expect(result.status).toBe('nothing-detected');
    expect(result.morse).toBe('');
    expect(result.marks).toEqual([]);
    expect(result.band).toBeNull();
    expect(result.reason).toBe('no-foreground');
  });

  it('returns nothing-detected for salt-and-pepper noise', () => {
    const image = makeImage(96, 48);
    let seed = 4;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const on = seed % 2 === 0;
      image.data[i] = on ? 0 : 255;
      image.data[i + 1] = on ? 0 : 255;
      image.data[i + 2] = on ? 0 : 255;
      image.data[i + 3] = 255;
    }
    const result = decodeImage(image);
    expect(result.status).toBe('nothing-detected');
    expect(result.morse).toBe('');
  });

  it('returns nothing-detected when two Morse lines are equally strong', () => {
    const line = paintMorse(encode('SOS').output, 6, { marginX: 8, marginY: 4 });
    const gap = 10;
    const image = makeImage(line.width, line.height * 2 + gap);
    image.data.set(line.data, 0);
    image.data.set(line.data, (line.height + gap) * line.width * 4);
    const result = decodeImage(image);
    expect(result.status).toBe('nothing-detected');
    expect(result.reason).toBe('ambiguous-bands');
    expect(result.morse).toBe('');
  });

  it('does not throw on a 1×1 or 2×2 image', () => {
    for (const size of [1, 2]) {
      const result = decodeImage(makeImage(size, size, INK));
      expect(result.status).toBe('too-small');
      expect(result.reason).toBe('too-small');
      expect(result.morse).toBe('');
      expect(result.polarity).toBeNull();
    }
  });
});

describe('large-image budget', () => {
  it(`decodes a 4000px-wide line in under ${IMAGE_MORSE_BUDGET_MS}ms`, () => {
    const text = Array.from({ length: 40 }, () => 'SOS').join(' ');
    const morse = encode(text).output;
    const image = paintMorse(morse, 4, { marginX: 12, marginY: 80 });
    expect(image.width).toBeGreaterThan(4000);
    const started = performance.now();
    const result = decodeImage(image);
    const elapsed = performance.now() - started;
    console.log(`image-morse ${image.width}x${image.height} ${elapsed.toFixed(1)}ms`);
    expect(result.status).toBe('ok');
    expect(result.morse.startsWith('... --- ...')).toBe(true);
    expect(elapsed).toBeLessThan(IMAGE_MORSE_BUDGET_MS);
  });
});

describe('engine stays local', () => {
  it('has no fetch, XHR, or WebSocket in the image decoder or the file wrapper', () => {
    const decoder = readFileSync(new URL('./image-morse.ts', import.meta.url), 'utf8');
    const wrapper = readFileSync(new URL('./image-morse-file.ts', import.meta.url), 'utf8');
    const source = `${decoder}\n${wrapper}`;
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/\bnew WebSocket\b/);
    expect(source).not.toMatch(/\bWebSocket\s*\(/);
    expect(wrapper).toContain('image/gif');
    expect(wrapper).toContain('image/bmp');
    expect(wrapper).toContain('IMAGE_MORSE_MAX_WIDTH');
  });
});
