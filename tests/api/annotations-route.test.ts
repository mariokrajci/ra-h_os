import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getNodeByIdMock,
  createAnnotationWithNotesMock,
} = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  createAnnotationWithNotesMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  annotationService: {
    createAnnotationWithNotes: createAnnotationWithNotesMock,
    getAnnotationsForNode: vi.fn(),
  },
  nodeService: {
    getNodeById: getNodeByIdMock,
  },
}));

import { POST } from '../../app/api/annotations/route';

describe('POST /api/annotations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeByIdMock.mockResolvedValue({
      id: 42,
      chunk: 'Alpha beta gamma. Alpha beta gamma repeated.',
    });
    createAnnotationWithNotesMock.mockReturnValue({
      id: 9,
      node_id: 42,
      text: 'Alpha beta gamma',
      color: 'yellow',
      occurrence_index: 1,
      source_mode: 'pdf',
      anchor: { page: 2, rects: [[0, 0, 10, 10]] },
      fallback_context: 'repeated.',
      created_at: '2026-03-02T12:00:00.000Z',
    });
  });

  it('forwards native anchor metadata while still computing occurrence index from source text', async () => {
    const request = new Request('http://localhost/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_id: 42,
        text: 'Alpha beta gamma',
        color: 'yellow',
        comment: 'Important figure',
        start_offset: 20,
        source_mode: 'pdf',
        anchor: { page: 2, rects: [[0, 0, 10, 10]] },
        fallback_context: 'repeated.',
      }),
    });

    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(createAnnotationWithNotesMock).toHaveBeenCalledWith({
      node_id: 42,
      text: 'Alpha beta gamma',
      color: 'yellow',
      comment: 'Important figure',
      occurrence_index: 1,
      source_mode: 'pdf',
      anchor: { page: 2, rects: [[0, 0, 10, 10]] },
      fallback_context: 'repeated.',
    });
    expect(json.success).toBe(true);
  });
});
