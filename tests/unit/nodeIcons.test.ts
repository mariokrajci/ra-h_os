import { describe, expect, test } from 'vitest';
import { shouldFetchFavicon } from '@/utils/nodeIcons';

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
});
