import { describe, expect, it } from 'vitest';

import { fetchBookMetadata, generateGradientDataUrl } from '../bookMetadata';

describe('bookMetadata', () => {
  it('preserves local extraction metadata when present', async () => {
    await expect(
      fetchBookMetadata({
        title: 'The Design of Everyday Things',
        author: 'Don Norman',
        isbn: '9780465050659',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        book_title: 'The Design of Everyday Things',
        book_author: 'Don Norman',
        book_isbn: '9780465050659',
        cover_url: expect.stringContaining('data:image/svg+xml'),
        cover_source: 'generated',
        content_kind: 'book',
        book_metadata_status: 'pending',
      }),
    );
  });

  it('falls back to a deterministic gradient cover when remote lookups are skipped or fail', async () => {
    const result = await fetchBookMetadata({
      title: 'Understanding Comics',
    });

    expect(result.cover_url).toBe(generateGradientDataUrl('Understanding Comics'));
  });

  it('returns stable gradient output for the same title', () => {
    expect(generateGradientDataUrl('A Book')).toBe(generateGradientDataUrl('A Book'));
  });
});
