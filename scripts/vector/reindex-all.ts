import { formatReindexEmbeddingsReport, reindexEmbeddings } from '@/services/embedding/reindex';

function parseNodeIds(args: string[]): number[] {
  const values: number[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--node-id') continue;
    const rawValue = args[index + 1];
    const nodeId = Number.parseInt(rawValue ?? '', 10);
    if (Number.isNaN(nodeId)) {
      throw new Error(`Invalid node id: ${rawValue ?? '(missing)'}`);
    }
    values.push(nodeId);
    index += 1;
  }

  return values;
}

async function main(): Promise<void> {
  const nodeIds = parseNodeIds(process.argv.slice(2));
  const result = await reindexEmbeddings({
    nodeIds: nodeIds.length > 0 ? nodeIds : undefined,
  });

  console.log(formatReindexEmbeddingsReport(result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Embedding reindex failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
