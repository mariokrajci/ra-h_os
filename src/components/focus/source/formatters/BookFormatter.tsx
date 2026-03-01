"use client";

import MappedSourceText, { type MappedTextBlock } from '../MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from '../sourceMapping';
import { getParagraphBlocks } from '../sourceMapping';

interface BookFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
}

export default function BookFormatter({
  content,
  annotationRanges = [],
  activeRange,
}: BookFormatterProps) {
  const blocks: MappedTextBlock[] = getParagraphBlocks(content).map((paragraph) => ({
    key: `book-${paragraph.start}-${paragraph.end}`,
    style: {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '16px',
      lineHeight: '1.75',
      color: '#d4d4d4',
      margin: 0,
      marginBottom: '1.5em',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      textAlign: 'justify',
      textJustify: 'inter-word',
      hyphens: 'auto',
    },
    parts: [{
      text: paragraph.text,
      start: paragraph.start,
      end: paragraph.end,
    }],
  }));

  return (
    <MappedSourceText
      blocks={blocks}
      annotationRanges={annotationRanges}
      activeRange={activeRange}
      containerStyle={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5em',
      }}
    />
  );
}
