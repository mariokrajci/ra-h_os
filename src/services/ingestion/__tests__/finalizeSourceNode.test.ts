import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  extractPaperMock,
  getNodeByIdMock,
  updateNodeMock,
  enqueueMock,
  generateSourceNotesMock,
} = vi.hoisted(() => ({
  extractPaperMock: vi.fn(),
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  enqueueMock: vi.fn(),
  generateSourceNotesMock: vi.fn(),
}));

vi.mock('@/services/typescript/extractors/paper', () => ({
  extractPaper: extractPaperMock,
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
  },
}));

vi.mock('@/services/embedding/autoEmbedQueue', () => ({
  autoEmbedQueue: {
    enqueue: enqueueMock,
  },
}));

vi.mock('@/services/ingestion/generateSourceNotes', () => ({
  generateSourceNotes: generateSourceNotesMock,
}));

import { finalizePdfNode } from '@/services/ingestion/finalizeSourceNode';

describe('finalizePdfNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeByIdMock.mockResolvedValue({
      id: 42,
      metadata: { source: 'pdf', existing: true },
    });
    updateNodeMock.mockResolvedValue(undefined);
    generateSourceNotesMock.mockResolvedValue('generated notes');
  });

  it('falls back to PDF info author metadata when direct author is absent', async () => {
    extractPaperMock.mockResolvedValue({
      content: 'Formatted content',
      chunk: 'Extracted PDF text',
      metadata: {
        title: 'Test Paper',
        pages: 12,
        info: { Author: 'Metadata Author' },
        text_length: 1024,
        filename: 'paper.pdf',
        extraction_method: 'typescript_pdf-parse',
      },
      url: 'https://example.com/paper.pdf',
    });

    await finalizePdfNode({
      nodeId: 42,
      title: 'Test Paper',
      url: 'https://example.com/paper.pdf',
    });

    expect(updateNodeMock).toHaveBeenNthCalledWith(
      1,
      42,
      expect.objectContaining({
        metadata: expect.objectContaining({
          author: 'Metadata Author',
          source_status: 'available',
          notes_status: 'processing',
        }),
      }),
    );
    expect(generateSourceNotesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          author: 'Metadata Author',
        }),
      }),
    );
  });
});
