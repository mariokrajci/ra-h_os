import { nodeService } from '@/services/database';
import { logBookTelemetry } from '@/services/analytics/bookTelemetry';
import { createOpenLibraryBookLookupProvider, lookupBookMetadata } from './bookLookup';

interface BookEnrichmentTask {
  nodeId: number;
  reason?: string;
}

export type BookEnrichmentOutcome = 'matched' | 'ambiguous' | 'failed' | 'skipped';

const openLibraryProvider = createOpenLibraryBookLookupProvider();

function shouldLockField(metadata: Record<string, unknown>, field: 'title' | 'author' | 'isbn' | 'cover'): boolean {
  const locks = metadata.book_metadata_locked;
  if (!locks || typeof locks !== 'object' || Array.isArray(locks)) return false;
  const value = (locks as Record<string, unknown>)[field];
  return value === true;
}

export async function enrichBookNode(nodeId: number): Promise<BookEnrichmentOutcome> {
  const node = await nodeService.getNodeById(nodeId);
  if (!node) return 'skipped';

  const metadata = (node.metadata || {}) as Record<string, unknown>;
  if (metadata.content_kind !== 'book') {
    return 'skipped';
  }

  const currentTitle = typeof metadata.book_title === 'string' ? metadata.book_title : node.title;
  const currentAuthor = typeof metadata.book_author === 'string' ? metadata.book_author : undefined;
  const currentIsbn = typeof metadata.book_isbn === 'string' ? metadata.book_isbn : undefined;

  logBookTelemetry('book_enrichment_started', { nodeId });

  const lookup = await lookupBookMetadata(
    {
      title: currentTitle,
      author: currentAuthor,
      isbn: currentIsbn,
    },
    openLibraryProvider,
  );

  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    content_kind: 'book',
    book_metadata_status: lookup.status,
    book_match_confidence: lookup.confidence,
    book_match_source: lookup.matchSource,
  };

  const candidate = lookup.candidate;
  if (candidate) {
    if (!shouldLockField(metadata, 'title') && candidate.title) {
      nextMetadata.book_title = candidate.title;
    }
    if (!shouldLockField(metadata, 'author') && candidate.author) {
      nextMetadata.book_author = candidate.author;
    }
    if (!shouldLockField(metadata, 'isbn') && candidate.isbn) {
      nextMetadata.book_isbn = candidate.isbn;
    }

    const hasManualCover = metadata.cover_source === 'manual';
    const coverLocked = shouldLockField(metadata, 'cover');
    if (lookup.status === 'matched' && candidate.coverUrl && !hasManualCover && !coverLocked) {
      nextMetadata.cover_url = candidate.coverUrl;
      nextMetadata.cover_source = 'remote';
      nextMetadata.cover_fetched_at = new Date().toISOString();
    }

    if (lookup.status === 'ambiguous') {
      nextMetadata.book_match_candidates = [
        {
          title: candidate.title,
          author: candidate.author,
          isbn: candidate.isbn,
          cover_url: candidate.coverUrl,
        },
      ];
    } else {
      nextMetadata.book_match_candidates = [];
    }
  } else {
    nextMetadata.book_match_candidates = [];
  }

  await nodeService.updateNode(nodeId, {
    metadata: nextMetadata,
  });

  if (lookup.status === 'matched') {
    logBookTelemetry('book_enrichment_matched', { nodeId, matchSource: lookup.matchSource, confidence: lookup.confidence });
  } else if (lookup.status === 'ambiguous') {
    logBookTelemetry('book_enrichment_ambiguous', { nodeId, matchSource: lookup.matchSource, confidence: lookup.confidence });
  } else {
    logBookTelemetry('book_enrichment_failed', { nodeId });
  }

  return lookup.status;
}

export class BookEnrichmentQueue {
  private readonly pending = new Set<number>();
  private readonly running = new Set<number>();

  enqueue(nodeId: number, task: Omit<BookEnrichmentTask, 'nodeId'> = {}): boolean {
    const _task = { nodeId, ...task };
    if (this.pending.has(nodeId) || this.running.has(nodeId)) {
      return false;
    }

    this.pending.add(nodeId);
    setImmediate(() => {
      this.process(nodeId).catch((error) => {
        console.error('[BookEnrichmentQueue] Task failed', nodeId, error);
      });
    });

    return true;
  }

  private async process(nodeId: number) {
    if (!this.pending.has(nodeId)) return;
    this.pending.delete(nodeId);
    this.running.add(nodeId);

    try {
      await enrichBookNode(nodeId);
    } finally {
      this.running.delete(nodeId);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var bookEnrichmentQueue: BookEnrichmentQueue | undefined;
}

export const bookEnrichmentQueue = globalThis.bookEnrichmentQueue ?? new BookEnrichmentQueue();
if (!globalThis.bookEnrichmentQueue) {
  globalThis.bookEnrichmentQueue = bookEnrichmentQueue;
}
