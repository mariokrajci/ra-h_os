import { describe, expect, it } from 'vitest';

import type { NodeMetadata } from '@/types/database';

describe('book metadata lifecycle typing', () => {
  it('accepts lifecycle fields for book enrichment', () => {
    const metadata: NodeMetadata = {
      content_kind: 'book',
      book_detection_status: 'confirmed',
      book_metadata_status: 'pending',
      book_match_confidence: 0.92,
      book_match_source: 'isbn',
      cover_source: 'generated',
      book_metadata_locked: {
        title: false,
        author: false,
        isbn: false,
        cover: false,
      },
    };

    expect(metadata.content_kind).toBe('book');
    expect(metadata.book_match_confidence).toBeGreaterThan(0);
  });
});
