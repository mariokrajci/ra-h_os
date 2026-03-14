import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
  try {
    const name = decodeURIComponent(params.name);
    flagService.deleteFlag(name);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete flag' }, { status: 500 });
  }
}
