import { describe, expect, it } from 'vitest';
import { getNodeNotesStatus, getNodeSourceStatus } from '@/components/focus/nodeIngestionStatus';

describe('node ingestion status helpers', () => {
  it('returns processing states for queued podcast transcript and notes', () => {
    const metadata = {
      source: 'podcast_episode',
      source_status: 'pending' as const,
      notes_status: 'pending' as const,
      transcript_status: 'queued' as const,
    };

    expect(getNodeSourceStatus(metadata)).toEqual({
      kind: 'processing',
      message: 'Looking for source content...',
    });
    expect(getNodeNotesStatus(metadata)).toEqual({
      kind: 'processing',
      message: 'Source queued. Notes will stay empty until you write them or generate them.',
    });
  });

  it('returns processing states while source work is active', () => {
    const metadata = {
      source: 'website',
      source_status: 'processing' as const,
      notes_status: 'processing' as const,
    };

    expect(getNodeSourceStatus(metadata)).toEqual({
      kind: 'processing',
      message: 'Source is being prepared...',
    });
    expect(getNodeNotesStatus(metadata)).toEqual({
      kind: 'processing',
      message: 'Source is being prepared. Notes will stay empty until you write them or generate them.',
    });
  });

  it('returns error states when source preparation fails', () => {
    const metadata = {
      source: 'pdf',
      source_status: 'failed' as const,
      notes_status: 'failed' as const,
    };

    expect(getNodeSourceStatus(metadata)).toEqual({
      kind: 'error',
      message: 'Source content could not be prepared.',
    });
    expect(getNodeNotesStatus(metadata)).toEqual({
      kind: 'error',
      message: 'Source content could not be prepared for this node.',
    });
  });

  it('returns null when source is available but notes are intentionally empty', () => {
    const metadata = {
      source: 'website',
      source_status: 'available' as const,
    };

    expect(getNodeSourceStatus(metadata)).toBeNull();
    expect(getNodeNotesStatus(metadata)).toBeNull();
  });

  it('returns null for non-source-backed nodes', () => {
    expect(getNodeSourceStatus({ source: 'note' })).toBeNull();
    expect(getNodeNotesStatus({ source: 'note' })).toBeNull();
  });
});
