import { NextRequest, NextResponse } from 'next/server';
import { getTopicById, updateArticle } from '@/services/wiki/db';
import { nodeService } from '@/services/database/nodes';
import { synthesizeFullArticle } from '@/services/wiki/ai';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
  }

  const topic = getTopicById(id);
  if (!topic) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  if (!topic.parent_id) {
    return NextResponse.json(
      { success: false, error: 'Articles are generated for subtopics only' },
      { status: 400 }
    );
  }

  try {
    const nodes = (await Promise.all(topic.node_ids.map((nodeId) => nodeService.getNodeById(nodeId))))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));

    const { article } = await synthesizeFullArticle(topic.title, nodes);
    updateArticle(topic.id, article, 'ready');

    return NextResponse.json({
      success: true,
      data: {
        id: topic.id,
        article,
        article_status: 'ready',
        article_generated_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    updateArticle(topic.id, '', 'error');
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate article' },
      { status: 500 }
    );
  }
}
