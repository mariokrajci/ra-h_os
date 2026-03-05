export type BookCommandParseResult =
  | { kind: 'none' }
  | { kind: 'unknown'; command: string; rawInput: string }
  | {
    kind: 'book';
    command: 'book';
    title?: string;
    author?: string;
    isbn?: string;
    confidence: number;
    needsConfirmation: boolean;
  };

function normalize(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function extractIsbn(text: string): { textWithoutIsbn: string; isbn?: string } {
  const match = text.match(/\bisbn\s+([0-9Xx-]{10,20})\b/i);
  if (!match) return { textWithoutIsbn: text };

  const isbn = match[1].replace(/-/g, '').toUpperCase();
  const textWithoutIsbn = text.replace(match[0], '').trim();
  return { textWithoutIsbn, isbn };
}

function parseBookPayload(payload: string): Omit<Extract<BookCommandParseResult, { kind: 'book' }>, 'kind' | 'command'> {
  const parsedPipe = payload.split('|').map((part) => part.trim());
  if (parsedPipe.length > 1) {
    const [title, author, isbnRaw] = parsedPipe;
    const isbn = normalize(isbnRaw)?.replace(/-/g, '').toUpperCase();
    const normalizedTitle = normalize(title);

    if (!normalizedTitle) {
      return {
        title: undefined,
        author: normalize(author),
        isbn,
        confidence: 0.4,
        needsConfirmation: true,
      };
    }

    return {
      title: normalizedTitle,
      author: normalize(author),
      isbn,
      confidence: isbn ? 0.98 : 0.93,
      needsConfirmation: false,
    };
  }

  const { textWithoutIsbn, isbn } = extractIsbn(payload);
  const byMatch = textWithoutIsbn.match(/^(.*?)\s+by\s+(.+)$/i);

  if (byMatch) {
    const title = normalize(byMatch[1]);
    const author = normalize(byMatch[2]);

    if (!title || /^isbn$/i.test(title)) {
      return {
        title: undefined,
        author: undefined,
        isbn,
        confidence: 0.4,
        needsConfirmation: true,
      };
    }

    return {
      title,
      author,
      isbn,
      confidence: isbn ? 0.98 : 0.93,
      needsConfirmation: false,
    };
  }

  const title = normalize(textWithoutIsbn);

  if (!title || /^by\b/i.test(title) || /^isbn\b/i.test(title)) {
    return {
      title: undefined,
      author: undefined,
      isbn,
      confidence: 0.4,
      needsConfirmation: true,
    };
  }

  return {
    title,
    author: undefined,
    isbn,
    confidence: isbn ? 0.95 : 0.85,
    needsConfirmation: false,
  };
}

export function parseBookCommand(input: string): BookCommandParseResult {
  const raw = input.trim();
  if (!raw.startsWith('/')) {
    return { kind: 'none' };
  }

  const commandMatch = raw.match(/^\/([a-zA-Z0-9_-]+)\b\s*(.*)$/);
  if (!commandMatch) {
    return { kind: 'none' };
  }

  const command = commandMatch[1].toLowerCase();
  const payload = commandMatch[2] || '';

  if (command !== 'book') {
    return {
      kind: 'unknown',
      command,
      rawInput: raw,
    };
  }

  const parsed = parseBookPayload(payload);
  return {
    kind: 'book',
    command: 'book',
    ...parsed,
  };
}
