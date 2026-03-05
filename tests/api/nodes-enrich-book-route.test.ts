import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getNodeByIdMock, enqueueBookEnrichmentMock } = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  enqueueBookEnrichmentMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
  },
}));

vi.mock('@/services/ingestion/bookEnrichmentQueue', () => ({
  bookEnrichmentQueue: {
    enqueue: enqueueBookEnrichmentMock,
  },
}));

import { POST } from '../../app/api/nodes/[id]/enrich-book/route';

describe('POST /api/nodes/[id]/enrich-book', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when node does not exist', async () => {
    getNodeByIdMock.mockResolvedValue(null);

    const request = new Request('http://localhost/api/nodes/42/enrich-book', {
      method: 'POST',
    });

    const response = await POST(request as any, { params: Promise.resolve({ id: '42' }) });
    expect(response.status).toBe(404);
    expect(enqueueBookEnrichmentMock).not.toHaveBeenCalled();
  });

  it('returns 400 when node is not a book', async () => {
    getNodeByIdMock.mockResolvedValue({ id: 42, title: 'Note', metadata: { source: 'quick-add-note' } });

    const request = new Request('http://localhost/api/nodes/42/enrich-book', {
      method: 'POST',
    });

    const response = await POST(request as any, { params: Promise.resolve({ id: '42' }) });
    expect(response.status).toBe(400);
    expect(enqueueBookEnrichmentMock).not.toHaveBeenCalled();
  });

  it('enqueues enrichment for book nodes', async () => {
    getNodeByIdMock.mockResolvedValue({ id: 42, title: 'Atomic Habits', metadata: { content_kind: 'book' } });

    const request = new Request('http://localhost/api/nodes/42/enrich-book', {
      method: 'POST',
    });

    const response = await POST(request as any, { params: Promise.resolve({ id: '42' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(enqueueBookEnrichmentMock).toHaveBeenCalledWith(42, { reason: 'manual_retry' });
    expect(json.success).toBe(true);
  });
});
