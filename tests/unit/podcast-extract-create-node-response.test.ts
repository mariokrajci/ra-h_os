import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  generateTextMock,
  extractPodcastMock,
} = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  extractPodcastMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: generateTextMock,
  tool: (config: unknown) => config,
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model'),
}));

vi.mock('@/config/openaiModels', () => ({
  getOpenAIChatModel: () => 'gpt-4o-mini',
}));

vi.mock('@/services/analytics/usageLogger', () => ({
  logAiUsage: vi.fn(),
  normalizeUsageFromAiSdk: vi.fn(() => null),
}));

vi.mock('@/services/typescript/extractors/podcast', () => ({
  extractPodcast: extractPodcastMock,
}));

vi.mock('@/services/typescript/extractors/podcast-transcript', () => ({
  discoverTranscript: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/tools/infrastructure/nodeFormatter', () => ({
  formatNodeForChat: ({ id, title }: { id: number; title: string }) => `#${id} ${title}`,
}));

import { podcastExtractTool } from '@/tools/other/podcastExtract';

describe('podcastExtractTool node creation payload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('setImmediate', vi.fn());
    extractPodcastMock.mockResolvedValue({
      success: true,
      metadata: {
        source: 'podcast_episode',
        podcast_name: 'No Stupid Questions',
        episode_title: 'Episode 42',
        description: 'Episode description',
        transcript_status: 'queued',
      },
    });
  });

  it('keeps the custom AI description when podcast analysis succeeds', async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        nodeDescription: 'Podcast episode where the hosts argue that compromise is a practical skill worth relearning.',
        tags: ['podcast'],
      }),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          id: 100,
          data: { dimensions: ['podcast'] },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await podcastExtractTool.execute!(
      { url: 'https://example.com/podcast/42' },
      { toolCallId: 't', messages: [] },
    );

    expect((result as { success: boolean }).success).toBe(true);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;

    expect(body.description).toBe(
      'Podcast episode where the hosts argue that compromise is a practical skill worth relearning.',
    );
  });

  it('lets the node API generate the fallback description when podcast analysis returns nothing', async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({
        tags: ['podcast'],
      }),
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          id: 101,
          data: { dimensions: ['podcast'] },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await podcastExtractTool.execute!(
      { url: 'https://example.com/podcast/42' },
      { toolCallId: 't', messages: [] },
    );

    expect((result as { success: boolean }).success).toBe(true);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = requestInit?.body ? JSON.parse(String(requestInit.body)) : null;

    expect(body).toMatchObject({
      title: 'Episode 42',
      link: 'https://example.com/podcast/42',
      metadata: expect.objectContaining({
        podcast_name: 'No Stupid Questions',
      }),
    });
    expect(body).not.toHaveProperty('description');
  });
});
