import { describe, expect, it } from 'vitest';
import {
  highlightCodeTokens,
  normalizeHighlightLanguage,
} from '@/components/focus/source/shikiHighlighting';

describe('shikiHighlighting', () => {
  it('normalizes common language aliases', () => {
    expect(normalizeHighlightLanguage('ts')).toBe('typescript');
    expect(normalizeHighlightLanguage('sh')).toBe('bash');
    expect(normalizeHighlightLanguage('shell')).toBe('bash');
    expect(normalizeHighlightLanguage('yml')).toBe('yaml');
    expect(normalizeHighlightLanguage('TXT')).toBe('plaintext');
  });

  it('returns token lines for supported languages', async () => {
    const result = await highlightCodeTokens('const value = 1;\n', 'ts');

    expect(result.normalizedLanguage).toBe('typescript');
    expect(result.lines).not.toBeNull();
    expect(result.lines?.length).toBeGreaterThan(0);
    expect(result.lines?.flatMap((line) => line.map((token) => token.content)).join('')).toContain('const value = 1;');
    expect(result.lines?.some((line) => line.some((token) => Boolean(token.color)))).toBe(true);
  });

  it('returns null token lines for unsupported languages', async () => {
    const result = await highlightCodeTokens('const value = 1;\n', 'unknownlang');

    expect(result.normalizedLanguage).toBe('unknownlang');
    expect(result.lines).toBeNull();
  });

  it('preserves token text order for bash command docs', async () => {
    const code = [
      '# one-time setup',
      'git remote rename origin upstream',
      'git checkout -b feature/<name>',
      'git commit -m "feat: ..."',
    ].join('\n');

    const result = await highlightCodeTokens(code, 'bash');
    const reconstructed = result.lines?.map((line) => line.map((token) => token.content).join('')).join('\n');

    expect(reconstructed).toBe(code);
    expect(result.lines?.some((line) => line.length > 1)).toBe(true);
  });
});
