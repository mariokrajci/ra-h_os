import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_FILES = new Set(['pdf.mjs', 'pdf.worker.mjs']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await params;

    if (!ALLOWED_FILES.has(file)) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const assetPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', file);
    const source = await fs.readFile(assetPath, 'utf8');

    return new NextResponse(source, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load PDF.js asset',
      },
      { status: 500 },
    );
  }
}
