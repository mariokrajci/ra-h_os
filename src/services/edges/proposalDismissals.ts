import { getSQLiteClient } from '@/services/database/sqlite-client';

export class ProposalDismissalService {
  async dismissProposal(sourceNodeId: number, targetNodeId: number): Promise<void> {
    const sqlite = getSQLiteClient();
    sqlite.prepare(`
      INSERT INTO edge_proposal_dismissals (source_node_id, target_node_id, dismissed_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source_node_id, target_node_id)
      DO UPDATE SET dismissed_at = CURRENT_TIMESTAMP
    `).run(sourceNodeId, targetNodeId);
  }

  async getDismissedTargetIds(sourceNodeId: number): Promise<Set<number>> {
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
