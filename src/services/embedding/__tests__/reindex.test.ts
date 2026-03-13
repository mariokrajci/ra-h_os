import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getNodesMock, embedNodeContentMock } = vi.hoisted(() => ({
  getNodesMock: vi.fn(),
  embedNodeContentMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodes: getNodesMock,
  },
}));

vi.mock('@/services/embedding/ingestion', () => ({
  embedNodeContent: embedNodeContentMock,
}));

import { formatReindexEmbeddingsReport, reindexEmbeddings } from '@/services/embedding/reindex';

describe('reindexEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forces re-embedding for each selected node', async () => {
    getNodesMock.mockResolvedValue([
      { id: 11, title: 'First' },
      { id: 12, title: 'Second' },
    ]);
    embedNodeContentMock
      .mockResolvedValueOnce({ success: true, overall_status: 'fully_embedded' })
      .mockResolvedValueOnce({ success: false, overall_status: 'failed', error: 'quota' });

    const result = await reindexEmbeddings();

    expect(embedNodeContentMock).toHaveBeenNthCalledWith(1, 11, { forceReEmbed: true });
    expect(embedNodeContentMock).toHaveBeenNthCalledWith(2, 12, { forceReEmbed: true });
    expect(result).toEqual({
      total: 2,
      succeeded: 1,
      failed: 1,
      failures: [{ nodeId: 12, message: 'quota' }],
    });
  });

  it('can limit reindexing to specific node ids', async () => {
    getNodesMock.mockResolvedValue([
      { id: 11, title: 'First' },
      { id: 12, title: 'Second' },
      { id: 13, title: 'Third' },
    ]);
    embedNodeContentMock.mockResolvedValue({ success: true, overall_status: 'fully_embedded' });

    const result = await reindexEmbeddings({ nodeIds: [12, 13] });

    expect(embedNodeContentMock).toHaveBeenCalledTimes(2);
    expect(embedNodeContentMock).toHaveBeenNthCalledWith(1, 12, { forceReEmbed: true });
    expect(embedNodeContentMock).toHaveBeenNthCalledWith(2, 13, { forceReEmbed: true });
    expect(result.total).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('formats a readable reindex summary', () => {
    const report = formatReindexEmbeddingsReport({
      total: 3,
      succeeded: 2,
      failed: 1,
      failures: [{ nodeId: 15, message: 'quota' }],
    });

    expect(report).toContain('Reindexed 2/3 nodes successfully.');
    expect(report).toContain('- Node 15: quota');
  });
});
