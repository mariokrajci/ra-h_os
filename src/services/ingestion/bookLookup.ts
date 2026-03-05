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
  lookupCandidates?: (title: string, author?: string) => Promise<BookLookupCandidate[]>;
}

export interface BookLookupResult {
  status: 'matched' | 'ambiguous' | 'failed';
  matchSource?: 'isbn' | 'title_author' | 'title';
  confidence: number;
  candidate: BookLookupCandidate | null;
  candidates?: BookLookupCandidate[];
}

function normalizeIsbn(raw?: string): string | undefined {
  const normalized = raw?.replace(/-/g, '').trim();
  if (!normalized) return undefined;
  return normalized.toUpperCase();
}

function pickCoverFromOpenLibrary(doc: Record<string, unknown>): string | undefined {
  const coverId = typeof doc.cover_i === 'number' ? doc.cover_i : undefined;
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

export function createOpenLibraryBookLookupProvider(
  fetchImpl: typeof fetch = fetch,
): BookLookupProvider {
  const mapDocToCandidate = (doc: Record<string, unknown>, confidence: number): BookLookupCandidate | null => {
    const title = typeof doc.title === 'string' ? doc.title.trim() : '';
    if (!title) return null;
    return {
      title,
      author: Array.isArray(doc.author_name) && typeof doc.author_name[0] === 'string'
        ? String(doc.author_name[0]).trim()
        : undefined,
      isbn: Array.isArray(doc.isbn) && typeof doc.isbn[0] === 'string'
        ? String(doc.isbn[0]).replace(/-/g, '')
        : undefined,
      coverUrl: pickCoverFromOpenLibrary(doc),
      confidence,
    };
  };

  return {
    async lookupByIsbn(isbn: string) {
      const response = await fetchImpl(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
      if (!response.ok) return null;
      const payload = await response.json() as Record<string, unknown>;
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      if (!title) return null;
      return {
        title,
        isbn,
        coverUrl: `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`,
        confidence: 0.98,
      };
    },
    async lookupByTitleAuthor(title: string, author?: string) {
      const search = new URL('https://openlibrary.org/search.json');
      search.searchParams.set('title', title);
      if (author) search.searchParams.set('author', author);
      search.searchParams.set('limit', '1');

      const response = await fetchImpl(search.toString());
      if (!response.ok) return null;
      const payload = await response.json() as { docs?: Array<Record<string, unknown>> };
      const doc = payload.docs?.[0];
      if (!doc) return null;
      return mapDocToCandidate(doc, author ? 0.9 : 0.75);
    },
    async lookupByTitle(title: string) {
      const search = new URL('https://openlibrary.org/search.json');
      search.searchParams.set('title', title);
      search.searchParams.set('limit', '1');
      const response = await fetchImpl(search.toString());
      if (!response.ok) return null;
      const payload = await response.json() as { docs?: Array<Record<string, unknown>> };
      const doc = payload.docs?.[0];
      if (!doc) return null;
      return mapDocToCandidate(doc, 0.68);
    },
    async lookupCandidates(title: string, author?: string) {
      const search = new URL('https://openlibrary.org/search.json');
      search.searchParams.set('title', title);
      if (author) search.searchParams.set('author', author);
      search.searchParams.set('limit', '3');

      const response = await fetchImpl(search.toString());
      if (!response.ok) return [];
      const payload = await response.json() as { docs?: Array<Record<string, unknown>> };
      const docs = Array.isArray(payload.docs) ? payload.docs : [];
      return docs
        .map((doc, index) => mapDocToCandidate(doc, Math.max(0.55, 0.78 - index * 0.07)))
        .filter((candidate): candidate is BookLookupCandidate => Boolean(candidate));
    },
  };
}

function dedupeCandidates(candidates: BookLookupCandidate[]): BookLookupCandidate[] {
  const seen = new Set<string>();
  const deduped: BookLookupCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
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
        const classification = classifyBookMatchConfidence(byTitleAuthor.confidence);
        const candidates = classification === 'medium' && provider.lookupCandidates
          ? dedupeCandidates([byTitleAuthor, ...(await provider.lookupCandidates(input.title.trim(), input.author?.trim()))]).slice(0, 3)
          : undefined;
        return {
          status: classification === 'high' ? 'matched' : 'ambiguous',
          matchSource: 'title_author',
          confidence: byTitleAuthor.confidence,
          candidate: byTitleAuthor,
          candidates,
        };
      }

      const byTitle = await provider.lookupByTitle(input.title.trim());
      if (byTitle) {
        const classification = classifyBookMatchConfidence(byTitle.confidence);
        const candidates = classification === 'medium' && provider.lookupCandidates
          ? dedupeCandidates([byTitle, ...(await provider.lookupCandidates(input.title.trim(), input.author?.trim()))]).slice(0, 3)
          : undefined;
        return {
          status: classification === 'high' ? 'matched' : 'ambiguous',
          matchSource: 'title',
          confidence: byTitle.confidence,
          candidate: byTitle,
          candidates,
        };
      }
    }

    return { status: 'failed', matchSource: undefined, confidence: 0, candidate: null };
  } catch {
    return { status: 'failed', matchSource: undefined, confidence: 0, candidate: null };
  }
}
