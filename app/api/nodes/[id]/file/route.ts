import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { fileExists, readFile } from '@/services/storage/fileStorage';

export const runtime = 'nodejs';

function inferRemoteFileType(link?: string): 'pdf' | 'epub' | null {
  if (!link) return null;
  if (link.match(/\.pdf($|\?)/i) || link.includes('arxiv.org')) return 'pdf';
  if (link.match(/\.epub($|\?)/i)) return 'epub';
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const nodeId = parseInt(id, 10);

    if (isNaN(nodeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid node ID' },
        { status: 400 },
      );
    }

    const node = await nodeService.getNodeById(nodeId);
    if (!node) {
      return NextResponse.json(
        { success: false, error: 'Node not found' },
        { status: 404 },
      );
    }

    const fileType = node.metadata?.file_type;
    if (fileType === 'pdf' || fileType === 'epub') {
      if (!(await fileExists(nodeId, fileType))) {
        return NextResponse.json(
          { success: false, error: 'Stored file not found' },
          { status: 404 },
        );
      }

      const buffer = await readFile(nodeId, fileType);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip',
          'Content-Length': buffer.byteLength.toString(),
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    const remoteFileType = inferRemoteFileType(node.link);
    if (!remoteFileType || !node.link) {
      return NextResponse.json(
        { success: false, error: 'Node does not have a readable document source' },
        { status: 404 },
      );
    }

    const remoteResponse = await fetch(node.link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 RA-H Reader',
      },
    });

    if (!remoteResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch remote document (${remoteResponse.status})` },
        { status: 502 },
      );
    }

    const buffer = Buffer.from(await remoteResponse.arrayBuffer());

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': remoteResponse.headers.get('content-type') || (remoteFileType === 'pdf' ? 'application/pdf' : 'application/epub+zip'),
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Error serving node file:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to serve node file',
      },
      { status: 500 },
    );
  }
}
