import { NextResponse } from 'next/server';
import { logService } from '@/services/database';

export const runtime = 'nodejs';

// GET /api/log/dates
export async function GET() {
  try {
    const dates = logService.getDatesWithEntries();
    return NextResponse.json({ success: true, data: dates });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
