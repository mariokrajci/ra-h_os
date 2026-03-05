import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createNodeMock,
  getNodesMock,
  countNodesMock,
  enqueueMock,
  hasSufficientContentMock,
  generateDescriptionMock,
  assignDimensionsMock,
  ensureKeywordDimensionMock,
  scheduleAutoEdgeCreationMock,
} = vi.hoisted(() => ({
  createNodeMock: vi.fn(),
  getNodesMock: vi.fn(),
  countNodesMock: vi.fn(),
  enqueueMock: vi.fn(),
  hasSufficientContentMock: vi.fn(),
  generateDescriptionMock: vi.fn(),
  assignDimensionsMock: vi.fn(),
  ensureKeywordDimensionMock: vi.fn(),
  scheduleAutoEdgeCreationMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    createNode: createNodeMock,
    getNodes: getNodesMock,
    countNodes: countNodesMock,
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

vi.mock('@/services/database/dimensionService', () => ({
  DimensionService: {
    assignDimensions: assignDimensionsMock,
    ensureKeywordDimension: ensureKeywordDimensionMock,
  },
}));

vi.mock('@/services/database/descriptionService', () => ({
  generateDescription: generateDescriptionMock,
}));

vi.mock('@/services/agents/autoEdge', () => ({
  scheduleAutoEdgeCreation: scheduleAutoEdgeCreationMock,
}));

import { POST } from '../../app/api/nodes/route';

describe('POST /api/nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSufficientContentMock.mockReturnValue(false);
    generateDescriptionMock.mockResolvedValue('Generated description');
    assignDimensionsMock.mockResolvedValue({ locked: [], keywords: [] });
    createNodeMock.mockResolvedValue({ id: 101, title: 'Created node' });
  });

  it('does not mirror long note-only content into chunk/source', async () => {
    hasSufficientContentMock.mockReturnValue(true);

    const request = new Request('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Long Note',
        notes: 'A'.repeat(500),
      }),
    });

    const response = await POST(request as any);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(createNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'A'.repeat(500),
        chunk: undefined,
        chunk_status: undefined,
      }),
    );
    expect(enqueueMock).toHaveBeenCalledWith(101, { reason: 'note_created' });
    expect(json.success).toBe(true);
  });

  it('keeps source chunk behavior for source-backed nodes', async () => {
    hasSufficientContentMock.mockReturnValue(true);

    const request = new Request('http://localhost/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Source Node',
        notes: 'Some notes',
        chunk: 'raw source text',
      }),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(201);
    expect(createNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chunk: 'raw source text',
        chunk_status: 'not_chunked',
      }),
    );
    expect(enqueueMock).toHaveBeenCalledWith(101, { reason: 'node_created' });
  });
});
