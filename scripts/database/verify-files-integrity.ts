import fs from 'fs/promises';
import { getSQLiteClient } from '@/services/database/sqlite-client';

type FileRow = {
  node_id: number;
  kind: 'pdf' | 'epub';
  storage_path: string;
  status: 'ready' | 'missing' | 'orphaned' | 'deleted';
};

async function main() {
  const sqlite = getSQLiteClient();
  const rows = sqlite.query<FileRow>(
    `
    SELECT node_id, kind, storage_path, status
    FROM files
    WHERE status != 'deleted'
    ORDER BY node_id ASC
    `,
  ).rows;

  let ready = 0;
  let missing = 0;
  let unchanged = 0;

  for (const row of rows) {
    let exists = true;
    try {
      await fs.access(row.storage_path);
    } catch {
      exists = false;
    }

    if (exists) {
      ready += 1;
      if (row.status !== 'ready') {
        sqlite.query(
          `UPDATE files SET status = 'ready', last_verified_at = datetime('now'), updated_at = datetime('now') WHERE node_id = ? AND kind = ?`,
          [row.node_id, row.kind],
        );
      } else {
        sqlite.query(
          `UPDATE files SET last_verified_at = datetime('now') WHERE node_id = ? AND kind = ?`,
          [row.node_id, row.kind],
        );
        unchanged += 1;
      }
      continue;
    }

    missing += 1;
    sqlite.query(
      `UPDATE files SET status = 'missing', last_verified_at = datetime('now'), updated_at = datetime('now') WHERE node_id = ? AND kind = ?`,
      [row.node_id, row.kind],
    );
  }

  const summary = {
    total: rows.length,
    ready,
    missing,
    unchanged,
    verified_at: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to verify files integrity:', error);
  process.exit(1);
});
