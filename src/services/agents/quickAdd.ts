import { nodeService } from '@/services/database/nodes';
import { summarizeToolExecution } from './toolResultUtils';
import { youtubeExtractTool } from '@/tools/other/youtubeExtract';
import { websiteExtractTool } from '@/tools/other/websiteExtract';
import { paperExtractTool } from '@/tools/other/paperExtract';
import { podcastExtractTool } from '@/tools/other/podcastExtract';
import { formatNodeForChat } from '@/tools/infrastructure/nodeFormatter';
import { resolveQuickAddRouting, type QuickAddInputType, type QuickAddMode } from './quickAddDetection';
import { eventBroadcaster } from '@/services/events';
import { fetchBookMetadata } from '@/services/ingestion/bookMetadata';
import type { BookCommandParseResult } from '@/services/ingestion/bookCommand';
import { bookEnrichmentQueue } from '@/services/ingestion/bookEnrichmentQueue';
import { logBookTelemetry } from '@/services/analytics/bookTelemetry';
import { cacheBookCoverForNode } from '@/services/ingestion/bookCoverCache';
import { isReaderFormatValue, type ReaderFormatValue } from '@/lib/readerFormat';

export type { QuickAddMode, QuickAddInputType } from './quickAddDetection';
export { detectInputType } from './quickAddDetection';

export interface QuickAddInput {
  rawInput: string;
  mode?: QuickAddMode;
  description?: string;
  readerFormat?: ReaderFormatValue;
  baseUrl?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  append?: boolean;
  bookSelection?: {
    title: string;
    author?: string;
    isbn?: string;
    cover_url?: string;
    publisher?: string;
    first_published_year?: number;
    page_count?: number;
  };
}

function normalizeUrlLikeInput(raw: string): string {
  const input = raw.trim();
  if (!input) return input;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
  if (/\s/.test(input)) return input;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(input)) {
    return `https://${input}`;
  }
  return input;
}

function buildTaskPrompt(type: QuickAddInputType, input: string): string {
  switch (type) {
    case 'youtube':
      return `Quick Add: extract YouTube video and create node → ${input}`;
    case 'podcast':
      return `Quick Add: extract podcast episode and create node → ${input}`;
    case 'website':
      return `Quick Add: extract webpage and create node → ${input}`;
    case 'pdf':
      return `Quick Add: extract PDF and create node → ${input}`;
    case 'note':
      return `Quick Add note: create a node from this text with no dimensions → ${input}`;
    case 'chat':
      return `Quick Add: import chat transcript and summarize → ${input.slice(0, 120)}${input.length > 120 ? '…' : ''}`;
  }
}

type ExtractionQuickAddType = Extract<QuickAddInputType, 'youtube' | 'podcast' | 'website' | 'pdf'>;

const EXTRACTION_TOOL_MAP = {
  youtube: { toolName: 'youtubeExtract' as const, execute: youtubeExtractTool.execute },
  podcast: { toolName: 'podcastExtract' as const, execute: podcastExtractTool.execute },
  website: { toolName: 'websiteExtract' as const, execute: websiteExtractTool.execute },
  pdf: { toolName: 'paperExtract' as const, execute: paperExtractTool.execute },
};

interface SummaryParts {
  task: string;
  action: string;
  resultMessage: string;
  nodeReference: string;
}

interface ExtractionToolResultData {
  nodeId?: number;
  title?: string;
}

interface ExtractionToolResult {
  success?: boolean;
  error?: string;
  data?: ExtractionToolResultData | null;
  message?: string;
}

interface CreateNodeResponse {
  success?: boolean;
  data?: { id?: number; title?: string } | null;
  error?: string;
}

function buildStructuredSummary({ task, action, resultMessage, nodeReference }: SummaryParts): string {
  const normalizedResult = resultMessage?.trim().length ? resultMessage.trim() : `${action} completed.`;
  const normalizedNode = nodeReference || 'None';
  return [
    `Task: ${task}`,
    `Actions: ${action}`,
    `Result: ${normalizedResult}`,
    `Node: ${normalizedNode}`,
    'Context sources used: None',
    'Follow-up: None',
  ].join('\n');
}

function deriveNoteTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Quick Add Note';
  }
  const sentenceMatch = trimmed.match(/^(.{1,120}?)([.!?]\s|\n|$)/);
  const candidate = sentenceMatch ? sentenceMatch[1] : trimmed.slice(0, 120);
  const title = candidate.replace(/\s+/g, ' ').trim();
  return title.length >= trimmed.length || title.length <= 120 ? title : `${title.slice(0, 117)}…`;
}

