"use client";

import React from 'react';
import MappedSourceText, { type MappedTextBlock } from '../MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from '../sourceMapping';
import { getParagraphBlocks } from '../sourceMapping';
import { READER_BODY_BLOCK_STYLE, READER_CONTAINER_STYLE } from '../readerStyles';
import { getTextFallbackPalette, type ReaderTheme } from '@/components/focus/reader/utils';

interface BookFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  theme?: ReaderTheme;
}

export default function BookFormatter({
  content,
  annotationRanges = [],
  activeRange,
  theme = 'dark',
}: BookFormatterProps) {
  const palette = getTextFallbackPalette(theme);
  const blocks: MappedTextBlock[] = getParagraphBlocks(content).map((paragraph) => ({
    key: `book-${paragraph.start}-${paragraph.end}`,
    style: {
      ...READER_BODY_BLOCK_STYLE,
      margin: 0,
      marginBottom: '1.5em',
      textAlign: 'justify',
      textJustify: 'inter-word',
      hyphens: 'auto',
      color: palette.body,
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
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5em',
        color: palette.body,
      }}
    />
  );
}
