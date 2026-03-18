import { NextRequest, NextResponse } from 'next/server';
import { fetchBookMetadata } from '@/services/ingestion/bookMetadata';
import { bookEnrichmentQueue } from '@/services/ingestion/bookEnrichmentQueue';
import { fileRegistryService } from '@/services/storage/fileRegistryService';
import { fileService } from '@/services/storage/fileService';
import { extractEpubFromBuffer } from '@/services/typescript/extractors/epub';
import { isReaderFormatValue } from '@/lib/readerFormat';

export const runtime = 'nodejs';

const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const readerFormatRaw = formData.get('readerFormat');
    const readerFormat = isReaderFormatValue(readerFormatRaw) ? readerFormatRaw : undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'EPUB file is required' },
        { status: 400 },
      );
    }

    const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');
    if (!isEpub) {
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${file.type || file.name}. Only EPUB files are accepted.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 50MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractEpubFromBuffer(buffer, file.name);
    const title = extraction.metadata.title || file.name.replace(/\.epub$/i, '');

    const createResponse = await fetch(new URL('/api/nodes', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        type: 'book',
        dimensions: ['books'],
        content: extraction.content,
        chunk: extraction.chunk,
        metadata: {
          source: 'epub_upload',
          source_family: 'epub',
          reader_format: readerFormat || 'epub',
          original_filename: file.name,
          chapter_count: extraction.metadata.chapter_count,
          text_length: extraction.metadata.text_length,
          extraction_method: extraction.metadata.extraction_method,
          imported_at: new Date().toISOString(),
        },
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create node: ${createResponse.status}`);
    }

    const nodeResult = await createResponse.json();
    if (!nodeResult.success || !nodeResult.data?.id) {
      throw new Error(nodeResult.error || 'Failed to create node');
    }

    const nodeId = nodeResult.data.id;
    const storedFile = await fileService.save(nodeId, 'epub', buffer);
    await fileRegistryService.upsertFileRecord({
      nodeId,
      kind: 'epub',
      storagePath: storedFile.path,
      mimeType: storedFile.mimeType,
      sizeBytes: storedFile.sizeBytes,
      sha256: storedFile.sha256,
      status: 'ready',
    });
    const bookMetadata = await fetchBookMetadata({
      title,
      author: extraction.metadata.author,
      isbn: extraction.metadata.isbn,
    });

    const patchResponse = await fetch(new URL(`/api/nodes/${nodeId}`, request.url).toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata: {
          source: 'epub_upload',
          source_family: 'epub',
          reader_format: readerFormat || 'epub',
          original_filename: file.name,
          chapter_count: extraction.metadata.chapter_count,
          text_length: extraction.metadata.text_length,
          extraction_method: extraction.metadata.extraction_method,
          imported_at: new Date().toISOString(),
          file_type: 'epub',
          file_path: storedFile.path,
          ...bookMetadata,
        },
      }),
    });

    if (!patchResponse.ok) {
      const patchError = await patchResponse.json().catch(() => ({}));
      throw new Error(patchError.error || `Failed to finalize uploaded EPUB node: ${patchResponse.status}`);
    }

    bookEnrichmentQueue.enqueue(nodeId, { reason: 'epub_upload' });

    return NextResponse.json({
      success: true,
      nodeId,
      title,
      chapterCount: extraction.metadata.chapter_count,
      textLength: extraction.metadata.text_length,
    });
  } catch (error) {
    console.error('[EPUB Upload API] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process EPUB upload';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
