export const READER_FORMAT_VALUES = [
  'markdown',
  'article',
  'transcript',
  'book',
  'raw',
  'pdf',
  'epub',
  'chat',
] as const;

export type ReaderFormatValue = typeof READER_FORMAT_VALUES[number];

export const READER_FORMAT_LABELS: Record<ReaderFormatValue, string> = {
  markdown: 'Markdown',
  article: 'Article',
  transcript: 'Transcript',
  book: 'Book/Chapter',
  raw: 'Plain Text',
  pdf: 'PDF',
  epub: 'EPUB',
  chat: 'Chat Transcript',
};

export function isReaderFormatValue(value: unknown): value is ReaderFormatValue {
  return typeof value === 'string' && (READER_FORMAT_VALUES as readonly string[]).includes(value);
}

