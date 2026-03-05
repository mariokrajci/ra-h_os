import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getNodeByIdMock,
  updateNodeMock,
  saveFileMock,
  upsertFileRecordMock,
} = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  saveFileMock: vi.fn(),
  upsertFileRecordMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
  },
}));

vi.mock('@/services/storage/fileService', () => ({
  fileService: {
    save: saveFileMock,
  },
}));

vi.mock('@/services/storage/fileRegistryService', () => ({
  fileRegistryService: {
    upsertFileRecord: upsertFileRecordMock,
  },
}));

import { POST } from '../../app/api/nodes/[id]/file/restore/route';

describe('POST /api/nodes/[id]/file/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeByIdMock.mockResolvedValue({ id: 14, metadata: {} });
    saveFileMock.mockResolvedValue({
      path: '/srv/files/14.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 11,
      sha256: 'abc',
    });
    upsertFileRecordMock.mockResolvedValue(undefined);
    updateNodeMock.mockResolvedValue(undefined);
  });

  it('restores uploaded pdf and updates registry + node metadata', async () => {
    const form = new FormData();
    form.append('file', new File([Buffer.from('%PDF')], 'restored.pdf', { type: 'application/pdf' }));

    const request = new Request('http://localhost/api/nodes/14/file/restore', {
      method: 'POST',
      body: form,
    });

    const response = await POST(request as any, { params: Promise.resolve({ id: '14' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(saveFileMock).toHaveBeenCalledWith(14, 'pdf', expect.any(Buffer));
    expect(upsertFileRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 14, kind: 'pdf', status: 'ready' }),
    );
    expect(updateNodeMock).toHaveBeenCalledWith(
      14,
      expect.objectContaining({
        metadata: expect.objectContaining({ file_type: 'pdf', file_path: '/srv/files/14.pdf' }),
      }),
    );
    expect(json.success).toBe(true);
  });
});
