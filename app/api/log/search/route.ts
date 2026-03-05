import { NextRequest, NextResponse } from 'next/server';
import { logService } from '@/services/database';

export const runtime = 'nodejs';

// GET /api/log/search?q=...
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q') ?? '';
    if (!q.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }
    const results = logService.searchEntries(q);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
