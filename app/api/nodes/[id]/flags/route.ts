import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = parseInt(params.id, 10);
    if (isNaN(nodeId)) return NextResponse.json({ success: false, error: 'Invalid node id' }, { status: 400 });
    const flags = flagService.getNodeFlags(nodeId);
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch node flags' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = parseInt(params.id, 10);
    if (isNaN(nodeId)) return NextResponse.json({ success: false, error: 'Invalid node id' }, { status: 400 });
    const { flag } = await request.json();
    if (!flag || typeof flag !== 'string') {
      return NextResponse.json({ success: false, error: 'flag is required' }, { status: 400 });
    }
    flagService.assignFlag(nodeId, flag);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to assign flag' }, { status: 500 });
  }
}
