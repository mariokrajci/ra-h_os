import { describe, expect, it } from 'vitest';

import { isVectorSearchResult } from '@/services/vector-store/types';

describe('vector-store types', () => {
  it('accepts a valid similarity result shape', () => {
    expect(
      isVectorSearchResult({
        itemId: 10,
        similarity: 0.82,
        metadata: { node_id: 4 },
      }),
    ).toBe(true);
  });

  it('rejects invalid similarity result shapes', () => {
    expect(
      isVectorSearchResult({
        itemId: '10',
        similarity: 0.82,
      }),
    ).toBe(false);
  });
});
