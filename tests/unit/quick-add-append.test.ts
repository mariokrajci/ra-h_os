import { describe, expect, it, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('setImmediate', (fn: () => void) => fn());

vi.mock('@/services/agents/toolResultUtils', () => ({ summarizeToolExecution: vi.fn(() => '') }));
vi.mock('@/tools/other/youtubeExtract', () => ({ youtubeExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/websiteExtract', () => ({ websiteExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/paperExtract', () => ({ paperExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/podcastExtract', () => ({ podcastExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/infrastructure/nodeFormatter', () => ({ formatNodeForChat: vi.fn(() => '') }));
vi.mock('@/services/agents/transcriptSummarizer', () => ({
  summarizeTranscript: vi.fn(() => ({ summary: 'summary', subject: 'test' })),
}));
vi.mock('@/services/events', () => ({ eventBroadcaster: { broadcast: vi.fn() } }));
vi.mock('@/services/ingestion/bookMetadata', () => ({ fetchBookMetadata: vi.fn(() => null) }));
vi.mock('@/services/ingestion/bookCommand', () => ({
  parseBookCommand: vi.fn(() => ({ kind: 'none' })),
}));
vi.mock('@/services/ingestion/bookEnrichmentQueue', () => ({ bookEnrichmentQueue: { enqueue: vi.fn() } }));
vi.mock('@/services/analytics/bookTelemetry', () => ({ logBookTelemetry: vi.fn() }));
vi.mock('@/services/ingestion/bookCoverCache', () => ({ cacheBookCoverForNode: vi.fn() }));

// Mock nodeService with getNodeByLink
const { getNodeByLinkMock } = vi.hoisted(() => ({
  getNodeByLinkMock: vi.fn(),
}));
vi.mock('@/services/database/nodes', () => ({
  nodeService: { getNodeByLink: getNodeByLinkMock },
}));

import { enqueueQuickAdd } from '@/services/agents/quickAdd';

describe('enqueueQuickAdd append behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 1 } }),
    });
  });

  it('PATCHes existing node when sourceUrl matches an existing link', async () => {
    getNodeByLinkMock.mockResolvedValue({
      id: 42,
      title: 'Existing Article',
      notes: 'First highlight',
      link: 'https://example.com/article',
    });

    await enqueueQuickAdd({
      rawInput: 'Second highlight',
      mode: 'note',
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Example Article',
      baseUrl: 'http://localhost:3000',
    });

    // Should PATCH, not POST to /api/nodes
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/nodes/42',
      expect.objectContaining({ method: 'PATCH' })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.notes).toBe('First highlight\n\n---\n\nSecond highlight');
  });

  it('creates a new node when sourceUrl does not match any existing node', async () => {
    getNodeByLinkMock.mockResolvedValue(null);

    await enqueueQuickAdd({
      rawInput: 'New highlight',
      mode: 'note',
      sourceUrl: 'https://example.com/new-article',
      sourceTitle: 'New Article',
      baseUrl: 'http://localhost:3000',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/nodes',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('creates a new node when no sourceUrl is provided (skip dedup)', async () => {
    await enqueueQuickAdd({
      rawInput: 'A plain note',
      mode: 'note',
      baseUrl: 'http://localhost:3000',
    });

    expect(getNodeByLinkMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/nodes',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('appends to existing chat node when sourceUrl matches', async () => {
    getNodeByLinkMock.mockResolvedValue({
      id: 7,
      title: 'ChatGPT: previous chat',
      notes: 'Previous summary',
      link: 'https://chatgpt.com/c/abc123',
    });

    await enqueueQuickAdd({
      rawInput: 'User: hello\nAssistant: hi',
      mode: 'chat',
      sourceUrl: 'https://chatgpt.com/c/abc123',
      sourceTitle: 'ChatGPT conversation',
      baseUrl: 'http://localhost:3000',
    });
    // Chat path has an extra `await summarizeTranscript` before `fetch`, requiring
    // one additional microtask turn to flush before asserting.
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/nodes/7',
      expect.objectContaining({ method: 'PATCH' })
    );
  });
});
