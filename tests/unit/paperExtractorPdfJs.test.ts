import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocumentMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: getDocumentMock,
}));

import {
  PaperExtractor,
  normalizePdfJsAnnotation,
  normalizePdfJsTextItem,
} from '@/services/typescript/extractors/paper';

describe('pdfjs helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves text positioning data', () => {
    const item = normalizePdfJsTextItem({
      str: 'Introduction',
      dir: 'ltr',
      width: 42,
      height: 10,
      transform: [1, 0, 0, 1, 100, 200],
      fontName: 'g_d0_f1',
    });

    expect(item.text).toBe('Introduction');
    expect(item.x).toBe(100);
    expect(item.y).toBe(200);
    expect(item.transform).toEqual([1, 0, 0, 1, 100, 200]);
  });

  it('normalizes PDF annotations into a stable shape', () => {
    const annotation = normalizePdfJsAnnotation({
      subtype: 'Link',
      url: 'https://example.com',
      title: 'Example',
      rect: [10, 20, 30, 40],
    });

    expect(annotation).toEqual({
      subtype: 'Link',
      url: 'https://example.com',
      title: 'Example',
      rect: [10, 20, 30, 40],
    });
  });

  it('passes Uint8Array binary data into pdfjs-dist', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [
              {
                str: 'Abstract',
                transform: [1, 0, 0, 1, 10, 20],
              },
            ],
          }),
          getAnnotations: async () => [],
        }),
        getMetadata: async () => ({
          info: { Title: 'Mock PDF' },
        }),
      }),
    });

    const extractor = new PaperExtractor();
    const result = await extractor.extractFromBuffer(Buffer.from('%PDF-1.4 mock body'), 'mock.pdf');

    expect(getDocumentMock).toHaveBeenCalledOnce();
    expect(getDocumentMock.mock.calls[0][0].data).toBeInstanceOf(Uint8Array);
    expect(Buffer.isBuffer(getDocumentMock.mock.calls[0][0].data)).toBe(false);
    expect(result.metadata.extraction_method).toBe('typescript_pdfjs_dist');
  });
});
