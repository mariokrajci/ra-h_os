import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch to capture what gets sent to /api/nodes
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('setImmediate', (fn: () => void) => fn());

// Mock external dependencies
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

import { enqueueQuickAdd } from '@/services/agents/quickAdd';

describe('enqueueQuickAdd with sourceUrl/sourceTitle', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 1 } }),
    });
  });

  it('passes sourceUrl as link and sourceTitle in metadata for note input', async () => {
    await enqueueQuickAdd({
      rawInput: 'Some selected text from an article',
      mode: 'note',
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Example Article',
      baseUrl: 'http://localhost:3000',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.link).toBe('https://example.com/article');
    expect(body.metadata.source_title).toBe('Example Article');
  });

  it('passes sourceUrl and sourceTitle for chat transcript input', async () => {
    await enqueueQuickAdd({
      rawInput: 'User: hello\nAssistant: hi there',
      mode: 'chat',
      sourceUrl: 'https://chatgpt.com/c/abc123',
      sourceTitle: 'ChatGPT conversation',
      baseUrl: 'http://localhost:3000',
    });
    // Chat path has getNodeByLink + summarizeTranscript before fetch; flush extra microtask turn.
    await Promise.resolve();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.link).toBe('https://chatgpt.com/c/abc123');
    expect(body.metadata.source_title).toBe('ChatGPT conversation');
  });

  it('omits link and source_title when sourceUrl is not provided', async () => {
    await enqueueQuickAdd({
      rawInput: 'A plain note with no source',
      mode: 'note',
      baseUrl: 'http://localhost:3000',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.link).toBeUndefined();
    expect(body.metadata.source_title).toBeUndefined();
  });
});
