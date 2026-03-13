import { NextResponse } from 'next/server';

import { nodeService } from '@/services/database';
import { proposalDismissalService } from '@/services/edges/proposalDismissals';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const nodeId = Number.parseInt(id, 10);

    if (!Number.isFinite(nodeId) || nodeId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid node id',
      }, { status: 400 });
    }

    const node = await nodeService.getNodeById(nodeId);
    if (!node) {
      return NextResponse.json({
        success: false,
        error: `Node ${nodeId} not found`,
      }, { status: 404 });
    }

    const body = await request.json();
    const targetNodeId = Number(body?.target_node_id);

    if (!Number.isFinite(targetNodeId) || targetNodeId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'target_node_id must be a positive integer',
      }, { status: 400 });
    }

    await proposalDismissalService.dismissProposal(nodeId, targetNodeId);

    return NextResponse.json({
      success: true,
      data: {
        source_node_id: nodeId,
        target_node_id: targetNodeId,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dismiss edge proposal',
    }, { status: 500 });
  }
}
