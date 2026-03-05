import type { NodeMetadata } from '@/types/database';

export interface BookMatchCandidate {
  title: string;
  author?: string;
  isbn?: string;
  cover_url?: string;
}

function isCoverLocked(metadata: NodeMetadata): boolean {
  return metadata.cover_source === 'manual' || metadata.book_metadata_locked?.cover === true;
}

export function getFirstBookMatchCandidate(metadata?: NodeMetadata | null): BookMatchCandidate | null {
  const candidate = metadata?.book_match_candidates?.[0];
  if (!candidate || typeof candidate.title !== 'string' || !candidate.title.trim()) {
    return null;
  }

  return {
    title: candidate.title,
    author: candidate.author,
    isbn: candidate.isbn,
    cover_url: candidate.cover_url,
  };
}

export function applyBookMatchCandidate(
  metadata: NodeMetadata,
  candidate: BookMatchCandidate,
): NodeMetadata {
  const next: NodeMetadata = {
    ...metadata,
    content_kind: 'book',
    book_title: candidate.title,
    book_author: candidate.author,
    book_isbn: candidate.isbn,
    book_metadata_status: 'matched',
    book_match_source: 'manual',
    book_match_confidence: 1,
    book_match_candidates: [],
  };

  if (candidate.cover_url && !isCoverLocked(metadata)) {
    next.cover_url = candidate.cover_url;
    next.cover_source = 'remote';
    next.cover_fetched_at = new Date().toISOString();
  }

  return next;
}
