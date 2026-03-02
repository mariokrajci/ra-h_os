"use client";

import React from 'react';
import MappedSourceText, { type MappedTextBlock } from '../MappedSourceText';
import { getParagraphBlocks, type AnnotationHighlightRange, type TextRange } from '../sourceMapping';
import { READER_BODY_BLOCK_STYLE, READER_CONTAINER_STYLE } from '../readerStyles';
import { getTextFallbackPalette, type ReaderTheme } from '@/components/focus/reader/utils';

interface RawFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  theme?: ReaderTheme;
}

export default function RawFormatter({
  content,
  annotationRanges = [],
  activeRange,
  theme = 'dark',
}: RawFormatterProps) {
  const palette = getTextFallbackPalette(theme);
  const blocks: MappedTextBlock[] = getParagraphBlocks(content).map((paragraph, index, all) => ({
    key: `raw-${paragraph.start}-${paragraph.end}`,
    style: {
      ...READER_BODY_BLOCK_STYLE,
      color: palette.body,
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
      containerStyle={{
        ...READER_CONTAINER_STYLE,
        color: palette.body,
      }}
    />
  );
}
