import { describe, expect, it } from 'vitest';
import { segmentsFromAmericanMorse } from './american-mic-decode';
import { encode } from './american-morse';
import { pageMeta } from '../config/pages';
import { primaryNav } from '../config/nav';
import {
  AMERICAN_PAGE_PATH,
  MIC_RMS_THRESHOLD,
  EXTRA_LONG_DASH_TOKEN,
  LONG_DASH_TOKEN,
  convertMorse,
  convertText,
  decodePcm,
  fileErrorMessage,
  illegalNotationChars,
  insertToken,
  isAudioFileName,
  micThresholdFor,
  micErrorKind,
  micErrorMessage,
  notationWarning,
  unsupportedWarning,
} from './american-translator-ui';

const pcmFromSegments = (
  segments: ReadonlyArray<{ type: 'mark' | 'space'; durationMs: number }>,
  sampleRate = 8000,
) => {
  const total = segments.reduce((sum, segment) => sum + Math.round((segment.durationMs * sampleRate) / 1000), 0);
  const pcm = new Float32Array(total);
  let index = 0;
  for (const segment of segments) {
    const count = Math.round((segment.durationMs * sampleRate) / 1000);
    if (segment.type === 'mark') pcm.fill(0.8, index, index + count);
    index += count;
  }
  return pcm;
};

describe('typed conversion', () => {
  it('encodes plain text with the Stage 1 notation', () => {
    expect(convertText('SOS').output).toBe(encode('SOS').output);
    expect(convertText('HOME').output).not.toBe(convertText('HOG').output);
    expect(convertText('L0').output).toBe(`${LONG_DASH_TOKEN}/${EXTRA_LONG_DASH_TOKEN}`);
  });

  it('decodes typed Morse, including the Unicode long dashes', () => {
    expect(convertMorse(convertText('HELLO WORLD').output).output).toBe('HELLO WORLD');
    expect(convertMorse('\u2E3A/\u2E3B').output).toBe('L0');
    expect(convertMorse('... ..').output).toBe(';');
    expect(convertMorse('. ...').output).toBe('&');
  });

  it('shows # for characters the engine cannot map', () => {
    const result = convertText('OK😀');
    expect(result.output.endsWith('#')).toBe(true);
    expect(result.unsupported).toEqual(['😀']);
    expect(unsupportedWarning(result.unsupported)).toContain('#');
    expect(convertMorse('.-.-.-')).toEqual({ output: '#', unknown: 1 });
  });

  it('warns on notation characters outside the allowed set', () => {
    expect(illegalNotationChars('.-/A')).toEqual(['A']);
    expect(notationWarning('.-/A')).toContain('#');
    expect(notationWarning('.=/_')).toBe('');
  });
});

describe('on-screen keyboard insertion', () => {
  it('inserts the long dash at the caret', () => {
    expect(insertToken('.-/', 3, 3, LONG_DASH_TOKEN)).toEqual({ value: '.-/=', cursor: 4 });
  });

  it('replaces a selection with the extra-long dash', () => {
    expect(insertToken('.-/xx', 3, 5, EXTRA_LONG_DASH_TOKEN)).toEqual({ value: '.-/_', cursor: 4 });
  });

  it('starts a new letter when the caret sits after a mark', () => {
    expect(insertToken('.-', null, null, LONG_DASH_TOKEN)).toEqual({ value: '.-/=', cursor: 4 });
    expect(insertToken('.../. ./...', null, null, LONG_DASH_TOKEN).value).toBe('.../. ./.../=');
  });
});

describe('microphone and file helpers', () => {
  it('maps pickup sensitivity onto the 0.02–0.12 gate', () => {
    expect(micThresholdFor(100)).toBeCloseTo(0.02, 5);
    expect(micThresholdFor(0)).toBeCloseTo(0.12, 5);
    expect(micThresholdFor(70)).toBeCloseTo(MIC_RMS_THRESHOLD, 5);
    expect(micThresholdFor(70)).toBeCloseTo(0.05, 5);
  });

  it('maps permission failures to a denial message', () => {
    expect(micErrorKind('NotAllowedError')).toBe('denied');
    expect(micErrorMessage('denied')).toContain('denied');
    expect(micErrorMessage('insecure')).toContain('https');
    expect(micErrorKind('NotFoundError')).toBe('no-device');
  });

  it('accepts only wav, mp3, and ogg names', () => {
    expect(isAudioFileName('tone.WAV')).toBe(true);
    expect(isAudioFileName('clip.mp3')).toBe(true);
    expect(isAudioFileName('beep.ogg')).toBe(true);
    expect(isAudioFileName('photo.png')).toBe(false);
    expect(fileErrorMessage('type', 'photo.png')).toContain('photo.png');
  });

  it('decodes synthetic audio at more than one speed', () => {
    for (const unit of [80, 120]) {
      const morse = encode('SOS L').output;
      const pcm = pcmFromSegments(segmentsFromAmericanMorse(morse, unit));
      expect(decodePcm(pcm, 8000).text).toBe('SOS L');
    }
  });
});

describe('page registration', () => {
  it('is an indexable page and is not linked from the header nav yet', () => {
    expect(pageMeta.some((page) => page.path === AMERICAN_PAGE_PATH)).toBe(true);
    const navHrefs: readonly string[] = primaryNav.map((item) => item.href);
    expect(navHrefs.includes(AMERICAN_PAGE_PATH)).toBe(false);
  });
});
