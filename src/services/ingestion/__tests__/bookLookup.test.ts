import { describe, expect, it } from 'vitest';

import {
  lookupBookMetadata,
  type BookLookupInput,
  type BookLookupProvider,
} from '../bookLookup';

describe('lookupBookMetadata', () => {
  it('prioritizes isbn lookup before title/author and title', async () => {
    const calls: string[] = [];
    const provider: BookLookupProvider = {
      lookupByIsbn: async () => {
        calls.push('isbn');
        return { title: 'Atomic Habits', author: 'James Clear', isbn: '9780735211292', coverUrl: 'https://example.com/cover.jpg', confidence: 0.98 };
      },
      lookupByTitleAuthor: async () => {
        calls.push('title_author');
        return null;
      },
      lookupByTitle: async () => {
        calls.push('title');
        return null;
      },
    };

    const input: BookLookupInput = { title: 'Atomic Habits', author: 'James Clear', isbn: '9780735211292' };
    const result = await lookupBookMetadata(input, provider);

    expect(calls).toEqual(['isbn']);
    expect(result).toMatchObject({ status: 'matched', matchSource: 'isbn' });
  });

  it('falls back to title+author and then title', async () => {
    const calls: string[] = [];
    const provider: BookLookupProvider = {
      lookupByIsbn: async () => {
        calls.push('isbn');
        return null;
      },
      lookupByTitleAuthor: async () => {
        calls.push('title_author');
        return null;
      },
      lookupByTitle: async () => {
        calls.push('title');
        return { title: 'Atomic Habits', confidence: 0.72 };
      },
    };

    const result = await lookupBookMetadata({ title: 'Atomic Habits', isbn: 'bad' }, provider);

    expect(calls).toEqual(['isbn', 'title_author', 'title']);
    expect(result).toMatchObject({ status: 'ambiguous', matchSource: 'title' });
  });

  it('returns multiple candidates for ambiguous title matches when provider supports it', async () => {
    const provider: BookLookupProvider = {
      lookupByIsbn: async () => null,
      lookupByTitleAuthor: async () => null,
      lookupByTitle: async () => ({ title: 'Atomic Habits', confidence: 0.72 }),
      lookupCandidates: async () => ([
        { title: 'Atomic Habits', author: 'James Clear', confidence: 0.72 },
        { title: 'Atomic Habits: Workbook', author: 'James Clear', confidence: 0.66 },
      ]),
    };

    const result = await lookupBookMetadata({ title: 'Atomic Habits' }, provider);
    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates?.[1].title).toBe('Atomic Habits: Workbook');
  });

  it('returns failed when provider throws', async () => {
    const provider: BookLookupProvider = {
      lookupByIsbn: async () => {
        throw new Error('timeout');
      },
      lookupByTitleAuthor: async () => null,
      lookupByTitle: async () => null,
    };

    const result = await lookupBookMetadata({ isbn: '9780735211292' }, provider);

    expect(result).toEqual({
      status: 'failed',
      matchSource: undefined,
      confidence: 0,
      candidate: null,
    });
  });
});
