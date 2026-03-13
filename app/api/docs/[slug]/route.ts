import { NextResponse } from 'next/server';

import { readAppDoc } from '@/services/docs/docsService';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const doc = readAppDoc(slug);

    if (!doc) {
      return NextResponse.json({
        success: false,
        error: `Doc ${slug} not found`,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read doc',
    }, { status: 500 });
  }
}
