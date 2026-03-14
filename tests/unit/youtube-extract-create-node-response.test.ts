import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/tools/infrastructure/nodeFormatter', () => ({
  formatNodeForChat: ({ id, title }: { id: number; title: string }) => `#${id} ${title}`,
}));

vi.mock('@/services/ingestion/finalizeSourceNode', () => ({
  finalizeYouTubeNode: vi.fn().mockResolvedValue(undefined),
}));

import { youtubeExtractTool } from '@/tools/other/youtubeExtract';

describe('youtubeExtractTool node creation payload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('setImmediate', vi.fn());
  });

  it('lets the node API generate the initial description instead of sending a canned youtube placeholder', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'Great Video',
            author_name: 'Great Channel',
            author_url: 'https://youtube.com/@great',
            thumbnail_url: 'https://img.youtube.com/vi/abc/default.jpg',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            id: 321,
            data: { dimensions: ['video'] },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await youtubeExtractTool.execute!(
      { url: 'https://www.youtube.com/watch?v=abc123' },
      { toolCallId: 't', messages: [] },
    );

    expect((result as { success: boolean }).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;

    expect(body).toMatchObject({
      title: 'Great Video',
      link: 'https://www.youtube.com/watch?v=abc123',
      metadata: expect.objectContaining({
        source: 'youtube',
        channel_name: 'Great Channel',
      }),
    });
    expect(body).not.toHaveProperty('description');
  });
});
