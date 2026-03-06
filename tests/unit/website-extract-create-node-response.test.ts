import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/tools/infrastructure/nodeFormatter', () => ({
  formatNodeForChat: ({ id, title }: { id: number; title: string }) => `#${id} ${title}`,
}));

vi.mock('@/services/ingestion/finalizeSourceNode', () => ({
  finalizeWebsiteNode: vi.fn().mockResolvedValue(undefined),
}));

import { websiteExtractTool } from '@/tools/other/websiteExtract';

interface ToolRunResult {
  success: boolean;
  error?: string;
  data?: {
    nodeId?: number;
  } | null;
}

async function runWebsiteExtract(url: string): Promise<ToolRunResult> {
  const result = await websiteExtractTool.execute!({ url }, { toolCallId: 't', messages: [] });
  return result as ToolRunResult;
}

describe('websiteExtractTool node creation response handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts successful create responses where id is at the top level', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            id: 321,
            data: { dimensions: ['website'] },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const result = await runWebsiteExtract('https://github.com/vercel/next.js');

    expect(result.success).toBe(true);
    expect(result.data?.nodeId).toBe(321);
  });

  it('returns http status details when create node request fails without explicit error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false }), {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const result = await runWebsiteExtract('https://github.com/vercel/next.js');

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 502');
  });
});
