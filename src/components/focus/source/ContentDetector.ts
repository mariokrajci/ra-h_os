/**
 * Content type detection for Source Reader
 * Analyzes raw content to determine the best formatting approach
 */

export type ContentType = 'transcript' | 'book' | 'markdown' | 'article' | 'raw';

// Timestamp patterns for transcript detection
const TIMESTAMP_PATTERNS = [
  /^\[\d{1,2}:\d{2}(?::\d{2})?\]\s+\S/,   // [00:00] text
  /^\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s+\S/,  // 00:00 - text
  /^\(\d{1,2}:\d{2}(?::\d{2})?\)\s+\S/,      // (00:00) text
  /^\[\d+(?:\.\d+)?s\]\s+\S/,                // [0.1s] text
];

// Book detection - only strong, unambiguous markers
// INTRODUCTION and APPENDIX removed: too common in technical docs and READMEs
const BOOK_INDICATORS = [
  /\b(CHAPTER|Chapter)\s+\d+/i,
  /\b(Part|PART)\s+(I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)\b/i,
  /\bTable\s+of\s+Contents\b/i,
  /\bPREFACE\b/,
];

// Markdown syntax markers
const MARKDOWN_MARKERS = [
  /^#{1,6}\s/m,           // Headers
  /\*\*[^*]+\*\*/,        // Bold
  /\*[^*]+\*/,            // Italic (but not bold)
  /^[-*+]\s/m,            // Unordered lists
  /^\d+\.\s/m,            // Ordered lists
  /```[\s\S]*?```/,       // Code blocks
  /`[^`]+`/,              // Inline code
  /\[.+\]\(.+\)/,         // Links
];

/**
 * Detect the content type of raw source content.
 * Pass sourceUrl to enable URL-based hints (e.g. GitHub repos are always markdown).
 */
export function detectContentType(content: string, sourceUrl?: string): ContentType {
  if (!content || content.length < 50) return 'raw';

  // GitHub repos always serve markdown README files
  try {
    if (sourceUrl && new URL(sourceUrl).hostname === 'github.com') return 'markdown';
  } catch {
    // ignore invalid URLs
  }

  const lines = content.split('\n').slice(0, 50); // Check first 50 lines
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);

  // 1. Check for transcript patterns (timestamps)
  const timestampLines = nonEmptyLines.filter((line) =>
    TIMESTAMP_PATTERNS.some((pattern) => pattern.test(line.replace(/^([-*+]|\d+\.)\s+/, '')))
  );
  const transcriptDensity = nonEmptyLines.length > 0 ? timestampLines.length / nonEmptyLines.length : 0;
  if (timestampLines.length >= 3 && transcriptDensity >= 0.25) return 'transcript';

  // 2. Check for markdown patterns (before book — well-formatted markdown is unlikely to be a book)
  const markdownScore = calculateMarkdownScore(content);
  if (markdownScore > 0.3) return 'markdown';

  // 3. Check for book indicators — require 2+ strong signals
  const bookIndicatorCount = BOOK_INDICATORS.filter(pattern => pattern.test(content)).length;
  if (bookIndicatorCount >= 2) return 'book';

  // 4. Check for article structure (paragraphs with clear breaks)
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 100);
  if (paragraphs.length >= 3) return 'article';

  // 5. Default to raw
  return 'raw';
}

/**
 * Calculate a "markdown-ness" score for content
 * Returns a value between 0 and 1
 */
function calculateMarkdownScore(content: string): number {
  const matchCount = MARKDOWN_MARKERS.filter(m => m.test(content)).length;
  return matchCount / MARKDOWN_MARKERS.length;
}

/**
 * Get a human-readable label for content type
 */
export function getContentTypeLabel(type: ContentType): string {
  switch (type) {
    case 'transcript': return 'Transcript';
    case 'book': return 'Book/Chapter';
    case 'markdown': return 'Markdown';
    case 'article': return 'Article';
    case 'raw': return 'Plain Text';
  }
}