function deriveChatTitle(raw: string, summarySubject?: string): string {
  if (summarySubject && summarySubject.trim().length > 0) {
    return summarySubject.trim();
  }

  const trimmed = raw.trim();
  if (!trimmed) return 'Chat Transcript';
  const firstLine = trimmed.split('\n')[0];
  const cleaned = firstLine.replace(/You said:|ChatGPT said:|Claude said:/gi, '').trim();
  if (!cleaned) return 'Chat Transcript';
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned;
}

function isExtractionToolResult(value: unknown): value is ExtractionToolResult {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if ('success' in candidate && typeof candidate.success !== 'boolean' && candidate.success !== undefined) {
    return false;
  }
  if ('error' in candidate && typeof candidate.error !== 'string' && candidate.error !== undefined && candidate.error !== null) {
    return false;
  }
  if ('data' in candidate && candidate.data !== undefined && candidate.data !== null && typeof candidate.data !== 'object') {
    return false;
  }
  return true;
}

function isCreateNodeResponse(value: unknown): value is CreateNodeResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if ('success' in candidate && typeof candidate.success !== 'boolean' && candidate.success !== undefined) {
    return false;
  }
  if ('error' in candidate && typeof candidate.error !== 'string' && candidate.error !== undefined && candidate.error !== null) {
    return false;
  }
  if ('data' in candidate && candidate.data !== undefined && candidate.data !== null && typeof candidate.data !== 'object') {
    return false;
  }
  return true;
}

async function handleExtractionQuickAdd(
  type: ExtractionQuickAddType,
  url: string,
  task: string,
  apiBaseUrl: string,
  readerFormat?: ReaderFormatValue,
): Promise<string> {
  const { toolName, execute } = EXTRACTION_TOOL_MAP[type];
  if (!execute) {
    throw new Error(`Tool ${toolName} does not have an execute function`);
  }
  const normalizedUrl = normalizeUrlLikeInput(url);
  const rawResult = await execute(
    { url: normalizedUrl, apiBaseUrl, ...(readerFormat ? { readerFormat } : {}) },
    { toolCallId: 'quickadd-extract', messages: [] }
  );

  if (!isExtractionToolResult(rawResult)) {
    throw new Error(`Unexpected response from ${toolName}`);
  }

  const toolResult = rawResult;

  if (!toolResult || toolResult.success === false) {
    const errorMessage = toolResult?.error || `Failed to execute ${toolName}`;
    throw new Error(errorMessage);
  }

  const summaryLine = summarizeToolExecution(toolName, { url: normalizedUrl }, toolResult);
  const nodeId = toolResult.data?.nodeId;
  const nodeTitle = typeof toolResult.data?.title === 'string' && toolResult.data.title.trim().length > 0
    ? toolResult.data.title.trim()
    : nodeId ? `Node ${nodeId}` : 'Created node';
  const nodeReference = nodeId ? formatNodeForChat({ id: nodeId, title: nodeTitle }) : 'None';

  return buildStructuredSummary({
    task,
    action: toolName,
    resultMessage: summaryLine,
    nodeReference,
  });
}

