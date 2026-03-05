import { classifyBookMatchConfidence } from './bookConfidence';

export interface BookLookupInput {
  title?: string;
  author?: string;
  isbn?: string;
}

export interface BookLookupCandidate {
  title: string;
  author?: string;
  isbn?: string;
  coverUrl?: string;
  confidence: number;
}

export interface BookLookupProvider {
  lookupByIsbn: (isbn: string) => Promise<BookLookupCandidate | null>;
  lookupByTitleAuthor: (title: string, author?: string) => Promise<BookLookupCandidate | null>;
  lookupByTitle: (title: string) => Promise<BookLookupCandidate | null>;
}

export interface BookLookupResult {
  status: 'matched' | 'ambiguous' | 'failed';
  matchSource?: 'isbn' | 'title_author' | 'title';
  confidence: number;
  candidate: BookLookupCandidate | null;
}

function normalizeIsbn(raw?: string): string | undefined {
  const normalized = raw?.replace(/-/g, '').trim();
  if (!normalized) return undefined;
  return normalized.toUpperCase();
}

export async function lookupBookMetadata(input: BookLookupInput, provider: BookLookupProvider): Promise<BookLookupResult> {
  try {
    const isbn = normalizeIsbn(input.isbn);
    if (isbn) {
      const byIsbn = await provider.lookupByIsbn(isbn);
      if (byIsbn) {
        return {
          status: classifyBookMatchConfidence(byIsbn.confidence) === 'high' ? 'matched' : 'ambiguous',
          matchSource: 'isbn',
          confidence: byIsbn.confidence,
          candidate: byIsbn,
        };
      }
    }

    if (input.title?.trim()) {
      const byTitleAuthor = await provider.lookupByTitleAuthor(input.title.trim(), input.author?.trim());
      if (byTitleAuthor) {
        return {
          status: classifyBookMatchConfidence(byTitleAuthor.confidence) === 'high' ? 'matched' : 'ambiguous',
          matchSource: 'title_author',
          confidence: byTitleAuthor.confidence,
          candidate: byTitleAuthor,
        };
      }

      const byTitle = await provider.lookupByTitle(input.title.trim());
      if (byTitle) {
        return {
          status: classifyBookMatchConfidence(byTitle.confidence) === 'high' ? 'matched' : 'ambiguous',
          matchSource: 'title',
          confidence: byTitle.confidence,
          candidate: byTitle,
        };
      }
    }

    return { status: 'failed', matchSource: undefined, confidence: 0, candidate: null };
  } catch {
    return { status: 'failed', matchSource: undefined, confidence: 0, candidate: null };
  }
}
