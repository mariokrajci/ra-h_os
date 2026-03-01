import { NextRequest, NextResponse } from 'next/server';
import { annotationService, nodeService } from '@/services/database';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const nodeId = parseInt(request.nextUrl.searchParams.get('nodeId') ?? '', 10);
    if (isNaN(nodeId)) {
      return NextResponse.json({ success: false, error: 'Invalid nodeId' }, { status: 400 });
    }
    const data = annotationService.getAnnotationsForNode(nodeId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { node_id, text, color, comment, start_offset } = body;

    if (!node_id || !text || !color) {
      return NextResponse.json({ success: false, error: 'node_id, text and color are required' }, { status: 400 });
    }

    const validColors = ['yellow', 'red', 'blue', 'green'];
    if (!validColors.includes(color)) {
      return NextResponse.json({ success: false, error: 'Invalid color' }, { status: 400 });
    }

    // Fetch node to get current source
    const node = await nodeService.getNodeById(node_id);
    const sourceText = node?.chunk ?? '';

    // Compute occurrence_index from the canonical source offset
    const offset = typeof start_offset === 'number' ? start_offset : 0;
    const sourceBefore = sourceText.slice(0, offset).toLowerCase();
    const searchLower = text.toLowerCase();
    let occurrence_index = 0;
    let pos = 0;
    while (pos < sourceBefore.length) {
      const idx = sourceBefore.indexOf(searchLower, pos);
      if (idx === -1) break;
      occurrence_index++;
      pos = idx + 1;
    }

    // Create annotation and update notes atomically
    const annotation = annotationService.createAnnotationWithNotes({
      node_id,
      text,
      color,
      comment,
      occurrence_index,
    });

    return NextResponse.json({ success: true, annotation });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
