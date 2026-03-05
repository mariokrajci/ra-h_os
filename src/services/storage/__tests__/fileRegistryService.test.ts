import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('@/services/database/sqlite-client', () => ({
  getSQLiteClient: () => ({
    query,
  }),
}));

import { fileRegistryService } from '../fileRegistryService';

describe('fileRegistryService', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('upserts a file record and returns the stored row', async () => {
    query.mockReturnValueOnce({ rows: [] });
    query.mockReturnValueOnce({
      rows: [
        {
          id: 7,
          node_id: 12,
          kind: 'pdf',
          storage_path: '/tmp/12.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1337,
          sha256: 'abc123',
          status: 'ready',
        },
      ],
    });

    const row = await fileRegistryService.upsertFileRecord({
      nodeId: 12,
      kind: 'pdf',
      storagePath: '/tmp/12.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1337,
      sha256: 'abc123',
      status: 'ready',
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(row?.node_id).toBe(12);
    expect(row?.kind).toBe('pdf');
  });

  it('returns a record by node id and kind', async () => {
    query.mockReturnValueOnce({
      rows: [
        {
          id: 3,
          node_id: 8,
          kind: 'epub',
          storage_path: '/tmp/8.epub',
          mime_type: 'application/epub+zip',
          size_bytes: 99,
          sha256: 'def456',
          status: 'ready',
        },
      ],
    });

    const row = await fileRegistryService.getFileRecordByNodeAndKind(8, 'epub');
    expect(row?.kind).toBe('epub');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM files'),
      [8, 'epub'],
    );
  });

  it('marks status changes for existing records', async () => {
    query.mockReturnValueOnce({ rows: [] });
    await fileRegistryService.markFileStatus(5, 'pdf', 'missing');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE files'),
      ['missing', 5, 'pdf'],
    );
  });
});
