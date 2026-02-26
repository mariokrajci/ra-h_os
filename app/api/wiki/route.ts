import { NextResponse } from 'next/server';
import { clearAllTopics } from '@/services/wiki/db';

export const runtime = 'nodejs';

export async function DELETE() {
  clearAllTopics();
  return NextResponse.json({ success: true });
}
