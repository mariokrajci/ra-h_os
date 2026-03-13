import { describe, expect, it } from 'vitest';

import { getSplitPaneBasis, getSplitPaneReservedWidthPx } from '@/components/layout/splitPaneLayout';

describe('split pane layout', () => {
  it('reserves space only for the visible split handle', () => {
    expect(getSplitPaneReservedWidthPx()).toBe(8);
  });

  it('sizes panes from the remaining width after reserved layout chrome', () => {
    expect(getSplitPaneBasis(50)).toBe('calc((100% - 8px) * 0.5)');
    expect(getSplitPaneBasis(35)).toBe('calc((100% - 8px) * 0.35)');
  });

  it('clamps invalid percentages to the 0-100 range', () => {
    expect(getSplitPaneBasis(-10)).toBe('calc((100% - 8px) * 0)');
    expect(getSplitPaneBasis(120)).toBe('calc((100% - 8px) * 1)');
  });
});
