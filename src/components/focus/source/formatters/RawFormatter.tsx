"use client";

import MappedSourceText, { type MappedTextBlock } from '../MappedSourceText';
import { getParagraphBlocks, type AnnotationHighlightRange, type TextRange } from '../sourceMapping';

interface RawFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
}

export default function RawFormatter({
  content,
  annotationRanges = [],
  activeRange,
}: RawFormatterProps) {
  const blocks: MappedTextBlock[] = getParagraphBlocks(content).map((paragraph, index, all) => ({
    key: `raw-${paragraph.start}-${paragraph.end}`,
    style: {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '15px',
      lineHeight: '1.7',
      color: '#d4d4d4',
      margin: 0,
      marginBottom: index < all.length - 1 ? '1.5em' : 0,
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
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
      }}
    />
  );
}
