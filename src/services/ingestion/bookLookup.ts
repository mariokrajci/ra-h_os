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
  publisher?: string;
  firstPublishedYear?: number;
  pageCount?: number;
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

function pickPublisherFromDoc(doc: Record<string, unknown>): string | undefined {
  if (Array.isArray(doc.publisher) && typeof doc.publisher[0] === 'string') {
    const value = String(doc.publisher[0]).trim();
    return value || undefined;
  }
  if (Array.isArray(doc.publishers) && typeof doc.publishers[0] === 'string') {
    const value = String(doc.publishers[0]).trim();
    return value || undefined;
  }
  return undefined;
}

function pickFirstPublishedYearFromDoc(doc: Record<string, unknown>): number | undefined {
  if (typeof doc.first_publish_year === 'number' && Number.isFinite(doc.first_publish_year)) {
    return doc.first_publish_year;
  }
  const publishDate = typeof doc.publish_date === 'string' ? doc.publish_date : undefined;
  if (!publishDate) return undefined;
  const yearMatch = publishDate.match(/\b(1[5-9]\d{2}|20\d{2}|2100)\b/);
  if (!yearMatch) return undefined;
  return Number(yearMatch[1]);
}

function pickPageCountFromDoc(doc: Record<string, unknown>): number | undefined {
  if (typeof doc.number_of_pages_median === 'number' && Number.isFinite(doc.number_of_pages_median)) {
    return doc.number_of_pages_median;
  }
  if (typeof doc.number_of_pages === 'number' && Number.isFinite(doc.number_of_pages)) {
    return doc.number_of_pages;
  }
  return undefined;
}

function normalizeLoose(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleBase(value: string): string {
  return value
    .replace(/[:\-–(].*$/, '')
    .trim();
}

function scoreOpenLibraryDoc(
  doc: Record<string, unknown>,
  queryTitle: string,
  queryAuthor?: string,
): number {
  const title = typeof doc.title === 'string' ? doc.title.trim() : '';
  if (!title) return Number.NEGATIVE_INFINITY;

  const normalizedTitle = normalizeLoose(title);
  const normalizedQueryTitle = normalizeLoose(queryTitle);
  const normalizedBaseTitle = normalizeLoose(titleBase(title));
  const normalizedQueryBase = normalizeLoose(titleBase(queryTitle));
  const author = Array.isArray(doc.author_name) && typeof doc.author_name[0] === 'string'
    ? String(doc.author_name[0]).trim()
    : '';
  const normalizedAuthor = normalizeLoose(author);
  const normalizedQueryAuthor = normalizeLoose(queryAuthor);

  let score = 0;
  if (normalizedTitle === normalizedQueryTitle) score += 90;
  if (normalizedBaseTitle === normalizedQueryBase) score += 55;
  if (normalizedTitle.startsWith(normalizedQueryTitle)) score += 25;
  if (normalizedTitle.includes(normalizedQueryBase)) score += 10;

  if (normalizedQueryAuthor) {
    if (normalizedAuthor === normalizedQueryAuthor) score += 50;
    else if (normalizedAuthor.includes(normalizedQueryAuthor)) score += 30;
  }

  const editionCount = typeof doc.edition_count === 'number' ? doc.edition_count : 0;
  score += Math.min(editionCount, 40) * 0.6;

  const fullText = normalizeLoose([
    title,
    ...(Array.isArray(doc.subtitle) ? doc.subtitle : [doc.subtitle]),
    ...(Array.isArray(doc.subject) ? doc.subject : [doc.subject]),
  ].filter(Boolean).join(' '));

  if (!/graphic novel|manga|comic|workbook|summary|companion|illustrated|adaptation/.test(normalizedQueryTitle)) {
    if (/graphic novel|manga|comic/.test(fullText)) score -= 45;
    if (/workbook|summary|companion|study guide/.test(fullText)) score -= 35;
    if (/illustrated|adaptation/.test(fullText)) score -= 18;
  }

  return score;
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
      publisher: pickPublisherFromDoc(doc),
      firstPublishedYear: pickFirstPublishedYearFromDoc(doc),
      pageCount: pickPageCountFromDoc(doc),
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
        publisher: pickPublisherFromDoc(payload),
        firstPublishedYear: pickFirstPublishedYearFromDoc(payload),
        pageCount: pickPageCountFromDoc(payload),
        confidence: 0.98,
      };
    },
    async lookupByTitleAuthor(title: string, author?: string) {
      const search = new URL('https://openlibrary.org/search.json');
      search.searchParams.set('title', title);
      if (author) search.searchParams.set('author', author);
      search.searchParams.set('limit', '20');

      const response = await fetchImpl(search.toString());
      if (!response.ok) return null;
      const payload = await response.json() as { docs?: Array<Record<string, unknown>> };
      const docs = Array.isArray(payload.docs) ? payload.docs : [];
      const sorted = [...docs].sort(
        (a, b) => scoreOpenLibraryDoc(b, title, author) - scoreOpenLibraryDoc(a, title, author),
      );
      const doc = sorted[0];
      if (!doc) return null;
      return mapDocToCandidate(doc, author ? 0.9 : 0.75);
    },
    async lookupByTitle(title: string) {
      const search = new URL('https://openlibrary.org/search.json');
      search.searchParams.set('title', title);
      search.searchParams.set('limit', '20');
      const response = await fetchImpl(search.toString());
      if (!response.ok) return null;
      const payload = await response.json() as { docs?: Array<Record<string, unknown>> };
      const docs = Array.isArray(payload.docs) ? payload.docs : [];
      const sorted = [...docs].sort(
        (a, b) => scoreOpenLibraryDoc(b, title) - scoreOpenLibraryDoc(a, title),
      );
      const doc = sorted[0];
      if (!doc) return null;
      return mapDocToCandidate(doc, 0.68);
    },
    async lookupCandidates(title: string, author?: string) {
      const search = new URL('https://openlibrary.org/search.json');
      search.searchParams.set('title', title);
      if (author) search.searchParams.set('author', author);
      search.searchParams.set('limit', '20');

      const response = await fetchImpl(search.toString());
      if (!response.ok) return [];
      const payload = await response.json() as { docs?: Array<Record<string, unknown>> };
      const docs = Array.isArray(payload.docs) ? payload.docs : [];
      const ranked = [...docs].sort(
        (a, b) => scoreOpenLibraryDoc(b, title, author) - scoreOpenLibraryDoc(a, title, author),
      );
      return ranked
        .slice(0, 5)
        .map((doc, index) => mapDocToCandidate(doc, Math.max(0.58, 0.84 - index * 0.06)))
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
