import type { Annotation } from '@/types/database';

export interface TextRange {
  start: number;
  end: number;
}

export interface ParagraphBlock extends TextRange {
  text: string;
}

export interface AnnotationHighlightRange extends TextRange {
  color: Annotation['color'];
  annotationId: number;
}

export interface HighlightSegment {
  text: string;
  annotationColors: Annotation['color'][];
  isActiveJumpTarget: boolean;
}

export interface SourceSelection extends TextRange {
  text: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export function getParagraphBlocks(content: string): ParagraphBlock[] {
  const blocks: ParagraphBlock[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    while (cursor < content.length && content[cursor] === '\n') {
      cursor += 1;
    }
    if (cursor >= content.length) break;

    let nextSeparator = content.indexOf('\n\n', cursor);
    if (nextSeparator === -1) {
      nextSeparator = content.length;
    }

    let end = nextSeparator;
    while (end > cursor && content[end - 1] === '\n') {
      end -= 1;
    }

    const text = content.slice(cursor, end);
    if (text.trim().length > 0) {
      blocks.push({ text, start: cursor, end });
    }

    cursor = nextSeparator + 2;
  }

  return blocks;
}

export function findOccurrenceRange(content: string, searchText: string, occurrenceIndex: number): TextRange | null {
  if (!searchText) return null;

  const contentLower = content.toLowerCase();
  const searchLower = searchText.toLowerCase();
  let pos = 0;
  let current = 0;

  while (pos < contentLower.length) {
    const idx = contentLower.indexOf(searchLower, pos);
    if (idx === -1) return null;
    if (current === occurrenceIndex) {
      return { start: idx, end: idx + searchText.length };
    }
    current += 1;
    pos = idx + 1;
  }

  return null;
}

export function resolveAnnotationHighlightRanges(
  content: string,
  annotations: Annotation[]
): AnnotationHighlightRange[] {
  return annotations.flatMap((annotation) => {
    const range = findOccurrenceRange(content, annotation.text, annotation.occurrence_index);
    if (!range) return [];
    return [{
      ...range,
      color: annotation.color,
      annotationId: annotation.id,
    }];
  });
}

export function buildHighlightSegments(
  text: string,
  annotationRanges: AnnotationHighlightRange[],
  activeJumpRange?: TextRange | null
): HighlightSegment[] {
  if (!text) return [];

  const breakpoints = new Set<number>([0, text.length]);
  for (const range of annotationRanges) {
    breakpoints.add(Math.max(0, Math.min(text.length, range.start)));
    breakpoints.add(Math.max(0, Math.min(text.length, range.end)));
  }
  if (activeJumpRange) {
    breakpoints.add(Math.max(0, Math.min(text.length, activeJumpRange.start)));
    breakpoints.add(Math.max(0, Math.min(text.length, activeJumpRange.end)));
  }

  const sorted = Array.from(breakpoints).sort((a, b) => a - b);
  const segments: HighlightSegment[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (start === end) continue;

    const annotationColors = annotationRanges
      .filter((range) => range.start < end && range.end > start)
      .map((range) => range.color);
    const isActiveJumpTarget = activeJumpRange
      ? activeJumpRange.start < end && activeJumpRange.end > start
      : false;

    segments.push({
      text: text.slice(start, end),
      annotationColors,
      isActiveJumpTarget,
    });
  }

  return segments;
}

export function extractMappedSelection(
  range: Range,
  root: HTMLElement,
  content: string,
  maxLength = 2000
): SourceSelection | null {
  const start = resolveMappedPoint(range.startContainer, range.startOffset, root, false);
  const end = resolveMappedPoint(range.endContainer, range.endOffset, root, true);

  if (start === null || end === null || end <= start) {
    return null;
  }

  let selectionStart = start;
  let selectionEnd = end;
  const rawText = content.slice(start, end);

  const leadingWhitespace = rawText.match(/^\s+/)?.[0].length ?? 0;
  const trailingWhitespace = rawText.match(/\s+$/)?.[0].length ?? 0;
  selectionStart += leadingWhitespace;
  selectionEnd -= trailingWhitespace;

  if (selectionEnd <= selectionStart) {
    return null;
  }

  let text = content.slice(selectionStart, selectionEnd);
  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength)}...`;
    selectionEnd = selectionStart + maxLength;
  }

  const rect = range.getBoundingClientRect();

  return {
    text,
    start: selectionStart,
    end: selectionEnd,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}

function resolveMappedPoint(
  node: Node,
  offset: number,
  root: HTMLElement,
  isEnd: boolean
): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent) return null;
    const mapped = getMappedElement(parent, root);
    if (!mapped) return null;
    const start = Number(mapped.dataset.sourceStart);
    const end = Number(mapped.dataset.sourceEnd);
    const local = Math.max(0, Math.min(offset, node.textContent?.length ?? 0));
    return Math.max(start, Math.min(start + local, end));
  }

  if (!(node instanceof Element)) {
    return null;
  }

  const childIndex = Math.max(0, Math.min(offset, node.childNodes.length));
  const candidate = isEnd
    ? node.childNodes[childIndex - 1] ?? node
    : node.childNodes[childIndex] ?? node;
  const textNode = isEnd ? getLastTextNode(candidate) : getFirstTextNode(candidate);
  if (textNode) {
    return resolveMappedPoint(
      textNode,
      isEnd ? (textNode.textContent?.length ?? 0) : 0,
      root,
      isEnd
    );
  }

  const mapped = getMappedElement(node, root);
  if (!mapped) return null;
  return isEnd ? Number(mapped.dataset.sourceEnd) : Number(mapped.dataset.sourceStart);
}

function getMappedElement(node: Element, root: HTMLElement): HTMLElement | null {
  const mapped = node.closest<HTMLElement>('[data-source-start][data-source-end]');
  if (!mapped || !root.contains(mapped)) return null;
  return mapped;
}

function getFirstTextNode(node: Node | null): Text | null {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node as Text;

  for (const child of node.childNodes) {
    const result = getFirstTextNode(child);
    if (result) return result;
  }
  return null;
}

function getLastTextNode(node: Node | null): Text | null {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) return node as Text;

  for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
    const result = getLastTextNode(node.childNodes[index]);
    if (result) return result;
  }
  return null;
}
