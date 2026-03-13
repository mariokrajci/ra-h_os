import { getSQLiteClient } from '@/services/database/sqlite-client';
import type { VectorRecord, VectorSearchResult, VectorStoreAdapter } from '@/services/vector-store/types';

function toVectorString(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export class SQLiteVecAdapter implements VectorStoreAdapter {
  async upsertNodeVector(record: VectorRecord): Promise<void> {
    const sqlite = getSQLiteClient();
    sqlite.query('DELETE FROM vec_nodes WHERE node_id = ?', [BigInt(record.itemId)]);
    sqlite.query('INSERT INTO vec_nodes (node_id, embedding) VALUES (?, ?)', [
      BigInt(record.itemId),
      toVectorString(record.vector),
    ]);
  }

  async upsertChunkVectors(records: VectorRecord[]): Promise<void> {
    const sqlite = getSQLiteClient();
    for (const record of records) {
      sqlite.query('DELETE FROM vec_chunks WHERE chunk_id = ?', [BigInt(record.itemId)]);
      sqlite.query('INSERT INTO vec_chunks (chunk_id, embedding) VALUES (?, ?)', [
        BigInt(record.itemId),
        toVectorString(record.vector),
      ]);
    }
  }

  async deleteNodeVector(nodeId: number): Promise<void> {
    const sqlite = getSQLiteClient();
    sqlite.query('DELETE FROM vec_nodes WHERE node_id = ?', [BigInt(nodeId)]);
  }

  async deleteChunkVectors(chunkIds: number[]): Promise<void> {
    if (chunkIds.length === 0) return;
    const sqlite = getSQLiteClient();
    for (const chunkId of chunkIds) {
      sqlite.query('DELETE FROM vec_chunks WHERE chunk_id = ?', [BigInt(chunkId)]);
    }
  }

  async searchChunkVectors(input: {
    queryVector: number[];
    limit: number;
    similarityThreshold: number;
    chunkIds?: number[];
  }): Promise<VectorSearchResult[]> {
    const sqlite = getSQLiteClient();
    const vectorString = toVectorString(input.queryVector);

    if (input.chunkIds && input.chunkIds.length > 0) {
      const query = `
        SELECT v.chunk_id as itemId, (1.0 / (1.0 + v.distance)) AS similarity
        FROM vec_chunks v
        WHERE v.embedding MATCH ?
          AND v.chunk_id IN (${input.chunkIds.map(() => '?').join(',')})
          AND (1.0 / (1.0 + v.distance)) >= ?
        ORDER BY v.distance
        LIMIT ?
      `;
      const params = [vectorString, ...input.chunkIds, input.similarityThreshold, input.limit];
      const result = sqlite.query<VectorSearchResult>(query, params);
      return result.rows.map((row) => ({
        itemId: Number((row as unknown as { itemId: number }).itemId),
        similarity: Number(row.similarity),
      }));
    }

    const vectorLimit = Math.max(input.limit * 10, 50);
    const result = sqlite.query<VectorSearchResult>(
      `
        WITH vector_results AS (
          SELECT chunk_id as itemId, distance
          FROM vec_chunks
          WHERE embedding MATCH ?
          ORDER BY distance
          LIMIT ?
        )
        SELECT itemId, (1.0 / (1.0 + distance)) AS similarity
        FROM vector_results
        WHERE (1.0 / (1.0 + distance)) >= ?
        ORDER BY similarity DESC
        LIMIT ?
      `,
      [vectorString, vectorLimit, input.similarityThreshold, input.limit],
    );

    return result.rows.map((row) => ({
      itemId: Number((row as unknown as { itemId: number }).itemId),
      similarity: Number(row.similarity),
    }));
  }

  async health(): Promise<{ ok: boolean; provider: string; details?: Record<string, unknown> }> {
    const sqlite = getSQLiteClient();
    const extensionLoaded = await sqlite.checkVectorExtension();
    if (!extensionLoaded) {
      return { ok: false, provider: 'sqlite-vec', details: { vector_extension_loaded: false } };
    }

    const result = sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM vec_chunks');
    return {
      ok: true,
      provider: 'sqlite-vec',
      details: {
        vector_extension_loaded: true,
        vec_chunks_count: Number(result.rows[0]?.count ?? 0),
      },
    };
  }
}
