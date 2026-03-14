import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function GET() {
  try {
    const flags = flagService.getAllFlags();
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch flags' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, color = '#6b7280' } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    const flag = flagService.createFlag(name.trim(), color);
    return NextResponse.json({ success: true, flag }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create flag' }, { status: 500 });
  }
}
