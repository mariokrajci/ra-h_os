import { getSQLiteClient } from '@/services/database/sqlite-client';

export class ProposalDismissalService {
  private ensureSchema(): void {
    const sqlite = getSQLiteClient();
    sqlite.query(`
      CREATE TABLE IF NOT EXISTS edge_proposal_dismissals (
        id INTEGER PRIMARY KEY,
        source_node_id INTEGER NOT NULL,
        target_node_id INTEGER NOT NULL,
        dismissed_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);
    sqlite.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_edge_proposal_dismissals_source_target
      ON edge_proposal_dismissals(source_node_id, target_node_id)
    `);
  }

  async dismissProposal(sourceNodeId: number, targetNodeId: number): Promise<void> {
    this.ensureSchema();
    const sqlite = getSQLiteClient();
    sqlite.prepare(`
      INSERT INTO edge_proposal_dismissals (source_node_id, target_node_id, dismissed_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source_node_id, target_node_id)
      DO UPDATE SET dismissed_at = CURRENT_TIMESTAMP
    `).run(sourceNodeId, targetNodeId);
  }

  async getDismissedTargetIds(sourceNodeId: number): Promise<Set<number>> {
    this.ensureSchema();
    const sqlite = getSQLiteClient();
    const rows = sqlite.prepare(`
      SELECT target_node_id
      FROM edge_proposal_dismissals
      WHERE source_node_id = ?
    `).all(sourceNodeId) as Array<{ target_node_id: number }>;

    return new Set(rows.map(row => Number(row.target_node_id)));
  }
}

export const proposalDismissalService = new ProposalDismissalService();
