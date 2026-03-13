import { NextResponse } from 'next/server';

import { nodeService } from '@/services/database';
import { generateEdgeProposals } from '@/services/edges/proposals';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const proposals = await generateEdgeProposals(nodeId);

    return NextResponse.json({
      success: true,
      data: proposals,
      count: proposals.length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load edge proposals',
    }, { status: 500 });
  }
}
