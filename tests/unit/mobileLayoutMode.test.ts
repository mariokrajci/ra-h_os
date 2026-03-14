import { describe, expect, it } from 'vitest';

import { getLayoutMode, MOBILE_BREAKPOINT, TABLET_BREAKPOINT } from '@/components/layout/layoutMode';

describe('getLayoutMode', () => {
  it('returns phone below the mobile breakpoint', () => {
    expect(getLayoutMode(MOBILE_BREAKPOINT - 1)).toBe('phone');
  });

  it('returns tablet between mobile and desktop breakpoints', () => {
    expect(getLayoutMode(MOBILE_BREAKPOINT)).toBe('tablet');
    expect(getLayoutMode(TABLET_BREAKPOINT - 1)).toBe('tablet');
  });

  it('returns desktop at and above the desktop breakpoint', () => {
    expect(getLayoutMode(TABLET_BREAKPOINT)).toBe('desktop');
    expect(getLayoutMode(TABLET_BREAKPOINT + 320)).toBe('desktop');
  });
});
