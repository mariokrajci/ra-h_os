"use client";

import MappedMarkdownRenderer from '../MappedMarkdownRenderer';
import type { AnnotationHighlightRange, TextRange } from '../sourceMapping';
import type { ReaderTheme } from '@/components/focus/reader/utils';

interface MarkdownFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  theme?: ReaderTheme;
  suppressedLeadingHeadingTitle?: string;
  sourceUrl?: string;
}

export default function MarkdownFormatter({
  content,
  annotationRanges = [],
  activeRange,
  theme = 'warm',
  suppressedLeadingHeadingTitle,
  sourceUrl,
}: MarkdownFormatterProps) {
  return (
    <MappedMarkdownRenderer
      content={content}
      annotationRanges={annotationRanges}
      activeRange={activeRange}
      theme={theme}
      suppressedLeadingHeadingTitle={suppressedLeadingHeadingTitle}
      sourceUrl={sourceUrl}
    />
  );
}
