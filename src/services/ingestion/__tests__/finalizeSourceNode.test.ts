import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  extractPaperMock,
  extractWebsiteMock,
  getNodeByIdMock,
  updateNodeMock,
  enqueueMock,
  buildSourceNotesInputMock,
} = vi.hoisted(() => ({
  extractPaperMock: vi.fn(),
  extractWebsiteMock: vi.fn(),
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  enqueueMock: vi.fn(),
  buildSourceNotesInputMock: vi.fn(),
}));

vi.mock('@/services/typescript/extractors/paper', () => ({
  extractPaper: extractPaperMock,
}));

vi.mock('@/services/typescript/extractors/website', () => ({
  extractWebsite: extractWebsiteMock,
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
  buildSourceNotesInput: buildSourceNotesInputMock,
}));

import { finalizePdfNode, finalizeWebsiteNode } from '@/services/ingestion/finalizeSourceNode';

describe('finalizePdfNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeByIdMock.mockResolvedValue({
      id: 42,
      title: 'PDF: 1234.5678',
      metadata: { source: 'pdf', existing: true },
    });
    updateNodeMock.mockResolvedValue(undefined);
    buildSourceNotesInputMock.mockImplementation(({ sourceText }: { sourceText: string }) => {
      if (sourceText.length > 100000) {
        return {
          sourceExcerpt:
            'Introduction\nIntro body\n\nAbout This Book\nAbout body\n\nChapter 1: Surveying the World of Stock Investing\nFirst chapter body\n\nChapter 25: Ten Investing Pitfalls and Challenges for 2020–2030\nLast chapter body',
          strategy: 'book_sections',
          sectionTitles: [
            'Introduction',
            'About This Book',
            'Chapter 1: Surveying the World of Stock Investing',
            'Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030',
          ],
        };
      }

      return {
        sourceExcerpt: sourceText,
        strategy: 'full',
      };
    });
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
        }),
      }),
    );
    expect(updateNodeMock).toHaveBeenCalledOnce();
    expect(updateNodeMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        title: 'Test Paper',
        chunk: 'Extracted PDF text',
        metadata: expect.objectContaining({
          author: 'Metadata Author',
          source_status: 'available',
        }),
      }),
    );
    expect(updateNodeMock.mock.calls[0]?.[1]?.metadata).not.toHaveProperty('notes_status');
    expect(enqueueMock).toHaveBeenCalledWith(42, { reason: 'pdf_source_ready' });
  });

  it('promotes placeholder website titles to extracted titles', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 42,
      title: 'Website: arcinstitute.org',
      metadata: { source: 'website', existing: true },
    });
    extractWebsiteMock.mockResolvedValue({
      content: 'Formatted content',
      chunk: '# ARC Institute\n\nResearch content',
      metadata: {
        title: 'ARC Institute',
        description: 'Research institute site',
        extraction_method: 'cheerio',
        site_name: 'ARC',
      },
      url: 'https://arcinstitute.org',
    });

    await finalizeWebsiteNode({
      nodeId: 42,
      title: 'Website: arcinstitute.org',
      url: 'https://arcinstitute.org',
    });

    expect(updateNodeMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        title: 'ARC Institute',
        chunk: '# ARC Institute\n\nResearch content',
        metadata: expect.objectContaining({
          title: 'ARC Institute',
          source_status: 'available',
        }),
      }),
    );
  });

  it('stores PDF notes generation strategy metadata for large PDFs', async () => {
    extractPaperMock.mockResolvedValue({
      content: 'Formatted content',
      chunk:
        `Table of Contents
Introduction 1
About This Book 2
Chapter 1: Surveying the World of Stock Investing 7
Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030 319

Introduction
Intro body

About This Book
About body

Chapter 1: Surveying the World of Stock Investing
First chapter body

Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030
Last chapter body
` + 'x'.repeat(120000),
      metadata: {
        title: 'Large PDF',
        pages: 24,
        info: { Author: 'Metadata Author' },
        text_length: 120100,
        filename: 'paper.pdf',
        extraction_method: 'typescript_pdfjs_dist',
      },
      url: 'https://example.com/paper.pdf',
    });

    await finalizePdfNode({
      nodeId: 42,
      title: 'Large PDF',
      url: 'https://example.com/paper.pdf',
    });

    expect(updateNodeMock).toHaveBeenLastCalledWith(
      42,
      expect.objectContaining({
        metadata: expect.objectContaining({
          notes_generation_strategy: 'book_sections',
          notes_generation_sections: [
            'Introduction',
            'About This Book',
            'Chapter 1: Surveying the World of Stock Investing',
            'Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030',
          ],
        }),
      }),
    );
    expect(enqueueMock).toHaveBeenCalledWith(42, { reason: 'pdf_source_ready' });
  });
});
