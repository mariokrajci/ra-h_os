import { describe, expect, it } from 'vitest';

import {
  detectReaderMode,
  getPdfRenderMetrics,
  getMostRelevantPdfPage,
  getReaderSource,
  getTextFallbackPalette,
  resolveTextFallbackType,
} from '@/components/focus/reader/utils';

describe('book reader utils', () => {
  it('prefers stored file metadata when choosing the reader mode', () => {
    expect(detectReaderMode({ file_type: 'pdf' }, 'https://example.com/book.epub', 'text')).toBe('pdf');
    expect(detectReaderMode({ file_type: 'epub' }, 'https://example.com/paper.pdf', 'text')).toBe('epub');
  });

  it('falls back to link heuristics and then text mode', () => {
    expect(detectReaderMode({}, 'https://example.com/paper.pdf', 'text')).toBe('pdf');
    expect(detectReaderMode({}, 'https://example.com/book.epub', 'text')).toBe('epub');
    expect(detectReaderMode({}, undefined, 'plain extracted text')).toBe('text');
  });

  it('prefers the stored file route when a stored file exists', () => {
    expect(getReaderSource(42, { file_type: 'pdf' }, 'https://example.com/paper.pdf')).toBe('/api/nodes/42/file');
    expect(getReaderSource(77, { file_type: 'epub' }, undefined)).toBe('/api/nodes/77/file');
  });

  it('routes linked pdf and epub sources through the same-origin file proxy', () => {
    expect(getReaderSource(42, {}, 'https://example.com/paper.pdf')).toBe('/api/nodes/42/file');
    expect(getReaderSource(42, {}, 'https://example.com/book.epub')).toBe('/api/nodes/42/file');
  });

  it('falls back to the raw link only for non-document sources', () => {
    expect(getReaderSource(42, {}, 'https://example.com/article')).toBe('https://example.com/article');
    expect(getReaderSource(42, {}, undefined)).toBe('');
  });

  it('detects markdown and transcript content for text fallback rendering', () => {
    expect(resolveTextFallbackType('# Heading\n\n- one\n- two\n\n`code`')).toBe('markdown');
    expect(resolveTextFallbackType('[00:01] HOST: hello\n[00:03] GUEST: hi\n[00:05] HOST: welcome')).toBe('transcript');
    expect(resolveTextFallbackType('A plain paragraph without markdown syntax.')).toBe('raw');
  });

  it('returns readable palette colors for both reader themes', () => {
    expect(getTextFallbackPalette('warm')).toEqual({
      body: '#2c2820',
      muted: '#6b6257',
      heading: '#1f1a14',
      accent: '#0f766e',
      blockquote: '#5f554a',
      blockquoteBorder: '#cbb89d',
      codeBackground: 'rgba(120, 93, 46, 0.12)',
      rule: '#d8c8ae',
      tableBorder: '#d8c8ae',
    });
    expect(getTextFallbackPalette('dark').body).toBe('#d4d4d4');
  });

  it('computes crisp canvas metrics without changing CSS page geometry', () => {
    expect(getPdfRenderMetrics(800, 1000, 2)).toEqual({
      cssWidth: 800,
      cssHeight: 1000,
      canvasWidth: 1600,
      canvasHeight: 2000,
      transform: [2, 0, 0, 2, 0, 0],
    });
    expect(getPdfRenderMetrics(800, 1000, 1)).toEqual({
      cssWidth: 800,
      cssHeight: 1000,
      canvasWidth: 800,
      canvasHeight: 1000,
      transform: null,
    });
  });

  it('prefers the page with the largest visible overlap in scroll mode', () => {
    expect(
      getMostRelevantPdfPage(
        [
          { pageNumber: 1, top: -200, height: 900 },
          { pageNumber: 2, top: 120, height: 900 },
          { pageNumber: 3, top: 1080, height: 900 },
        ],
        1000,
      ),
    ).toBe(2);
  });
});
