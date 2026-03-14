import { describe, expect, it } from 'vitest';

import { getMobileNotePreview } from '@/components/mobile/mobileNotesPresentation';

describe('getMobileNotePreview', () => {
  it('prefers description when available', () => {
    const preview = getMobileNotePreview({
      description: 'Short description',
      notes: 'Fallback notes',
    });

    expect(preview).toBe('Short description');
  });

  it('falls back to notes when description is empty', () => {
    const preview = getMobileNotePreview({
      description: '',
      notes: 'Use these notes',
    });

    expect(preview).toBe('Use these notes');
  });

  it('returns a compact preview string', () => {
    const preview = getMobileNotePreview({
      notes: 'A'.repeat(240),
    });

    expect(preview.length).toBeLessThanOrEqual(141);
    expect(preview.endsWith('...')).toBe(true);
  });
});
