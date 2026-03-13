import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, checkVectorExtensionMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  checkVectorExtensionMock: vi.fn(),
}));

vi.mock('@/services/database/sqlite-client', () => ({
  getSQLiteClient: () => ({
    query: queryMock,
    checkVectorExtension: checkVectorExtensionMock,
  }),
}));

import { SQLiteVecAdapter } from '@/services/vector-store/sqliteVecAdapter';

describe('SQLiteVecAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes chunk vectors through vec_chunks using sqlite-vec string encoding', async () => {
    queryMock.mockReturnValue({ rows: [], changes: 1 });
    const adapter = new SQLiteVecAdapter();

    await adapter.upsertChunkVectors([{ itemId: 7, vector: [0.1, 0.2] }]);

    expect(queryMock).toHaveBeenNthCalledWith(1, 'DELETE FROM vec_chunks WHERE chunk_id = ?', [BigInt(7)]);
    expect(queryMock).toHaveBeenNthCalledWith(2, 'INSERT INTO vec_chunks (chunk_id, embedding) VALUES (?, ?)', [
      BigInt(7),
      '[0.1,0.2]',
    ]);
  });

  it('scopes vector search to provided chunk ids', async () => {
    queryMock.mockReturnValue({
      rows: [{ itemId: '12', similarity: 0.88 }],
    });
    const adapter = new SQLiteVecAdapter();

    const result = await adapter.searchChunkVectors({
      queryVector: [0.3, 0.4],
      limit: 3,
      similarityThreshold: 0.6,
      chunkIds: [12, 13],
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('v.chunk_id IN (?,?)'),
      ['[0.3,0.4]', 12, 13, 0.6, 3],
    );
    expect(result).toEqual([{ itemId: 12, similarity: 0.88 }]);
  });

  it('reports unavailable health when sqlite-vec is not loaded', async () => {
    checkVectorExtensionMock.mockResolvedValue(false);
    const adapter = new SQLiteVecAdapter();

    const health = await adapter.health();

    expect(health).toEqual({
      ok: false,
      provider: 'sqlite-vec',
      details: { vector_extension_loaded: false },
    });
    expect(queryMock).not.toHaveBeenCalled();
  });
});
