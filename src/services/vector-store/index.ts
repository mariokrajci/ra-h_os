import { SQLiteVecAdapter } from '@/services/vector-store/sqliteVecAdapter';
import type { VectorStoreAdapter } from '@/services/vector-store/types';

let adapter: VectorStoreAdapter | null = null;

export function getVectorStoreAdapter(): VectorStoreAdapter {
  if (!adapter) {
    adapter = new SQLiteVecAdapter();
  }
  return adapter;
}

export function setVectorStoreAdapter(nextAdapter: VectorStoreAdapter): void {
  adapter = nextAdapter;
}

export type { VectorRecord, VectorSearchResult, VectorStoreAdapter } from '@/services/vector-store/types';
