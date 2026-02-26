import { getSQLiteClient } from '@/services/database/sqlite-client';
import { nodeService } from '@/services/database/nodes';
import { hasNodeSetChanged } from './diff';
import { getAllTopics, upsertTopic } from './db';
import { groupDimensionsIntoTopics, summarizeDimension } from './ai';

export interface GenerateProgress {
  stage: 'grouping' | 'summarizing' | 'done' | 'error';
  message: string;
  total: number;
  processed: number;
  estimatedCostUsd: number;
}

export interface GenerateResult {
  topicsTotal: number;
  summariesRegenerated: number;
  costUsd: number;
}

export async function generateWiki(
  onProgress: (progress: GenerateProgress) => void
): Promise<GenerateResult> {
  const db = getSQLiteClient();

  const dimensionRows = db.prepare(`
    SELECT d.name, GROUP_CONCAT(nd.node_id) AS node_ids
    FROM dimensions d
    LEFT JOIN node_dimensions nd ON nd.dimension = d.name
    GROUP BY d.name
    ORDER BY d.name
  `).all() as Array<{ name: string; node_ids: string | null }>;

  if (!dimensionRows.length) {
    onProgress({
      stage: 'done',
      message: 'No dimensions found.',
      total: 0,
      processed: 0,
      estimatedCostUsd: 0,
    });
    return { topicsTotal: 0, summariesRegenerated: 0, costUsd: 0 };
  }

  const dimensionNodeMap = new Map<string, number[]>();
  for (const row of dimensionRows) {
    const nodeIds = row.node_ids
      ? row.node_ids.split(',').map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    dimensionNodeMap.set(row.name, nodeIds);
  }

  onProgress({
    stage: 'grouping',
    message: `Grouping ${dimensionRows.length} dimensions...`,
    total: dimensionRows.length,
    processed: 0,
    estimatedCostUsd: 0,
  });

  const groups = await groupDimensionsIntoTopics(Array.from(dimensionNodeMap.keys()));

  const existingTopics = getAllTopics();
  const existingSubtopics = existingTopics.filter((topic) => topic.parent_id !== null);

  let processed = 0;
  let totalTokens = 0;
  let summariesRegenerated = 0;
  const total = dimensionRows.length;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    const existingTop = existingTopics.find(
      (topic) => topic.parent_id === null && topic.title === group.topic
    );

    const topicId = upsertTopic({
      id: existingTop?.id,
      title: group.topic,
      parent_id: null,
      dimension: null,
      node_ids: [],
      summary: null,
      article: null,
      article_status: 'none',
      article_generated_at: null,
      order_index: i,
      generated_at: null,
    });

    for (let j = 0; j < group.dimensions.length; j++) {
      const dimensionName = group.dimensions[j];
      const nodeIds = dimensionNodeMap.get(dimensionName) || [];
      const existing = existingSubtopics.find((topic) => topic.dimension === dimensionName);
      const changed = !existing || hasNodeSetChanged(nodeIds, existing.node_ids);

      onProgress({
        stage: 'summarizing',
        message: changed
          ? `Summarizing ${dimensionName}...`
          : `Skipping unchanged ${dimensionName}`,
        total,
        processed,
        estimatedCostUsd: (totalTokens / 1_000_000) * 0.6,
      });

      if (changed && nodeIds.length > 0) {
        const nodes = await nodeService.getNodes({ dimensions: [dimensionName], limit: 25 });
        let summary: string;
        let tokensUsed: number;
        try {
          ({ summary, tokensUsed } = await summarizeDimension(dimensionName, nodes));
        } catch (err) {
          console.error(`[wiki] Failed to summarize dimension "${dimensionName}":`, err);
          processed += 1;
          continue;
        }
        totalTokens += tokensUsed;
        summariesRegenerated += 1;

        upsertTopic({
          id: existing?.id,
          title: dimensionName,
          parent_id: topicId,
          dimension: dimensionName,
          node_ids: nodeIds,
          summary,
          article: existing?.article ?? null,
          article_status: existing?.article_status ?? 'none',
          article_generated_at: existing?.article_generated_at ?? null,
          order_index: j,
          generated_at: new Date().toISOString(),
        });
      } else if (existing) {
        upsertTopic({
          ...existing,
          parent_id: topicId,
          order_index: j,
        });
      } else {
        upsertTopic({
          title: dimensionName,
          parent_id: topicId,
          dimension: dimensionName,
          node_ids: nodeIds,
          summary: null,
          article: null,
          article_status: 'none',
          article_generated_at: null,
          order_index: j,
          generated_at: new Date().toISOString(),
        });
      }

      processed += 1;
    }
  }

  const costUsd = (totalTokens / 1_000_000) * 0.6;
  onProgress({
    stage: 'done',
    message: 'Wiki refresh complete.',
    total,
    processed: total,
    estimatedCostUsd: costUsd,
  });

  return {
    topicsTotal: groups.length,
    summariesRegenerated,
    costUsd,
  };
}
