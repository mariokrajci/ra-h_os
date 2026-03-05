import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { bookEnrichmentQueue } from '@/services/ingestion/bookEnrichmentQueue';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const nodeId = parseInt(id, 10);

    if (Number.isNaN(nodeId)) {
      return NextResponse.json({ success: false, error: 'Invalid node ID' }, { status: 400 });
    }

    const node = await nodeService.getNodeById(nodeId);
    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    if (node.metadata?.content_kind !== 'book') {
      return NextResponse.json({ success: false, error: 'Node is not a book' }, { status: 400 });
    }

    bookEnrichmentQueue.enqueue(nodeId, { reason: 'manual_retry' });

    return NextResponse.json({
      success: true,
      nodeId,
      message: 'Book enrichment queued',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue book enrichment',
      },
      { status: 500 },
    );
  }
}
