import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getNodeByIdMock, generateEdgeProposalsMock } = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  generateEdgeProposalsMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
  },
}));

vi.mock('@/services/edges/proposals', () => ({
  generateEdgeProposals: generateEdgeProposalsMock,
}));

import { GET } from '../../app/api/nodes/[id]/edge-proposals/route';

describe('GET /api/nodes/[id]/edge-proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeByIdMock.mockResolvedValue({ id: 42, title: 'Active note' });
    generateEdgeProposalsMock.mockResolvedValue([
      {
        sourceNodeId: 42,
        targetNodeId: 5,
        targetNodeTitle: 'Simon Willison',
        reason: 'Explicitly mentioned in description: "Simon Willison"',
        matchedText: 'Simon Willison',
      },
    ]);
  });

  it('returns proposals for a valid note', async () => {
    const response = await GET(new Request('http://localhost/api/nodes/42/edge-proposals') as any, {
      params: Promise.resolve({ id: '42' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(generateEdgeProposalsMock).toHaveBeenCalledWith(42);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].targetNodeTitle).toBe('Simon Willison');
  });

  it('returns 404 when the note does not exist', async () => {
    getNodeByIdMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/nodes/999/edge-proposals') as any, {
      params: Promise.resolve({ id: '999' }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(generateEdgeProposalsMock).not.toHaveBeenCalled();
    expect(json.success).toBe(false);
  });
});
