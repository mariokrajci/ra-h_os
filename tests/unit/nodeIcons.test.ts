import { describe, expect, test } from 'vitest';
import { getFaviconUrl, getLinkIconKind, shouldFetchFavicon } from '@/utils/nodeIcons';

describe('nodeIcons favicon guards', () => {
  test('skips placeholder and local domains', () => {
    expect(shouldFetchFavicon('example.com')).toBe(false);
    expect(shouldFetchFavicon('www.example.com')).toBe(false);
    expect(shouldFetchFavicon('localhost')).toBe(false);
    expect(shouldFetchFavicon('127.0.0.1')).toBe(false);
  });

  test('allows normal public domains', () => {
    expect(shouldFetchFavicon('github.com')).toBe(true);
    expect(shouldFetchFavicon('www.nytimes.com')).toBe(true);
  });

  test('uses a shared google favicon endpoint', () => {
    expect(getFaviconUrl('github.com', 18)).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=18');
  });

  test('detects fixed icon kinds for known links', () => {
    expect(getLinkIconKind('https://github.com/brendanhogan/hermitclaw')).toBe('github');
    expect(getLinkIconKind('https://www.youtube.com/watch?v=123')).toBe('youtube');
    expect(getLinkIconKind('https://example.com/file.pdf')).toBe('pdf');
    expect(getLinkIconKind('https://www.nytimes.com/article')).toBe('favicon');
  });
});
