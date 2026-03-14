import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { generateSourceNotes, buildSourceNotesInput } from '@/services/ingestion/generateSourceNotes';

export const runtime = 'nodejs';

type NodeRouteContext = { params: Promise<{ id: string }> };

export async function POST(
  _request: NextRequest,
  { params }: NodeRouteContext
) {
  try {
    const { id } = await params;
    const nodeId = parseInt(id, 10);

    if (isNaN(nodeId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid node ID',
      }, { status: 400 });
    }

    const node = await nodeService.getNodeById(nodeId);
    if (!node) {
      return NextResponse.json({
        success: false,
        error: 'Node not found',
      }, { status: 404 });
    }

    const sourceText = typeof node.chunk === 'string' ? node.chunk.trim() : '';
    if (!sourceText) {
      return NextResponse.json({
        success: false,
        error: 'Source content is required to generate notes',
      }, { status: 400 });
    }

    const sourceType = typeof node.metadata?.source === 'string' ? node.metadata.source : 'website';
    const notes = await generateSourceNotes({
      title: node.title,
      sourceType,
      sourceText,
      metadata: node.metadata ?? undefined,
    });

    if (!notes) {
      return NextResponse.json({
        success: false,
        error: 'Could not generate notes from this source',
      }, { status: 422 });
    }

    const notesInput = buildSourceNotesInput({
      title: node.title,
      sourceType,
      sourceText,
      metadata: node.metadata ?? undefined,
    });

    const updatedNode = await nodeService.updateNode(nodeId, {
      notes,
      metadata: {
        ...(node.metadata ?? {}),
        notes_status: 'available',
        notes_generation_strategy: notesInput.strategy,
        notes_generation_sections: notesInput.sectionTitles,
      },
    });

    return NextResponse.json({
      success: true,
      node: updatedNode,
      notes,
    });
  } catch (error) {
    console.error('Error generating notes from source:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate notes from source',
    }, { status: 500 });
  }
}
