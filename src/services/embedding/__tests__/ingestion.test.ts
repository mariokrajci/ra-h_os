import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getNodeByIdMock,
  updateNodeMock,
  embedNodesMock,
  processNodeMock,
} = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  embedNodesMock: vi.fn(),
  processNodeMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
  },
}));

vi.mock('@/services/typescript/embed-nodes', () => ({
  NodeEmbedder: vi.fn().mockImplementation(() => ({
    embedNodes: embedNodesMock,
    close: vi.fn(),
  })),
}));

vi.mock('@/services/typescript/embed-universal', () => ({
  UniversalEmbedder: vi.fn().mockImplementation(() => ({
    processNode: processNodeMock,
    close: vi.fn(),
  })),
}));

import { embedNodeContent } from '@/services/embedding/ingestion';

describe('embedNodeContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeByIdMock.mockResolvedValue({ id: 7, chunk: null });
    embedNodesMock.mockResolvedValue({ processed: 1, failed: 0 });
  });

  it('passes forceReEmbed through to node embedding during reindexing', async () => {
    await embedNodeContent(7, { forceReEmbed: true });

    expect(embedNodesMock).toHaveBeenCalledWith({ nodeId: 7, forceReEmbed: true });
  });
});
