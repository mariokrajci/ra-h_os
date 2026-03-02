import type { NodeMetadata } from '@/types/database';
import { detectContentType, type ContentType } from '../source/ContentDetector';

export type ReaderMode = 'pdf' | 'epub' | 'text';
export type TextFallbackType = 'book' | 'markdown' | 'transcript' | 'raw';
export type ReaderTheme = 'warm' | 'dark';

interface TextFallbackPalette {
  body: string;
  muted: string;
  heading: string;
  accent: string;
  blockquote: string;
  blockquoteBorder: string;
  codeBackground: string;
  rule: string;
  tableBorder: string;
}

interface PdfRenderMetrics {
  cssWidth: number;
  cssHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  transform: [number, number, number, number, number, number] | null;
}

interface PdfVisiblePageCandidate {
  pageNumber: number;
  top: number;
  height: number;
}

export function detectReaderMode(
  metadata?: NodeMetadata | null,
  link?: string,
  content?: string,
): ReaderMode {
  if (metadata?.file_type === 'pdf') return 'pdf';
  if (metadata?.file_type === 'epub') return 'epub';
  if (link?.match(/\.pdf($|\?)/i) || link?.includes('arxiv.org')) return 'pdf';
  if (link?.match(/\.epub($|\?)/i)) return 'epub';
  if (content?.trim()) return 'text';
  return 'text';
}

export function getReaderSource(
  nodeId: number,
  metadata?: NodeMetadata | null,
  link?: string,
): string {
  if (
    metadata?.file_type === 'pdf' ||
    metadata?.file_type === 'epub' ||
    link?.match(/\.(pdf|epub)($|\?)/i) ||
    link?.includes('arxiv.org')
  ) {
    return `/api/nodes/${nodeId}/file`;
  }

  return link || '';
}

export function resolveTextFallbackType(content: string): TextFallbackType {
  const detectedType = detectContentType(content);
  const trimmedContent = content.trim();

  if (
    /^#{1,6}\s/m.test(trimmedContent) ||
    /^[-*+]\s/m.test(trimmedContent) ||
    /^\d+\.\s/m.test(trimmedContent) ||
    /```[\s\S]*?```/.test(trimmedContent) ||
    /\[.+\]\(.+\)/.test(trimmedContent)
  ) {
    return 'markdown';
  }

  switch (detectedType) {
    case 'markdown':
      return 'markdown';
    case 'transcript':
      return 'transcript';
    case 'book':
    case 'article':
      return 'book';
    default:
      return 'raw';
  }
}

export function getTextFallbackPalette(theme: ReaderTheme): TextFallbackPalette {
  if (theme === 'warm') {
    return {
      body: '#2c2820',
      muted: '#6b6257',
      heading: '#1f1a14',
      accent: '#0f766e',
      blockquote: '#5f554a',
      blockquoteBorder: '#cbb89d',
      codeBackground: 'rgba(120, 93, 46, 0.12)',
      rule: '#d8c8ae',
      tableBorder: '#d8c8ae',
    };
  }

  return {
    body: '#d4d4d4',
    muted: '#888888',
    heading: '#f5f5f5',
    accent: '#22c55e',
    blockquote: '#999999',
    blockquoteBorder: '#333333',
    codeBackground: 'rgba(110, 118, 129, 0.4)',
    rule: '#30363d',
    tableBorder: '#3d444d',
  };
}

export function getPdfRenderMetrics(
  viewportWidth: number,
  viewportHeight: number,
  pixelRatio: number,
): PdfRenderMetrics {
  const safeRatio = Number.isFinite(pixelRatio) && pixelRatio > 1 ? pixelRatio : 1;

  return {
    cssWidth: viewportWidth,
    cssHeight: viewportHeight,
    canvasWidth: Math.floor(viewportWidth * safeRatio),
    canvasHeight: Math.floor(viewportHeight * safeRatio),
    transform: safeRatio > 1 ? [safeRatio, 0, 0, safeRatio, 0, 0] : null,
  };
}

export function getMostRelevantPdfPage(
  candidates: PdfVisiblePageCandidate[],
  containerHeight: number,
): number | null {
  if (candidates.length === 0) return null;

  let bestPage = candidates[0].pageNumber;
  let bestOverlap = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const overlapTop = Math.max(candidate.top, 0);
    const overlapBottom = Math.min(candidate.top + candidate.height, containerHeight);
    const overlap = Math.max(0, overlapBottom - overlapTop);
    const distance = Math.abs(candidate.top);

    if (overlap > bestOverlap || (overlap === bestOverlap && distance < bestDistance)) {
      bestPage = candidate.pageNumber;
      bestOverlap = overlap;
      bestDistance = distance;
    }
  }

  return bestPage;
}
