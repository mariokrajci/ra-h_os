import { getSQLiteClient } from '@/services/database/sqlite-client';
import type { StoredFileType } from './fileStorage';

export type FileRecordStatus = 'ready' | 'missing' | 'orphaned' | 'deleted';

export interface FileRecord {
  id: number;
  node_id: number;
  kind: StoredFileType;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  status: FileRecordStatus;
  created_at: string;
  updated_at: string;
  last_verified_at?: string | null;
}

interface UpsertFileRecordInput {
  nodeId: number;
  kind: StoredFileType;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status?: FileRecordStatus;
}

class FileRegistryService {
  async upsertFileRecord(input: UpsertFileRecordInput): Promise<FileRecord | null> {
    const sqlite = getSQLiteClient();
    const status = input.status ?? 'ready';

    sqlite.query(
      `
      INSERT INTO files (node_id, kind, storage_path, mime_type, size_bytes, sha256, status, created_at, updated_at, last_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(node_id, kind) DO UPDATE SET
        storage_path = excluded.storage_path,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        sha256 = excluded.sha256,
        status = excluded.status,
        updated_at = datetime('now'),
        last_verified_at = datetime('now')
      `,
      [input.nodeId, input.kind, input.storagePath, input.mimeType, input.sizeBytes, input.sha256, status],
    );

    return this.getFileRecordByNodeAndKind(input.nodeId, input.kind);
  }

  async getFileRecordByNodeAndKind(nodeId: number, kind: StoredFileType): Promise<FileRecord | null> {
    const sqlite = getSQLiteClient();
    const result = sqlite.query<FileRecord>(
      `
      SELECT id, node_id, kind, storage_path, mime_type, size_bytes, sha256, status, created_at, updated_at, last_verified_at
      FROM files
      WHERE node_id = ? AND kind = ?
      LIMIT 1
      `,
      [nodeId, kind],
    );
    return result.rows[0] ?? null;
  }

  async markFileStatus(nodeId: number, kind: StoredFileType, status: FileRecordStatus): Promise<void> {
    const sqlite = getSQLiteClient();
    sqlite.query(
      `
      UPDATE files
      SET status = ?, updated_at = datetime('now')
      WHERE node_id = ? AND kind = ?
      `,
      [status, nodeId, kind],
    );
  }
}

export const fileRegistryService = new FileRegistryService();
