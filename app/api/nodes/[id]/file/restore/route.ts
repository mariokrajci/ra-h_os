import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { fileRegistryService } from '@/services/storage/fileRegistryService';
import { fileService } from '@/services/storage/fileService';
import type { StoredFileType } from '@/services/storage/fileStorage';

export const runtime = 'nodejs';

function inferKind(file: File): StoredFileType | null {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub')) return 'epub';
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const nodeId = parseInt(id, 10);

    if (Number.isNaN(nodeId)) {
      return NextResponse.json({ success: false, error: 'Invalid node ID' }, { status: 400 });
    }

    const node = await nodeService.getNodeById(nodeId);
    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 });
    }

    const kind = inferKind(file);
    if (!kind) {
      return NextResponse.json({ success: false, error: 'Only PDF or EPUB files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await fileService.save(nodeId, kind, buffer);

    await fileRegistryService.upsertFileRecord({
      nodeId,
      kind,
      storagePath: saved.path,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      sha256: saved.sha256,
      status: 'ready',
    });

    await nodeService.updateNode(nodeId, {
      metadata: {
        ...(node.metadata || {}),
        file_type: kind,
        file_path: saved.path,
      },
    });

    return NextResponse.json({
      success: true,
      nodeId,
      kind,
      message: 'File restored successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore file',
      },
      { status: 500 },
    );
  }
}
