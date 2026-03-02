"use client";

import React from 'react';
import MappedSourceText, { type MappedTextBlock } from '../MappedSourceText';
import { getParagraphBlocks, type AnnotationHighlightRange, type TextRange } from '../sourceMapping';
import { READER_BODY_BLOCK_STYLE, READER_CONTAINER_STYLE } from '../readerStyles';

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
      ...READER_BODY_BLOCK_STYLE,
      margin: 0,
      marginBottom: index < all.length - 1 ? '1.5em' : 0,
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
      containerStyle={READER_CONTAINER_STYLE}
    />
  );
}
