import { NextRequest, NextResponse } from 'next/server';
import { logService } from '@/services/database';

export const runtime = 'nodejs';

type LogRouteContext = { params: Promise<{ id: string }> };

// POST /api/log/[id]/promote
export async function POST(_request: NextRequest, { params }: LogRouteContext) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });

    const existing = logService.getEntryById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Log entry not found' }, { status: 404 });
    }

    const nodeId = logService.promoteEntry(id);
    return NextResponse.json({ success: true, data: { nodeId } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
