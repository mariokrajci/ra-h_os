type IngestionMetadata = {
  source?: string;
  source_status?: 'pending' | 'processing' | 'available' | 'failed';
  notes_status?: 'pending' | 'processing' | 'available' | 'failed';
  transcript_status?: 'queued' | 'processing' | 'available' | 'unavailable';
};

export type NodeTabStatus = {
  kind: 'processing' | 'error' | 'idle';
  message: string;
} | null;

const SOURCE_BACKED_TYPES = new Set(['podcast_episode', 'youtube', 'website', 'pdf']);

function isSourceBacked(metadata?: IngestionMetadata | null): boolean {
  return !!metadata?.source && SOURCE_BACKED_TYPES.has(metadata.source);
}

export function getNodeNotesStatus(metadata?: IngestionMetadata | null): NodeTabStatus {
  if (!isSourceBacked(metadata)) return null;

  if (metadata?.notes_status === 'available') return null;

  if (
    metadata?.notes_status === 'pending' ||
    metadata?.notes_status === 'processing' ||
    metadata?.transcript_status === 'queued' ||
    metadata?.transcript_status === 'processing' ||
    metadata?.source_status === 'pending' ||
    metadata?.source_status === 'processing'
  ) {
    return {
      kind: 'processing',
      message: metadata?.transcript_status === 'queued'
        ? 'Source queued. Notes will appear when processing finishes.'
        : 'Notes are being generated...',
    };
  }

  if (metadata?.notes_status === 'failed' || metadata?.transcript_status === 'unavailable') {
    return {
      kind: 'error',
      message: 'Notes could not be generated from this source.',
    };
  }

  return null;
}

export function getNodeSourceStatus(metadata?: IngestionMetadata | null): NodeTabStatus {
  if (!isSourceBacked(metadata)) return null;

  if (metadata?.source_status === 'available') return null;

  if (
    metadata?.source_status === 'pending' ||
    metadata?.source_status === 'processing' ||
    metadata?.transcript_status === 'queued' ||
    metadata?.transcript_status === 'processing'
  ) {
    return {
      kind: 'processing',
      message: metadata?.transcript_status === 'queued'
        ? 'Looking for source content...'
        : 'Source is being prepared...',
    };
  }

  if (metadata?.source_status === 'failed' || metadata?.transcript_status === 'unavailable') {
    return {
      kind: 'error',
      message: 'Source content could not be prepared.',
    };
  }

  return null;
}
