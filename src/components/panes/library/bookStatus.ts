import type { NodeMetadata } from '@/types/database';

export type BookStatusHintTone = 'muted' | 'warning';

export interface BookStatusHint {
  tone: BookStatusHintTone;
  label: string;
}

export function getBookStatusHint(metadata?: NodeMetadata | null): BookStatusHint | null {
  switch (metadata?.book_metadata_status) {
    case 'pending':
      return {
        tone: 'muted',
        label: 'Fetching metadata...',
      };
    case 'ambiguous':
      return {
        tone: 'warning',
        label: 'Confirm book match',
      };
    case 'failed':
      return {
        tone: 'warning',
        label: 'Add author/ISBN to improve match',
      };
    default:
      return null;
  }
}
