import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getNodeByIdMock,
  updateNodeMock,
  getFileRecordByNodeAndKindMock,
  upsertFileRecordMock,
  markFileStatusMock,
  existsAtPathMock,
  readAtPathMock,
  existsLegacyMock,
  readLegacyMock,
  saveFileMock,
} = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  getFileRecordByNodeAndKindMock: vi.fn(),
  upsertFileRecordMock: vi.fn(),
  markFileStatusMock: vi.fn(),
  existsAtPathMock: vi.fn(),
  readAtPathMock: vi.fn(),
  existsLegacyMock: vi.fn(),
  readLegacyMock: vi.fn(),
  saveFileMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
  },
}));

vi.mock('@/services/storage/fileRegistryService', () => ({
  fileRegistryService: {
    getFileRecordByNodeAndKind: getFileRecordByNodeAndKindMock,
    upsertFileRecord: upsertFileRecordMock,
    markFileStatus: markFileStatusMock,
  },
}));

vi.mock('@/services/storage/fileService', () => ({
  fileService: {
    existsAtPath: existsAtPathMock,
    readAtPath: readAtPathMock,
    exists: existsLegacyMock,
    read: readLegacyMock,
    save: saveFileMock,
  },
}));

import { GET } from '../../app/api/nodes/[id]/file/route';

describe('GET /api/nodes/[id]/file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFileRecordByNodeAndKindMock.mockResolvedValue(null);
    markFileStatusMock.mockResolvedValue(undefined);
    existsAtPathMock.mockResolvedValue(false);
    readAtPathMock.mockResolvedValue(Buffer.from(''));
    existsLegacyMock.mockResolvedValue(false);
    readLegacyMock.mockResolvedValue(Buffer.from(''));
    saveFileMock.mockResolvedValue({
      path: '/srv/files/15.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      sha256: 'abc123',
    });
    upsertFileRecordMock.mockResolvedValue(undefined);
    updateNodeMock.mockResolvedValue(undefined);
  });

  it('serves a registered file when registry record and path exist', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 15,
      link: null,
      metadata: { file_type: 'pdf' },
    });
    getFileRecordByNodeAndKindMock.mockResolvedValue({
      node_id: 15,
      kind: 'pdf',
      storage_path: '/srv/files/15.pdf',
      mime_type: 'application/pdf',
      status: 'ready',
    });
    existsAtPathMock.mockResolvedValue(true);
    readAtPathMock.mockResolvedValue(Buffer.from('%PDF-sample'));

    const response = await GET(new Request('http://localhost/api/nodes/15/file') as any, {
      params: Promise.resolve({ id: '15' }),
    });
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(body).toString()).toContain('%PDF');
  });

  it('returns 409 when registry entry exists but file is missing', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 15,
      link: null,
      metadata: { file_type: 'pdf' },
    });
    getFileRecordByNodeAndKindMock.mockResolvedValue({
      node_id: 15,
      kind: 'pdf',
      storage_path: '/srv/files/15.pdf',
      mime_type: 'application/pdf',
      status: 'ready',
    });
    existsAtPathMock.mockResolvedValue(false);

    const response = await GET(new Request('http://localhost/api/nodes/15/file') as any, {
      params: Promise.resolve({ id: '15' }),
    });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe('FILE_MISSING_ON_DISK');
    expect(markFileStatusMock).toHaveBeenCalledWith(15, 'pdf', 'missing');
  });

  it('returns 502 when remote fetch throws a network error', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 15,
      link: 'http://127.0.0.1:8123/long.pdf',
      metadata: { source: 'pdf' },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8123')),
    );

    const response = await GET(new Request('http://localhost/api/nodes/15/file') as any, {
      params: Promise.resolve({ id: '15' }),
    });
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.success).toBe(false);
    expect(json.code).toBe('REMOTE_FETCH_FAILED');
    expect(json.error).toContain('Failed to fetch remote document');
  });

  it('repairs registry entry from legacy local file when legacy path exists', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 15,
      link: null,
      metadata: { file_type: 'pdf' },
    });
    existsLegacyMock.mockResolvedValue(true);
    readLegacyMock.mockResolvedValue(Buffer.from('%PDF-legacy'));

    const response = await GET(new Request('http://localhost/api/nodes/15/file') as any, {
      params: Promise.resolve({ id: '15' }),
    });
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(Buffer.from(body).toString()).toContain('%PDF-legacy');
    expect(saveFileMock).toHaveBeenCalledWith(15, 'pdf', expect.any(Buffer));
    expect(upsertFileRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 15,
        kind: 'pdf',
        storagePath: '/srv/files/15.pdf',
        mimeType: 'application/pdf',
        status: 'ready',
      }),
    );
  });

  it('caches remote pdf locally after successful fetch', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 15,
      link: 'https://example.com/file.pdf',
      metadata: { source: 'pdf' },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(Buffer.from('%PDF-remote'), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
      ),
    );

    const response = await GET(new Request('http://localhost/api/nodes/15/file') as any, {
      params: Promise.resolve({ id: '15' }),
    });

    expect(response.status).toBe(200);
    expect(saveFileMock).toHaveBeenCalledWith(15, 'pdf', expect.any(Buffer));
    expect(upsertFileRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 15,
        kind: 'pdf',
      }),
    );
    expect(updateNodeMock).toHaveBeenCalledWith(
      15,
      expect.objectContaining({
        metadata: expect.objectContaining({
          file_type: 'pdf',
          file_path: '/srv/files/15.pdf',
        }),
      }),
    );
  });

  it('returns 404 when no file source is available', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 20,
      link: null,
      metadata: {},
    });

    const response = await GET(new Request('http://localhost/api/nodes/20/file') as any, {
      params: Promise.resolve({ id: '20' }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.code).toBe('NO_DOCUMENT_SOURCE');
  });
});
