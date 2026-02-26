import { getSQLiteClient } from '@/services/database/sqlite-client';
import { nodeService } from '@/services/database/nodes';

export interface CitationNeighborRow {
  neighbor_id: number;
  created_at: string | null;
}

export interface RankedNeighbor {
  id: number;
  connectionCount: number;
  lastEdgeCreatedAt: string | null;
}

export interface CitationNode {
  id: number;
  title: string;
  description?: string;
  connection_count_to_subtopic: number;
  last_edge_created_at: string | null;
}

export function rankOutsideNeighbors(
  subtopicNodeIds: Set<number>,
  rows: CitationNeighborRow[],
  limit = 10
): RankedNeighbor[] {
  const aggregate = new Map<number, { count: number; latest: string | null }>();

  for (const row of rows) {
    const neighborId = Number(row.neighbor_id);
    if (!Number.isFinite(neighborId) || subtopicNodeIds.has(neighborId)) {
      continue;
    }

    const current = aggregate.get(neighborId);
    if (!current) {
      aggregate.set(neighborId, { count: 1, latest: row.created_at });
      continue;
    }

    current.count += 1;
    if ((row.created_at || '') > (current.latest || '')) {
      current.latest = row.created_at;
    }
  }

  return Array.from(aggregate.entries())
    .map(([id, v]) => ({
      id,
      connectionCount: v.count,
      lastEdgeCreatedAt: v.latest,
    }))
    .sort((a, b) => {
      if (b.connectionCount !== a.connectionCount) {
        return b.connectionCount - a.connectionCount;
      }
      return (b.lastEdgeCreatedAt || '').localeCompare(a.lastEdgeCreatedAt || '');
    })
    .slice(0, Math.max(0, limit));
}

export async function resolveOutsideNeighborCitations(
  subtopicNodeIds: number[],
  limit = 10
): Promise<CitationNode[]> {
  if (!subtopicNodeIds.length) return [];

  const db = getSQLiteClient();
  const placeholders = subtopicNodeIds.map(() => '?').join(',');

  const rows = db.prepare(`
    SELECT
      CASE
        WHEN e.from_node_id IN (${placeholders}) THEN e.to_node_id
        ELSE e.from_node_id
      END AS neighbor_id,
      e.created_at
    FROM edges e
    WHERE e.from_node_id IN (${placeholders})
       OR e.to_node_id IN (${placeholders})
  `).all(
    ...subtopicNodeIds,
    ...subtopicNodeIds,
    ...subtopicNodeIds,
  ) as CitationNeighborRow[];

  const ranked = rankOutsideNeighbors(new Set(subtopicNodeIds), rows, limit);
  const citations: CitationNode[] = [];

  for (const entry of ranked) {
    const node = await nodeService.getNodeById(entry.id);
    if (!node) continue;
    citations.push({
      id: node.id,
      title: node.title,
      description: node.description,
      connection_count_to_subtopic: entry.connectionCount,
      last_edge_created_at: entry.lastEdgeCreatedAt,
    });
  }

  return citations;
}
