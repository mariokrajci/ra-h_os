import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, searchChunkVectorsMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  searchChunkVectorsMock: vi.fn(),
}));

vi.mock('@/services/database/sqlite-client', () => ({
  getSQLiteClient: () => ({
    query: queryMock,
    prepare: vi.fn(),
    transaction: vi.fn(),
  }),
}));

vi.mock('@/services/vector-store', () => ({
  getVectorStoreAdapter: () => ({
    searchChunkVectors: searchChunkVectorsMock,
  }),
}));

import { chunkService } from '@/services/database/chunks';

describe('ChunkService search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates chunk rows from vector adapter search results', async () => {
    searchChunkVectorsMock.mockResolvedValue([
      { itemId: 7, similarity: 0.91 },
      { itemId: 8, similarity: 0.74 },
    ]);
    queryMock.mockReturnValue({
      rows: [
        { id: 7, node_id: 1, chunk_idx: 0, text: 'first', embedding_type: 'test', created_at: 'now' },
        { id: 8, node_id: 1, chunk_idx: 1, text: 'second', embedding_type: 'test', created_at: 'now' },
      ],
    });

    const results = await chunkService.searchChunks([0.1, 0.2], 0.5, 2);

    expect(searchChunkVectorsMock).toHaveBeenCalledWith({
      queryVector: [0.1, 0.2],
      similarityThreshold: 0.5,
      limit: 2,
      chunkIds: undefined,
    });
    expect(results).toEqual([
      expect.objectContaining({ id: 7, similarity: 0.91 }),
      expect.objectContaining({ id: 8, similarity: 0.74 }),
    ]);
  });
});
