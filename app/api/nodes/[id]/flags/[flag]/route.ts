import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function DELETE(_req: Request, { params }: { params: { id: string; flag: string } }) {
  try {
    const nodeId = parseInt(params.id, 10);
    if (isNaN(nodeId)) return NextResponse.json({ success: false, error: 'Invalid node id' }, { status: 400 });
    const flag = decodeURIComponent(params.flag);
    flagService.removeFlag(nodeId, flag);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to remove flag' }, { status: 500 });
  }
}
