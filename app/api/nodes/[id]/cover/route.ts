import { NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { fileRegistryService } from '@/services/storage/fileRegistryService';
import { fileService } from '@/services/storage/fileService';
import { cacheBookCoverForNode } from '@/services/ingestion/bookCoverCache';

export const runtime = 'nodejs';

function isHttpUrl(url?: string): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

function parseDataUrl(dataUrl?: string): { mimeType: string; buffer: Buffer } | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const payload = match[3] || '';
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  return { mimeType, buffer };
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const nodeId = parseInt(id, 10);
    if (Number.isNaN(nodeId)) {
      return jsonError(400, 'Invalid node ID');
    }

    const node = await nodeService.getNodeById(nodeId);
    if (!node) {
      return jsonError(404, 'Node not found');
    }

    const existing = await fileRegistryService.getFileRecordByNodeAndKind(nodeId, 'cover');
    if (existing && existing.status !== 'deleted') {
      const exists = await fileService.existsAtPath(existing.storage_path);
      if (exists) {
        const buffer = await fileService.readAtPath(existing.storage_path);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': existing.mime_type,
            'Content-Length': buffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
      await fileRegistryService.markFileStatus(nodeId, 'cover', 'missing');
    }

    const metadata = node.metadata || {};
    const sourceUrl = isHttpUrl(typeof metadata.cover_remote_url === 'string' ? metadata.cover_remote_url : undefined)
      ? (metadata.cover_remote_url as string)
      : (isHttpUrl(typeof metadata.cover_url === 'string' ? metadata.cover_url : undefined)
        ? (metadata.cover_url as string)
        : undefined);

    if (sourceUrl) {
      const cached = await cacheBookCoverForNode(nodeId, sourceUrl);
      if (cached) {
        await nodeService.updateNode(nodeId, {
          metadata: {
            ...metadata,
            cover_remote_url: sourceUrl,
          },
        });
        const buffer = await fileService.readAtPath(cached.path);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': cached.mimeType,
            'Content-Length': buffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    const inlined = parseDataUrl(typeof metadata.cover_url === 'string' ? metadata.cover_url : undefined);
    if (inlined) {
      return new NextResponse(new Uint8Array(inlined.buffer), {
        headers: {
          'Content-Type': inlined.mimeType,
          'Content-Length': inlined.buffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return jsonError(404, 'Cover not available');
  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : 'Failed to serve cover');
  }
}
