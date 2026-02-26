import { describe, expect, it } from 'vitest';
import { hasNodeSetChanged } from '@/services/wiki/diff';

describe('hasNodeSetChanged', () => {
  it('returns false for identical ids in any order', () => {
    expect(hasNodeSetChanged([3, 2, 1], [1, 2, 3])).toBe(false);
  });

  it('returns true when cardinality differs', () => {
    expect(hasNodeSetChanged([1, 2, 3], [1, 2])).toBe(true);
  });

  it('returns true when values differ', () => {
    expect(hasNodeSetChanged([1, 2, 4], [1, 2, 3])).toBe(true);
  });
});
