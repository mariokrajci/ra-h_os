import { NextRequest, NextResponse } from 'next/server';
import { logService } from '@/services/database';

export const runtime = 'nodejs';

type LogRouteContext = { params: Promise<{ id: string }> };

// PATCH /api/log/[id]  body: { content?, order_idx? }
export async function PATCH(request: NextRequest, { params }: LogRouteContext) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });

    const existing = logService.getEntryById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Log entry not found' }, { status: 404 });
    }

    const body = await request.json();

    if (body.content === undefined && body.order_idx === undefined) {
      return NextResponse.json(
        { success: false, error: 'At least one of content or order_idx is required' },
        { status: 400 }
      );
    }

    if (body.content !== undefined) {
      logService.updateEntry(id, body.content);
    }
    if (body.order_idx !== undefined) {
      logService.reorderEntry(id, body.order_idx);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// DELETE /api/log/[id]
export async function DELETE(_request: NextRequest, { params }: LogRouteContext) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });

    const existing = logService.getEntryById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Log entry not found' }, { status: 404 });
    }

    logService.deleteEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
