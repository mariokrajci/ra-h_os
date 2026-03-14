import { describe, expect, it } from 'vitest';

import { getShellVariant } from '@/components/layout/shellVariant';

describe('getShellVariant', () => {
  it('uses the mobile shell on phones', () => {
    expect(getShellVariant('phone')).toBe('mobile');
  });

  it('uses the tablet shell on tablets', () => {
    expect(getShellVariant('tablet')).toBe('tablet');
  });

  it('uses the desktop shell on desktops', () => {
    expect(getShellVariant('desktop')).toBe('desktop');
  });
});
