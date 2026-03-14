import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/tools/infrastructure/nodeFormatter', () => ({
  formatNodeForChat: ({ id, title }: { id: number; title: string }) => `#${id} ${title}`,
}));

vi.mock('@/services/ingestion/finalizeSourceNode', () => ({
  finalizePdfNode: vi.fn().mockResolvedValue(undefined),
}));

import { paperExtractTool } from '@/tools/other/paperExtract';

describe('paperExtractTool node creation payload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('setImmediate', vi.fn());
  });

  it('lets the node API generate the initial description instead of sending a canned pdf placeholder', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          id: 654,
          data: { dimensions: ['paper'] },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await paperExtractTool.execute!(
      { url: 'https://arxiv.org/pdf/1234.5678.pdf' },
      { toolCallId: 't', messages: [] },
    );

    expect((result as { success: boolean }).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;

    expect(body).toMatchObject({
      title: 'PDF: 1234.5678',
      link: 'https://arxiv.org/pdf/1234.5678.pdf',
      metadata: expect.objectContaining({
        source: 'pdf',
        hostname: 'arxiv.org',
      }),
    });
    expect(body).not.toHaveProperty('description');
  });
});
