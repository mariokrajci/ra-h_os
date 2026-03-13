import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  testConnectionMock,
  checkVectorExtensionMock,
  getChunkCountMock,
  getChunksWithoutEmbeddingsMock,
  adapterHealthMock,
} = vi.hoisted(() => ({
  testConnectionMock: vi.fn(),
  checkVectorExtensionMock: vi.fn(),
  getChunkCountMock: vi.fn(),
  getChunksWithoutEmbeddingsMock: vi.fn(),
  adapterHealthMock: vi.fn(),
}));

vi.mock('@/services/database/sqlite-client', () => ({
  getSQLiteClient: () => ({
    testConnection: testConnectionMock,
    checkVectorExtension: checkVectorExtensionMock,
  }),
}));

vi.mock('@/services/database/chunks', () => ({
  chunkService: {
    getChunkCount: getChunkCountMock,
    getChunksWithoutEmbeddings: getChunksWithoutEmbeddingsMock,
  },
}));

vi.mock('@/services/vector-store', () => ({
  getVectorStoreAdapter: () => ({
    health: adapterHealthMock,
  }),
}));

import { GET } from '../../app/api/health/vectors/route';

describe('/api/health/vectors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testConnectionMock.mockResolvedValue(true);
    checkVectorExtensionMock.mockResolvedValue(false);
    getChunkCountMock.mockResolvedValue(4);
  });

  it('returns success when vector extension is unavailable and skips vec-specific chunk inspection', async () => {
    adapterHealthMock.mockResolvedValue({
      ok: false,
      provider: 'sqlite-vec',
      details: { vector_extension_loaded: false },
    });

    const response = await GET();
    const body = await response.json();

    expect(getChunksWithoutEmbeddingsMock).not.toHaveBeenCalled();
    expect(body.status).toBe('success');
    expect(body.data.vector_health).toBe('extension_unavailable');
    expect(body.data.chunk_stats).toEqual({
      total_chunks: 4,
      vectorized_chunks: 0,
      missing_embeddings: 4,
      coverage_percentage: 0,
    });
  });
});
