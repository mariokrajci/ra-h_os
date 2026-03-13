import { NextResponse } from 'next/server';

import { listAppDocs } from '@/services/docs/docsService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: listAppDocs(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list docs',
    }, { status: 500 });
  }
}
