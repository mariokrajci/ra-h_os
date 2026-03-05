import { describe, expect, it } from 'vitest';

import { applyBookMatchCandidate, getFirstBookMatchCandidate } from '@/components/panes/library/bookMatch';

describe('book match confirmation helpers', () => {
  it('returns the first candidate when present', () => {
    const candidate = getFirstBookMatchCandidate({
      book_match_candidates: [
        { title: 'Atomic Habits', author: 'James Clear', isbn: '9780735211292', cover_url: 'https://example.com/c.jpg' },
      ],
    });

    expect(candidate).toEqual({
      title: 'Atomic Habits',
      author: 'James Clear',
      isbn: '9780735211292',
      cover_url: 'https://example.com/c.jpg',
    });
  });

  it('applies confirmed candidate metadata and clears ambiguity', () => {
    const metadata = applyBookMatchCandidate(
      {
        content_kind: 'book',
        book_metadata_status: 'ambiguous',
      },
      {
        title: 'Atomic Habits',
        author: 'James Clear',
        isbn: '9780735211292',
        cover_url: 'https://example.com/c.jpg',
      },
    );

    expect(metadata).toMatchObject({
      book_title: 'Atomic Habits',
      book_author: 'James Clear',
      book_isbn: '9780735211292',
      cover_url: 'https://example.com/c.jpg',
      cover_source: 'remote',
      book_metadata_status: 'matched',
      book_match_source: 'manual',
      book_match_confidence: 1,
      book_match_candidates: [],
    });
  });

  it('respects manual cover lock when applying a candidate', () => {
    const metadata = applyBookMatchCandidate(
      {
        cover_source: 'manual',
        cover_url: 'https://manual.example/cover.jpg',
        book_metadata_locked: { cover: true },
      },
      {
        title: 'Atomic Habits',
        cover_url: 'https://example.com/c.jpg',
      },
    );

    expect(metadata.cover_source).toBe('manual');
    expect(metadata.cover_url).toBe('https://manual.example/cover.jpg');
  });
});