async function handleNoteQuickAdd(
  rawInput: string,
  task: string,
  userDescription: string | undefined,
  apiBaseUrl: string,
  readerFormat?: ReaderFormatValue,
  command?: BookCommandParseResult,
  bookSelection?: QuickAddInput['bookSelection'],
  sourceUrl?: string,
  sourceTitle?: string,
): Promise<string> {
  const trimmedInput = rawInput.trim();
  if (!trimmedInput) {
    throw new Error('Input is required to create a note');
  }

  // Append to existing node if sourceUrl matches
  if (sourceUrl) {
    const existing = await nodeService.getNodeByLink(sourceUrl);
    if (existing) {
      const updatedNotes = existing.notes
        ? `${existing.notes}\n\n---\n\n${trimmedInput}`
        : trimmedInput;
      const response = await fetch(`${apiBaseUrl}/api/nodes/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes }),
      });
      if (!response.ok) throw new Error('Failed to append to existing node');
      const nodeReference = formatNodeForChat({ id: existing.id, title: existing.title });
      return buildStructuredSummary({
        task,
        action: 'updateNode',
        resultMessage: `Appended highlight to ${nodeReference}.`,
        nodeReference,
      });
    }
  }

  const isBookCommand = command?.kind === 'book';
  const content = isBookCommand ? '' : trimmedInput;
  const title = isBookCommand ? command.title || deriveNoteTitle(trimmedInput) : deriveNoteTitle(trimmedInput);
  const bookMetadata = isBookCommand && !bookSelection
    ? await fetchBookMetadata({
      title: command.title || title,
      author: command.author,
      isbn: command.isbn,
    })
    : null;

  const nodePayload: Record<string, unknown> = {
    title,
    ...(content ? { notes: content } : {}),
    ...(sourceUrl ? { link: sourceUrl } : {}),
    ...(isBookCommand ? { dimensions: ['books'] } : {}),
    metadata: {
      source: 'quick-add-note',
      source_family: 'note',
      reader_format: readerFormat || 'raw',
      ...(sourceTitle ? { source_title: sourceTitle } : {}),
      refined_at: new Date().toISOString(),
      ...(isBookCommand ? {
        content_kind: 'book',
        book_detection_status: 'confirmed',
        book_metadata_status: bookSelection ? 'matched' : (command.needsConfirmation ? 'ambiguous' : 'pending'),
        book_match_confidence: bookSelection ? 1 : command.confidence,
        book_match_source: bookSelection
          ? 'manual'
          : command.isbn ? 'isbn' : command.author ? 'title_author' : 'title',
        cover_source: bookSelection?.cover_url ? 'remote' : 'generated',
        book_title: bookSelection?.title || command.title || title,
        book_author: bookSelection?.author || command.author,
        book_isbn: bookSelection?.isbn || command.isbn,
        book_publisher: bookSelection?.publisher,
        book_first_published_year: bookSelection?.first_published_year,
        book_page_count: bookSelection?.page_count,
        cover_url: bookSelection?.cover_url,
        cover_remote_url: bookSelection?.cover_url,
        book_match_candidates: [],
        ...bookMetadata,
      } : {}),
    },
  };

  // If user provided a description, use it instead of auto-generating
  if (userDescription && userDescription.trim()) {
    nodePayload.description = userDescription.trim();
  }

  const response = await fetch(`${apiBaseUrl}/api/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nodePayload),
  });

  const rawResult = await response.json();

  if (!isCreateNodeResponse(rawResult)) {
    throw new Error('Unexpected response from node creation');
  }

  if (!response.ok) {
    throw new Error(rawResult?.error || 'Failed to create note');
  }

  const nodeId = rawResult?.data?.id;
  if (isBookCommand && typeof nodeId === 'number' && !bookSelection) {
    bookEnrichmentQueue.enqueue(nodeId, { reason: 'quick_add_book' });
  }
  if (isBookCommand && typeof nodeId === 'number' && bookSelection?.cover_url) {
    try {
      await cacheBookCoverForNode(nodeId, bookSelection.cover_url);
    } catch (error) {
      console.warn('[QuickAdd] Failed to cache selected book cover', { nodeId, error });
    }
  }
  const nodeReference = nodeId ? formatNodeForChat({ id: nodeId, title }) : 'None';
  const resultMessage = nodeId ? `Created note ${nodeReference}.` : 'Created note.';

  return buildStructuredSummary({
    task,
    action: 'createNode',
    resultMessage,
    nodeReference,
  });
}

