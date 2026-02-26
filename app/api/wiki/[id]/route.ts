import { NextRequest, NextResponse } from 'next/server';
import { getTopicById } from '@/services/wiki/db';
import { nodeService } from '@/services/database/nodes';
import { resolveOutsideNeighborCitations } from '@/services/wiki/citations';

export const runtime = 'nodejs';

function inferRole(dimensions: string[] = [], link?: string | null): 'derived' | 'source' | 'unknown' {
  if (dimensions.includes('kind/derived')) return 'derived';
  if (dimensions.includes('kind/source') || Boolean(link)) return 'source';
  return 'unknown';
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
  }

  const topic = getTopicById(id);
  if (!topic) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const nodes = (await Promise.all(topic.node_ids.map((nodeId) => nodeService.getNodeById(nodeId))))
    .filter((node): node is NonNullable<typeof node> => Boolean(node))
    .map((node) => ({
      id: node.id,
      title: node.title,
      description: node.description,
      dimensions: node.dimensions ?? [],
      link: node.link ?? null,
      role: inferRole(node.dimensions ?? [], node.link),
    }));

  const citations = await resolveOutsideNeighborCitations(topic.node_ids, 10);

  return NextResponse.json({
    success: true,
    data: {
      id: topic.id,
      title: topic.title,
      summary: topic.summary,
      article: topic.article,
      article_status: topic.article_status,
      article_generated_at: topic.article_generated_at,
      generated_at: topic.generated_at,
      nodes,
      citations,
    },
  });
}
