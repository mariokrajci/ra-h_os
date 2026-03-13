export interface VectorRecord {
  itemId: number;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  itemId: number;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface VectorStoreAdapter {
  upsertNodeVector(record: VectorRecord): Promise<void>;
  upsertChunkVectors(records: VectorRecord[]): Promise<void>;
  deleteNodeVector(nodeId: number): Promise<void>;
  deleteChunkVectors(chunkIds: number[]): Promise<void>;
  searchChunkVectors(input: {
    queryVector: number[];
    limit: number;
    similarityThreshold: number;
    chunkIds?: number[];
  }): Promise<VectorSearchResult[]>;
  health(): Promise<{ ok: boolean; provider: string; details?: Record<string, unknown> }>;
}

export function isVectorSearchResult(value: unknown): value is VectorSearchResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.itemId === 'number' && typeof candidate.similarity === 'number';
}
