import { nodeService } from '@/services/database';
import { embedNodeContent } from '@/services/embedding/ingestion';

export interface ReindexFailure {
  nodeId: number;
  message: string;
}

export interface ReindexEmbeddingsResult {
  total: number;
  succeeded: number;
  failed: number;
  failures: ReindexFailure[];
}

export interface ReindexEmbeddingsOptions {
  nodeIds?: number[];
}

export async function reindexEmbeddings(
  options: ReindexEmbeddingsOptions = {},
): Promise<ReindexEmbeddingsResult> {
  const allNodes = await nodeService.getNodes({ limit: 100000 });
  const nodes =
    options.nodeIds && options.nodeIds.length > 0
      ? allNodes.filter((node) => options.nodeIds?.includes(node.id))
      : allNodes;
  const failures: ReindexFailure[] = [];
  let succeeded = 0;

  for (const node of nodes) {
    const result = await embedNodeContent(node.id, { forceReEmbed: true });
    if (result.success) {
      succeeded += 1;
      continue;
    }

    failures.push({
      nodeId: node.id,
      message: result.error || 'Embedding reindex failed',
    });
  }

  return {
    total: nodes.length,
    succeeded,
    failed: failures.length,
    failures,
  };
}

export function formatReindexEmbeddingsReport(result: ReindexEmbeddingsResult): string {
  const lines = [`Reindexed ${result.succeeded}/${result.total} nodes successfully.`];

  if (result.failed > 0) {
    lines.push(`Failures: ${result.failed}`);
    for (const failure of result.failures) {
      lines.push(`- Node ${failure.nodeId}: ${failure.message}`);
    }
  }

  return lines.join('\n');
}
