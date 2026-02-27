import { nodeService } from '@/services/database';
import { autoEmbedQueue } from '@/services/embedding/autoEmbedQueue';
import { extractWebsite } from '@/services/typescript/extractors/website';
import { extractYouTube } from '@/services/typescript/extractors/youtube';
import { extractPaper } from '@/services/typescript/extractors/paper';
import { generateSourceNotes } from './generateSourceNotes';

type FinalizerSource = 'website' | 'youtube' | 'pdf';

interface FinalizerParams {
  nodeId: number;
  title: string;
  url: string;
}

async function markFailed(nodeId: number, metadata: Record<string, unknown>) {
  await nodeService.updateNode(nodeId, {
    metadata: {
      ...metadata,
      source_status: 'failed',
      notes_status: 'failed',
    },
  });
}

async function writeSource(nodeId: number, sourceText: string, metadata: Record<string, unknown>) {
  await nodeService.updateNode(nodeId, {
    chunk: sourceText,
    chunk_status: 'not_chunked',
    metadata: {
      ...metadata,
      source_status: 'available',
      notes_status: 'processing',
    },
  });
}

async function writeNotes(
  nodeId: number,
  notes: string | null,
  metadata: Record<string, unknown>,
  reason: string,
) {
  await nodeService.updateNode(nodeId, {
    notes: notes || undefined,
    metadata: {
      ...metadata,
      source_status: 'available',
      notes_status: notes ? 'available' : 'failed',
    },
  });

  if (notes) {
    autoEmbedQueue.enqueue(nodeId, { reason });
  }
}

async function finalizeExtractedNode(
  sourceType: FinalizerSource,
  params: FinalizerParams,
  runExtraction: () => Promise<{ content: string; chunk: string; metadata?: Record<string, unknown> }>,
) {
  const node = await nodeService.getNodeById(params.nodeId);
  if (!node) return;

  const existingMetadata = (node.metadata || {}) as Record<string, unknown>;

  try {
    const result = await runExtraction();
    const sourceText = (result.chunk || result.content || '').trim();
    if (!sourceText) {
      await markFailed(params.nodeId, existingMetadata);
      return;
    }

    const enrichedMetadata = {
      ...existingMetadata,
      ...(result.metadata || {}),
      source: existingMetadata.source || sourceType,
    };

    await writeSource(params.nodeId, sourceText, enrichedMetadata);

    const notes = await generateSourceNotes({
      title: params.title,
      sourceType,
      sourceText,
      metadata: enrichedMetadata,
    });

    await writeNotes(params.nodeId, notes, enrichedMetadata, `${sourceType}_source_ready`);
  } catch (error) {
    console.error(`[${sourceType}] background finalization failed for node ${params.nodeId}:`, error);
    await markFailed(params.nodeId, existingMetadata);
  }
}

export async function finalizeWebsiteNode(params: FinalizerParams) {
  return finalizeExtractedNode('website', params, async () => {
    const result = await extractWebsite(params.url);
    return {
      content: result.content,
      chunk: result.chunk,
      metadata: {
        title: result.metadata.title,
        author: result.metadata.author,
        date: result.metadata.date,
        description: result.metadata.description,
        og_image: result.metadata.og_image,
        site_name: result.metadata.site_name,
        extraction_method: result.metadata.extraction_method || 'typescript',
        hostname: new URL(params.url).hostname,
        published_date: result.metadata.date,
        content_length: result.chunk.length,
      },
    };
  });
}

export async function finalizeYouTubeNode(params: FinalizerParams) {
  return finalizeExtractedNode('youtube', params, async () => {
    const result = await extractYouTube(params.url);
    if (!result.success) {
      throw new Error(result.error || 'Failed to extract YouTube content');
    }
    return {
      content: result.content,
      chunk: result.chunk,
      metadata: {
        video_id: result.metadata.video_id,
        channel_name: result.metadata.channel_name,
        channel_url: result.metadata.channel_url,
        thumbnail_url: result.metadata.thumbnail_url,
        transcript_length: result.metadata.transcript_length,
        total_segments: result.metadata.total_segments,
        language: result.metadata.language,
        extraction_method: result.metadata.extraction_method,
      },
    };
  });
}

export async function finalizePdfNode(params: FinalizerParams) {
  return finalizeExtractedNode('pdf', params, async () => {
    const result = await extractPaper(params.url);
    return {
      content: result.content,
      chunk: result.chunk,
      metadata: {
        title: result.metadata.title,
        pages: result.metadata.pages,
        info: result.metadata.info,
        text_length: result.metadata.text_length,
        filename: result.metadata.filename,
        extraction_method: result.metadata.extraction_method || 'typescript',
        hostname: new URL(params.url).hostname,
        author: result.metadata.author || result.metadata.info?.Author,
        file_size: result.metadata.file_size,
        content_length: result.chunk.length,
      },
    };
  });
}
