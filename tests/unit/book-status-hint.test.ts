import { describe, expect, it } from 'vitest';

import { getBookStatusHint } from '@/components/panes/library/bookStatus';

describe('getBookStatusHint', () => {
  it('returns pending hint while enrichment is running', () => {
    expect(getBookStatusHint({ book_metadata_status: 'pending' })).toEqual({
      tone: 'muted',
      label: 'Fetching metadata...',
    });
  });

  it('returns ambiguous hint for manual confirmation', () => {
    expect(getBookStatusHint({ book_metadata_status: 'ambiguous' })).toEqual({
      tone: 'warning',
      label: 'Confirm book match',
    });
  });

  it('returns failure hint with recovery guidance', () => {
    expect(getBookStatusHint({ book_metadata_status: 'failed' })).toEqual({
      tone: 'warning',
      label: 'Add author/ISBN to improve match',
    });
  });

  it('returns null for matched or missing status', () => {
    expect(getBookStatusHint({ book_metadata_status: 'matched' })).toBeNull();
    expect(getBookStatusHint({})).toBeNull();
  });
});
