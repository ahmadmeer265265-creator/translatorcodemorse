import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');

/** Morse-looking tokens: runs of . and - , optionally spaced groups / word separators. */
function extractMorseTokens(text: string): string[] {
  const withoutTags = text
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const matches = withoutTags.match(/(?:^|[\s(=:])([.\-]+(?:[ \t]+[.\-]+)*(?:[ \t]*\/[ \t]*[.\-]+(?:[ \t]+[.\-]+)*)*)(?=[\s,.:;)|]|$)/g);
  if (!matches) return [];
  const cleaned = matches
    .map((m) => m.replace(/^[\s(=:]/, '').trim())
    .filter((m) => /[.-]/.test(m) && m.length >= 1);
  return [...new Set(cleaned)];
}

describe('homepage Morse tokens', () => {
  it('keeps every Morse token from article-source in the built homepage HTML', () => {
    const source = fs.readFileSync(path.join(root, 'docs/article-source.txt'), 'utf8');
    const builtPath = path.join(root, 'dist/index.html');
    expect(fs.existsSync(builtPath), 'dist/index.html missing — run build first').toBe(true);
    const html = fs.readFileSync(builtPath, 'utf8');
    const tokens = extractMorseTokens(source).filter((token) => {
      // Skip pure single punctuation that is not Morse context noise from HTML entities
      if (token === '.' || token === '-') return false;
      return true;
    });
    expect(tokens.length).toBeGreaterThan(20);
    const missing = tokens.filter((token) => !html.includes(token));
    expect(missing, `Missing Morse tokens: ${missing.join(' | ')}`).toEqual([]);
  });
});
