import { nodeService } from '@/services/database';
import { autoEmbedQueue } from '@/services/embedding/autoEmbedQueue';
import { extractWebsite } from '@/services/typescript/extractors/website';
import { extractYouTube } from '@/services/typescript/extractors/youtube';
import { extractPaper } from '@/services/typescript/extractors/paper';
import { buildSourceNotesInput } from './generateSourceNotes';
import { generateDescription } from '@/services/database/descriptionService';
import type { NodeMetadata } from '@/types/database';

type FinalizerSource = 'website' | 'youtube' | 'pdf';

interface FinalizerParams {
  nodeId: number;
  title: string;
  url: string;
}

type DisplayContract = Pick<NodeMetadata, 'source_family' | 'reader_format'>;

function getDisplayContract(sourceType: FinalizerSource): DisplayContract {
  switch (sourceType) {
    case 'website':
      return { source_family: 'website', reader_format: 'markdown' };
    case 'youtube':
      return { source_family: 'youtube', reader_format: 'transcript' };
    case 'pdf':
      return { source_family: 'pdf', reader_format: 'pdf' };
  }
}

function isPlaceholderTitle(title: string, sourceType: FinalizerSource): boolean {
  const normalized = title.trim();
  if (!normalized) return true;

  if (sourceType === 'website') {
    return /^Website:\s+/i.test(normalized) || /^[^/\s]+\/[^/\s]+$/.test(normalized);
  }

  if (sourceType === 'pdf') {
    return /^PDF:\s+/i.test(normalized) || /^PDF Document$/i.test(normalized);
  }

  return false;
}

function pickPromotedTitle(
  currentTitle: string,
  extractedTitle: unknown,
  sourceType: FinalizerSource,
): string | undefined {
  if (typeof extractedTitle !== 'string') return undefined;
  const normalizedExtracted = extractedTitle.trim().replace(/\s+/g, ' ').slice(0, 160);
  if (!normalizedExtracted) return undefined;
  if (normalizedExtracted === currentTitle.trim()) return undefined;
  if (!isPlaceholderTitle(currentTitle, sourceType)) return undefined;
  return normalizedExtracted;
}

async function markFailed(nodeId: number, metadata: Record<string, unknown>) {
  const sourceType = typeof metadata.source === 'string' ? metadata.source : undefined;
  const contract = sourceType === 'website' || sourceType === 'youtube' || sourceType === 'pdf'
    ? getDisplayContract(sourceType)
    : {};

  await nodeService.updateNode(nodeId, {
    metadata: {
      ...metadata,
      ...contract,
      source_status: 'failed',
      notes_status: 'failed',
    },
  });
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

    const displayContract = getDisplayContract(sourceType);
    const sourceFamily = (existingMetadata.source_family as NodeMetadata['source_family']) || displayContract.source_family;
    const readerFormat = existingMetadata.reader_format ?? displayContract.reader_format;
    const enrichedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      ...(result.metadata || {}),
      source: existingMetadata.source || sourceType,
      source_family: sourceFamily,
      reader_format: readerFormat,
    };

    const promotedTitle = pickPromotedTitle(node.title || params.title, enrichedMetadata.title, sourceType);

    const updatedNode = await nodeService.updateNode(params.nodeId, {
      title: promotedTitle,
      chunk: sourceText,
      chunk_status: 'not_chunked',
      metadata: {
        ...(() => {
          const { notes_status: _notesStatus, ...metadataWithoutNotesStatus } = enrichedMetadata as Record<string, unknown> & {
            notes_status?: unknown;
          };
          return metadataWithoutNotesStatus;
        })(),
        source_status: 'available',
      },
    });
    autoEmbedQueue.enqueue(params.nodeId, { reason: `${sourceType}_source_ready` });

    // Generate description now that content is available
    try {
      const description = await generateDescription({
        title: updatedNode.title || params.title,
        notes: sourceText,
        link: params.url,
        metadata: enrichedMetadata as { source?: string; channel_name?: string; author?: string; site_name?: string },
        dimensions: updatedNode.dimensions || [],
      });
      await nodeService.updateNode(params.nodeId, { description });
    } catch (err) {
      console.error(`[${sourceType}] description generation failed for node ${params.nodeId}:`, err);
    }
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
        source_family: 'website',
        reader_format: 'markdown',
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
        source_family: 'youtube',
        reader_format: 'transcript',
      },
    };
  });
}

export async function finalizePdfNode(params: FinalizerParams) {
  return finalizeExtractedNode('pdf', params, async () => {
    const result = await extractPaper(params.url);
    const notesInput = buildSourceNotesInput({
      sourceType: 'pdf',
      sourceText: result.chunk,
    });

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
        renderable_pages: result.metadata.renderable_pages,
        page_data: result.metadata.page_data,
        annotation_count: result.metadata.annotation_count,
        notes_generation_strategy: notesInput.strategy,
        notes_generation_sections: notesInput.sectionTitles,
        content_length: result.chunk.length,
        file_type: 'pdf',
        source_family: 'pdf',
        reader_format: 'pdf',
      },
    };
  });
}