async function handleChatTranscriptQuickAdd(
  rawInput: string,
  task: string,
  apiBaseUrl: string,
  readerFormat?: ReaderFormatValue,
  sourceUrl?: string,
  sourceTitle?: string,
  append?: boolean,
): Promise<string> {
  const transcript = rawInput.trim();
  if (!transcript) {
    throw new Error('Input is required to import a chat transcript');
  }

  // Update existing node if sourceUrl matches
  if (sourceUrl) {
    const existing = await nodeService.getNodeByLink(sourceUrl);
    if (existing) {
      const existingMetadata =
        existing.metadata && typeof existing.metadata === 'object'
          ? (existing.metadata as Record<string, unknown>)
          : {};
      const existingReaderFormat = existingMetadata.reader_format;
      const normalizedReaderFormat = readerFormat
        || (isReaderFormatValue(existingReaderFormat) ? existingReaderFormat : 'chat');
      const patch = append
        // Selection: append to chunk with separator
        ? {
            chunk: existing.chunk ? `${existing.chunk}\n\n---\n\n${transcript}` : transcript,
            chunk_status: 'not_chunked',
            metadata: {
              ...existingMetadata,
              source_family: 'chat',
              reader_format: normalizedReaderFormat,
            },
          }
        // Full conversation: replace chunk entirely
        : {
            chunk: transcript,
            chunk_status: 'not_chunked',
            metadata: {
              ...existingMetadata,
              source_family: 'chat',
              reader_format: normalizedReaderFormat,
            },
          };
      const response = await fetch(`${apiBaseUrl}/api/nodes/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error('Failed to update existing chat node');
      const nodeReference = formatNodeForChat({ id: existing.id, title: existing.title });
      return buildStructuredSummary({
        task,
        action: 'updateNode',
        resultMessage: append ? `Appended selection to ${nodeReference}.` : `Updated source transcript for ${nodeReference}.`,
        nodeReference,
      });
    }
  }

  const title = sourceTitle?.trim() || deriveChatTitle(transcript);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  const metadata = {
    source: 'quick-add-chat',
    source_family: 'chat',
    reader_format: readerFormat || 'chat',
    transcript_length_chars: transcript.length,
    transcript_length_words: wordCount,
  };

  const response = await fetch(`${apiBaseUrl}/api/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      chunk: transcript,
      ...(sourceUrl ? { link: sourceUrl } : {}),
      metadata: {
        ...metadata,
        ...(sourceTitle ? { source_title: sourceTitle } : {}),
      },
    }),
  });

  const rawResult = await response.json();

  if (!isCreateNodeResponse(rawResult)) {
    throw new Error('Unexpected response from node creation');
  }

  if (!response.ok) {
    throw new Error(rawResult?.error || 'Failed to create chat transcript node');
  }

  const nodeId = rawResult?.data?.id;
  const nodeReference = nodeId ? formatNodeForChat({ id: nodeId, title }) : 'None';
  const resultMessage = nodeId ? `Created chat transcript ${nodeReference}.` : 'Created chat transcript.';

  return buildStructuredSummary({
    task,
    action: 'chatTranscriptImport',
    resultMessage,
    nodeReference,
  });
}

export interface QuickAddResult {
  id: string;
  task: string;
  inputType: QuickAddInputType;
  status: 'queued' | 'completed' | 'failed';
  summary?: string;
  error?: string;
}

function resolveApiBaseUrl(baseUrl?: string): string {
  const candidate = (baseUrl || process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (candidate.length > 0) {
    return candidate.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

export async function enqueueQuickAdd({
  rawInput,
  mode,
  description,
  readerFormat,
  baseUrl,
  bookSelection,
  sourceUrl,
  sourceTitle,
  append,
}: QuickAddInput): Promise<QuickAddResult> {
  const routing = resolveQuickAddRouting(rawInput, mode);
  const inputType = routing.inputType;
  if (rawInput.trim().startsWith('/')) {
    logBookTelemetry('command_detected', {
      commandKind: routing.command.kind,
      command: routing.command.kind === 'none' ? undefined : (routing.command as { command?: string }).command,
    });
    if (routing.command.kind === 'book') {
      logBookTelemetry('command_handled', { command: 'book' });
    } else if (routing.command.kind === 'unknown') {
      logBookTelemetry('command_fallback_note', {
        command: routing.command.command,
      });
    }
  }
  const task = buildTaskPrompt(inputType, rawInput);
  const id = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const apiBaseUrl = resolveApiBaseUrl(baseUrl);

  const result: QuickAddResult = {
    id,
    task,
    inputType,
    status: 'queued',
  };

  // Run async - fire and forget
  setImmediate(async () => {
    try {
      if (inputType === 'note') {
        await handleNoteQuickAdd(
          routing.normalizedInput,
          task,
          description,
          apiBaseUrl,
          readerFormat,
          routing.command,
          bookSelection,
          sourceUrl,
          sourceTitle
        );
      } else if (inputType === 'chat') {
        await handleChatTranscriptQuickAdd(rawInput, task, apiBaseUrl, readerFormat, sourceUrl, sourceTitle, append);
      } else {
        await handleExtractionQuickAdd(inputType as ExtractionQuickAddType, rawInput, task, apiBaseUrl, readerFormat);
      }

      console.log(`[QuickAdd] Completed: ${task}`);
      // Broadcast completion so ThreePanelLayout can remove the pending placeholder
      eventBroadcaster.broadcast({
        type: 'QUICK_ADD_COMPLETED',
        data: { quickAddId: id, source: 'quick-add' }
      });
      // Also broadcast NODE_CREATED to refresh the feed
      eventBroadcaster.broadcast({
        type: 'NODE_CREATED',
        data: { node: { title: task }, source: 'quick-add' }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`[QuickAdd] Failed: ${task} - ${message}`);
      eventBroadcaster.broadcast({
        type: 'QUICK_ADD_FAILED',
        data: { quickAddId: id, error: message, source: 'quick-add' }
      });
    }
  });

  return result;
}
