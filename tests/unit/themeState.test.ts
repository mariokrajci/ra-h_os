import { describe, expect, it } from 'vitest';
import { resolveTheme } from '@/components/theme/themeState';

describe('themeState', () => {
  it('returns explicit light and dark modes unchanged', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('uses system preference when mode is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
