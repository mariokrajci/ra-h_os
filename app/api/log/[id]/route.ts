import { NextRequest, NextResponse } from 'next/server';
import { logService } from '@/services/database';

export const runtime = 'nodejs';

// PATCH /api/log/[id]  body: { content?, order_idx? }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });

    const body = await request.json();
    if (body.content !== undefined) {
      logService.updateEntry(id, body.content);
    }
    if (body.order_idx !== undefined) {
      logService.reorderEntry(id, body.order_idx);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/log/[id]
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    logService.deleteEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
