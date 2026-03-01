"use client";

import MappedMarkdownRenderer from '../MappedMarkdownRenderer';
import type { AnnotationHighlightRange, TextRange } from '../sourceMapping';

interface MarkdownFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
}

export default function MarkdownFormatter({
  content,
  annotationRanges = [],
  activeRange,
}: MarkdownFormatterProps) {
  return (
    <MappedMarkdownRenderer
      content={content}
      annotationRanges={annotationRanges}
      activeRange={activeRange}
    />
  );
}
