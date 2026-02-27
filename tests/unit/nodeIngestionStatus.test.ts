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
      message: 'Source queued. Notes will appear when processing finishes.',
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
      message: 'Notes are being generated...',
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
      message: 'Notes could not be generated from this source.',
    });
  });

  it('returns null for non-source-backed nodes', () => {
    expect(getNodeSourceStatus({ source: 'note' })).toBeNull();
    expect(getNodeNotesStatus({ source: 'note' })).toBeNull();
  });
});
