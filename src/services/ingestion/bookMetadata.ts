export interface BookMetadataInput {
  title?: string | null;
  author?: string | null;
  isbn?: string | null;
}

export interface BookMetadataResult {
  book_title?: string;
  book_author?: string;
  book_isbn?: string;
  cover_url: string;
  cover_fetched_at: string;
}

function normalizeField(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function generateGradientDataUrl(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  const hueA = Math.abs(hash) % 360;
  const hueB = (hueA + 42) % 360;
  const title = seed.replace(/[<&>"]/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hueA} 56% 44%)" />
          <stop offset="100%" stop-color="hsl(${hueB} 48% 24%)" />
        </linearGradient>
      </defs>
      <rect width="320" height="480" fill="url(#g)" rx="18" />
      <text x="32" y="80" fill="rgba(255,255,255,0.92)" font-size="28" font-family="Georgia, serif">
        ${title || 'Untitled'}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export async function fetchBookMetadata(input: BookMetadataInput): Promise<BookMetadataResult> {
  const bookTitle = normalizeField(input.title);
  const bookAuthor = normalizeField(input.author);
  const bookIsbn = normalizeField(input.isbn);
  const coverSeed = bookTitle || bookAuthor || bookIsbn || 'Untitled';

  return {
    book_title: bookTitle,
    book_author: bookAuthor,
    book_isbn: bookIsbn,
    cover_url: generateGradientDataUrl(coverSeed),
    cover_fetched_at: new Date().toISOString(),
  };
}
