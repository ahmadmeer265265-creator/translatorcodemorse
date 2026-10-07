import { describe, expect, it, vi } from 'vitest';
import { beginFlash, copyWithFallback, visibleLabel } from './copy-feedback';

describe('copy button flash', () => {
  it('shows the temporary label until the deadline, then the original', () => {
    const flash = beginFlash('Copied', 1_000);
    expect(visibleLabel('Copy text', flash, 1_000)).toBe('Copied');
    expect(visibleLabel('Copy text', flash, 2_499)).toBe('Copied');
    expect(visibleLabel('Copy text', flash, 2_500)).toBe('Copy text');
  });

  it('a second flash replaces the first deadline', () => {
    const first = beginFlash('Copied', 0);
    const second = beginFlash('Link copied', 1_000);
    expect(visibleLabel('Copy share link', first, 1_600)).toBe('Copy share link');
    expect(visibleLabel('Copy share link', second, 1_600)).toBe('Link copied');
    expect(visibleLabel('Copy share link', second, 2_500)).toBe('Copy share link');
  });
});

describe('copyWithFallback', () => {
  it('uses the async clipboard when it resolves', async () => {
    const writeText = vi.fn(async () => {});
    const legacyCopy = vi.fn(() => false);
    await expect(copyWithFallback('SOS', writeText, legacyCopy)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('SOS');
    expect(legacyCopy).not.toHaveBeenCalled();
  });

  it('falls back when the async clipboard rejects', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    const legacyCopy = vi.fn(() => true);
    await expect(copyWithFallback('SOS', writeText, legacyCopy)).resolves.toBe('copied');
    expect(legacyCopy).toHaveBeenCalledWith('SOS');
  });

  it('falls back when the async clipboard is missing', async () => {
    const legacyCopy = vi.fn(() => true);
    await expect(copyWithFallback('SOS', undefined, legacyCopy)).resolves.toBe('copied');
    expect(legacyCopy).toHaveBeenCalledWith('SOS');
  });

  it('fails when both paths fail', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    const legacyCopy = vi.fn(() => false);
    await expect(copyWithFallback('SOS', writeText, legacyCopy)).resolves.toBe('failed');
  });
});
