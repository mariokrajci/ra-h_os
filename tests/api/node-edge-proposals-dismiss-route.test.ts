import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getNodeByIdMock, dismissProposalMock } = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  dismissProposalMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
  },
}));

vi.mock('@/services/edges/proposalDismissals', () => ({
  proposalDismissalService: {
    dismissProposal: dismissProposalMock,
  },
}));

import { POST } from '../../app/api/nodes/[id]/edge-proposals/dismiss/route';

describe('POST /api/nodes/[id]/edge-proposals/dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeByIdMock.mockResolvedValue({ id: 42, title: 'Active note' });
    dismissProposalMock.mockResolvedValue(undefined);
  });

  it('persists dismissal for a source-target pair', async () => {
    const request = new Request('http://localhost/api/nodes/42/edge-proposals/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_node_id: 11 }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '42' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(dismissProposalMock).toHaveBeenCalledWith(42, 11);
    expect(json.success).toBe(true);
  });

  it('rejects invalid target ids', async () => {
    const request = new Request('http://localhost/api/nodes/42/edge-proposals/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_node_id: 0 }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '42' }),
    });

    expect(response.status).toBe(400);
    expect(dismissProposalMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the source note does not exist', async () => {
    getNodeByIdMock.mockResolvedValue(null);
    const request = new Request('http://localhost/api/nodes/999/edge-proposals/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_node_id: 11 }),
    });

    const response = await POST(request as any, {
      params: Promise.resolve({ id: '999' }),
    });

    expect(response.status).toBe(404);
    expect(dismissProposalMock).not.toHaveBeenCalled();
  });
});
