import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getNodeByIdMock,
  updateNodeMock,
  enqueueMock,
  hasSufficientContentMock,
} = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  enqueueMock: vi.fn(),
  hasSufficientContentMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
    deleteNode: vi.fn(),
  },
}));

vi.mock('@/services/embedding/autoEmbedQueue', () => ({
  autoEmbedQueue: {
    enqueue: enqueueMock,
  },
}));

vi.mock('@/services/embedding/constants', () => ({
  hasSufficientContent: hasSufficientContentMock,
}));

import { PATCH } from '../../app/api/nodes/[id]/route';

describe('PATCH /api/nodes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSufficientContentMock.mockReturnValue(false);
    getNodeByIdMock.mockResolvedValue({
      id: 42,
      title: 'Existing node',
      chunk: 'existing chunk',
      metadata: {
        book_title: 'Existing Book',
        cover_url: 'https://example.com/cover.jpg',
      },
    });
    updateNodeMock.mockImplementation(async (_id: number, updates: Record<string, unknown>) => ({
      id: 42,
      title: 'Existing node',
      chunk: 'existing chunk',
      metadata: updates.metadata,
    }));
  });

  it('merges incoming metadata into existing node metadata instead of replacing it', async () => {
    const request = new Request('http://localhost/api/nodes/42', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata: {
          reading_progress: {
            mode: 'pdf',
            percent: 38,
            page: 14,
            total_pages: 36,
            last_read_at: '2026-03-02T12:00:00.000Z',
          },
        },
      }),
    });

    const response = await PATCH(request as any, {
      params: Promise.resolve({ id: '42' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(updateNodeMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        metadata: {
          book_title: 'Existing Book',
          cover_url: 'https://example.com/cover.jpg',
          reading_progress: {
            mode: 'pdf',
            percent: 38,
            page: 14,
            total_pages: 36,
            last_read_at: '2026-03-02T12:00:00.000Z',
          },
        },
      }),
    );
    expect(json.success).toBe(true);
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
