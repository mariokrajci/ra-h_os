import { NextResponse } from 'next/server';
import { getAllTopics } from '@/services/wiki/db';

export const runtime = 'nodejs';

export async function GET() {
  const all = getAllTopics();

  const tree = all
    .filter((topic) => topic.parent_id === null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((topic) => ({
      id: topic.id,
      title: topic.title,
      order_index: topic.order_index,
      children: all
        .filter((child) => child.parent_id === topic.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((child) => ({
          id: child.id,
          title: child.title,
          dimension: child.dimension,
          node_count: child.node_ids.length,
          summary: child.summary,
          article_status: child.article_status,
        })),
    }));

  return NextResponse.json({ success: true, data: tree });
}
