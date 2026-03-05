import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { fileRegistryService } from '@/services/storage/fileRegistryService';
import { fileService } from '@/services/storage/fileService';
import type { StoredFileType } from '@/services/storage/fileStorage';

export const runtime = 'nodejs';

function inferRemoteFileType(link?: string): 'pdf' | 'epub' | null {
  if (!link) return null;
  if (link.match(/\.pdf($|\?)/i) || link.includes('arxiv.org')) return 'pdf';
  if (link.match(/\.epub($|\?)/i)) return 'epub';
  return null;
}

function inferStoredFileType(metadata?: Record<string, unknown> | null): 'pdf' | 'epub' | null {
  const fileType = metadata?.file_type;
  if (fileType === 'pdf' || fileType === 'epub') return fileType;

  const source = typeof metadata?.source === 'string' ? metadata.source.toLowerCase() : '';
  if (source.includes('pdf')) return 'pdf';
  if (source.includes('epub')) return 'epub';
  return null;
}

function inferRequestedFileType(
  metadata?: Record<string, unknown> | null,
  link?: string,
): StoredFileType | null {
  return inferStoredFileType(metadata) ?? inferRemoteFileType(link);
}

function jsonError(
  status: number,
  code: string,
  message: string,
  nodeId?: number,
  kind?: StoredFileType,
) {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      node_id: nodeId,
      kind,
      error: message,
    },
    { status },
  );
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

    const requestedType = inferRequestedFileType(node.metadata, node.link);
    if (requestedType) {
      const registryRecord = await fileRegistryService.getFileRecordByNodeAndKind(nodeId, requestedType);
      if (registryRecord && registryRecord.status !== 'deleted') {
        const pathExists = await fileService.existsAtPath(registryRecord.storage_path);
        if (!pathExists) {
          await fileRegistryService.markFileStatus(nodeId, requestedType, 'missing');
          return jsonError(
            409,
            'FILE_MISSING_ON_DISK',
            'File record exists but file is missing on disk',
            nodeId,
            requestedType,
          );
        }

        const buffer = await fileService.readAtPath(registryRecord.storage_path);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': registryRecord.mime_type,
            'Content-Length': buffer.byteLength.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });
      }

      // Legacy compatibility fallback (node-id derived storage path)
      if (await fileService.exists(nodeId, requestedType)) {
        const buffer = await fileService.read(nodeId, requestedType);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': requestedType === 'pdf' ? 'application/pdf' : 'application/epub+zip',
            'Content-Length': buffer.byteLength.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });
      }
    }

    const remoteFileType = inferRemoteFileType(node.link);
    if (!remoteFileType || !node.link) {
      return jsonError(404, 'NO_DOCUMENT_SOURCE', 'Node does not have a readable document source', nodeId);
    }

    let remoteResponse: Response;
    try {
      remoteResponse = await fetch(node.link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 RA-H Reader',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      return jsonError(
        502,
        'REMOTE_FETCH_FAILED',
        `Failed to fetch remote document: ${message}`,
        nodeId,
        remoteFileType,
      );
    }

    if (!remoteResponse.ok) {
      return jsonError(
        502,
        'REMOTE_FETCH_FAILED',
        `Failed to fetch remote document (${remoteResponse.status})`,
        nodeId,
        remoteFileType,
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
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to serve node file',
        error: error instanceof Error ? error.message : 'Failed to serve node file',
      },
      { status: 500 },
    );
  }
}
