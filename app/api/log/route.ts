import { NextRequest, NextResponse } from 'next/server';
import { logService } from '@/services/database';

export const runtime = 'nodejs';

// GET /api/log?date=2026-03-05
export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ success: false, error: 'date is required' }, { status: 400 });
    }
    const entries = logService.getEntriesByDate(date);
    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

// POST /api/log  body: { date, content, order_idx? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, content, order_idx } = body;
    if (!date || content === undefined || content === null) {
      return NextResponse.json({ success: false, error: 'date and content are required' }, { status: 400 });
    }
    const entry = logService.createEntry({ date, content, order_idx });
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
