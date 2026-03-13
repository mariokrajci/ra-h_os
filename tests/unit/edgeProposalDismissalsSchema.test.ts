import { describe, expect, it } from 'vitest';

import { getSQLiteClient } from '@/services/database/sqlite-client';

describe('edge proposal dismissals schema', () => {
  it('creates edge proposal dismissals table with a unique source-target index', () => {
    const sqlite = getSQLiteClient();

    const table = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'edge_proposal_dismissals'"
    ).get() as { name?: string } | undefined;

    const indexes = sqlite.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'edge_proposal_dismissals'"
    ).all() as Array<{ name: string; sql: string | null }>;

    expect(table?.name).toBe('edge_proposal_dismissals');
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'idx_edge_proposal_dismissals_source_target',
        }),
      ])
    );

    const uniqueIndex = indexes.find(index => index.name === 'idx_edge_proposal_dismissals_source_target');
    expect(uniqueIndex?.sql).toContain('UNIQUE INDEX');
    expect(uniqueIndex?.sql).toContain('(source_node_id, target_node_id)');
  });
});
