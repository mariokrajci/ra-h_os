import type { NodeMetadata } from '@/types/database';

export interface BookMatchCandidate {
  title: string;
  author?: string;
  isbn?: string;
  cover_url?: string;
  publisher?: string;
  first_published_year?: number;
  page_count?: number;
}

function isCoverLocked(metadata: NodeMetadata): boolean {
  return metadata.cover_source === 'manual' || metadata.book_metadata_locked?.cover === true;
}

export function getFirstBookMatchCandidate(metadata?: NodeMetadata | null): BookMatchCandidate | null {
  const candidate = getBookMatchCandidates(metadata)[0];
  if (!candidate || typeof candidate.title !== 'string' || !candidate.title.trim()) {
    return null;
  }

  return {
    title: candidate.title,
    author: candidate.author,
    isbn: candidate.isbn,
    cover_url: candidate.cover_url,
    publisher: candidate.publisher,
    first_published_year: candidate.first_published_year,
    page_count: candidate.page_count,
  };
}

export function getBookMatchCandidates(metadata?: NodeMetadata | null): BookMatchCandidate[] {
  const candidates = metadata?.book_match_candidates;
  if (!Array.isArray(candidates)) return [];

  return candidates
    .filter((candidate) => candidate && typeof candidate.title === 'string' && candidate.title.trim().length > 0)
    .map((candidate) => ({
      title: candidate.title,
      author: candidate.author,
      isbn: candidate.isbn,
      cover_url: candidate.cover_url,
      publisher: candidate.publisher,
      first_published_year: candidate.first_published_year,
      page_count: candidate.page_count,
    }));
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
    book_publisher: candidate.publisher,
    book_first_published_year: candidate.first_published_year,
    book_page_count: candidate.page_count,
    book_metadata_status: 'matched',
    book_match_source: 'manual',
    book_match_confidence: 1,
    book_match_candidates: [],
  };

  if (candidate.cover_url && !isCoverLocked(metadata)) {
    next.cover_url = candidate.cover_url;
    next.cover_remote_url = candidate.cover_url;
    next.cover_source = 'remote';
    next.cover_fetched_at = new Date().toISOString();
  }

  return next;
}
