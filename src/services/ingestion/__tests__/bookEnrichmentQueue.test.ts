import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getNodeByIdMock, updateNodeMock, lookupBookMetadataMock } = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  lookupBookMetadataMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
  },
}));

vi.mock('@/services/ingestion/bookLookup', () => ({
  lookupBookMetadata: lookupBookMetadataMock,
  createOpenLibraryBookLookupProvider: vi.fn(() => ({})),
}));

import { enrichBookNode } from '@/services/ingestion/bookEnrichmentQueue';

describe('enrichBookNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips non-book nodes', async () => {
    getNodeByIdMock.mockResolvedValue({ id: 1, title: 'Note', metadata: { source: 'quick-add-note' } });

    await expect(enrichBookNode(1)).resolves.toBe('skipped');
    expect(updateNodeMock).not.toHaveBeenCalled();
  });

  it('applies matched metadata and remote cover', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 2,
      title: 'Atomic Habits',
      metadata: {
        content_kind: 'book',
        book_title: 'Atomic Habits',
        cover_url: 'data:image/svg+xml,placeholder',
        cover_source: 'generated',
      },
    });

    lookupBookMetadataMock.mockResolvedValue({
      status: 'matched',
      matchSource: 'isbn',
      confidence: 0.98,
      candidate: {
        title: 'Atomic Habits',
        author: 'James Clear',
        isbn: '9780735211292',
        coverUrl: 'https://covers.example/atomic-habits.jpg',
        confidence: 0.98,
      },
    });

    await expect(enrichBookNode(2)).resolves.toBe('matched');

    expect(updateNodeMock).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        metadata: expect.objectContaining({
          book_metadata_status: 'matched',
          book_match_source: 'isbn',
          cover_source: 'remote',
          cover_url: 'https://covers.example/atomic-habits.jpg',
          book_author: 'James Clear',
          book_isbn: '9780735211292',
        }),
      }),
    );
  });

  it('does not override manual cover when cover lock is present', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 3,
      title: 'Atomic Habits',
      metadata: {
        content_kind: 'book',
        cover_source: 'manual',
        cover_url: 'https://manual.example/cover.jpg',
        book_metadata_locked: { cover: true },
      },
    });

    lookupBookMetadataMock.mockResolvedValue({
      status: 'matched',
      matchSource: 'title',
      confidence: 0.9,
      candidate: {
        title: 'Atomic Habits',
        coverUrl: 'https://covers.example/atomic-habits.jpg',
        confidence: 0.9,
      },
    });

    await enrichBookNode(3);

    expect(updateNodeMock).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        metadata: expect.objectContaining({
          cover_source: 'manual',
          cover_url: 'https://manual.example/cover.jpg',
        }),
      }),
    );
  });

  it('marks metadata as failed when lookup fails', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 4,
      title: 'Unknown Book',
      metadata: { content_kind: 'book' },
    });

    lookupBookMetadataMock.mockResolvedValue({
      status: 'failed',
      matchSource: undefined,
      confidence: 0,
      candidate: null,
    });

    await expect(enrichBookNode(4)).resolves.toBe('failed');
    expect(updateNodeMock).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        metadata: expect.objectContaining({
          book_metadata_status: 'failed',
          book_match_confidence: 0,
        }),
      }),
    );
  });

  it('stores match candidates when lookup is ambiguous', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 5,
      title: 'Atomic Habits',
      metadata: { content_kind: 'book' },
    });

    lookupBookMetadataMock.mockResolvedValue({
      status: 'ambiguous',
      matchSource: 'title',
      confidence: 0.72,
      candidate: {
        title: 'Atomic Habits',
        author: 'James Clear',
        isbn: '9780735211292',
        coverUrl: 'https://covers.example/atomic-habits.jpg',
        confidence: 0.72,
      },
      candidates: [
        {
          title: 'Atomic Habits',
          author: 'James Clear',
          isbn: '9780735211292',
          coverUrl: 'https://covers.example/atomic-habits.jpg',
          confidence: 0.72,
        },
        {
          title: 'Atomic Habits: Workbook',
          author: 'James Clear',
          isbn: '9780735211293',
          coverUrl: 'https://covers.example/atomic-habits-workbook.jpg',
          confidence: 0.66,
        },
      ],
    });

    await expect(enrichBookNode(5)).resolves.toBe('ambiguous');
    expect(updateNodeMock).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        metadata: expect.objectContaining({
          book_metadata_status: 'ambiguous',
          book_match_candidates: [
            expect.objectContaining({
              title: 'Atomic Habits',
              author: 'James Clear',
              isbn: '9780735211292',
              cover_url: 'https://covers.example/atomic-habits.jpg',
            }),
            expect.objectContaining({
              title: 'Atomic Habits: Workbook',
              author: 'James Clear',
              isbn: '9780735211293',
              cover_url: 'https://covers.example/atomic-habits-workbook.jpg',
            }),
          ],
        }),
      }),
    );
  });
});
