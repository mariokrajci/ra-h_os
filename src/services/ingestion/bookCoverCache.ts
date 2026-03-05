import { fileRegistryService } from '@/services/storage/fileRegistryService';
import { fileService } from '@/services/storage/fileService';

const MAX_COVER_BYTES = 8 * 1024 * 1024;

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export interface CachedCoverResult {
  path: string;
  mimeType: string;
  sizeBytes: number;
}

export async function cacheBookCoverForNode(nodeId: number, url: string): Promise<CachedCoverResult | null> {
  const sourceUrl = url.trim();
  if (!sourceUrl || !isHttpUrl(sourceUrl)) return null;

  const existing = await fileRegistryService.getFileRecordByNodeAndKind(nodeId, 'cover');
  if (existing && existing.status !== 'deleted') {
    const exists = await fileService.existsAtPath(existing.storage_path);
    if (exists) {
      return {
        path: existing.storage_path,
        mimeType: existing.mime_type,
        sizeBytes: existing.size_bytes,
      };
    }
    await fileRegistryService.markFileStatus(nodeId, 'cover', 'missing');
  }

  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 RA-H Cover Cache',
      Accept: 'image/*',
    },
  });

  if (!response.ok) return null;

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) return null;

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_COVER_BYTES) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_COVER_BYTES) return null;

  const saved = await fileService.save(nodeId, 'cover', buffer, { mimeType: contentType });
  await fileRegistryService.upsertFileRecord({
    nodeId,
    kind: 'cover',
    storagePath: saved.path,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
    sha256: saved.sha256,
    status: 'ready',
  });

  return {
    path: saved.path,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
  };
}
