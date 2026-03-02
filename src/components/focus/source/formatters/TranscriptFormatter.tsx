"use client";

import React from 'react';
import MappedSourceText, { type MappedTextBlock, type MappedTextPart } from '../MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from '../sourceMapping';
import { READER_BODY_BLOCK_STYLE, READER_CONTAINER_STYLE } from '../readerStyles';
import { getTextFallbackPalette, type ReaderTheme } from '@/components/focus/reader/utils';

interface TranscriptFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  theme?: ReaderTheme;
}

const TIMESTAMP_REGEX = /^(\[?\d{1,2}:\d{2}(?::\d{2})?\]?|\(\d{1,2}:\d{2}(?::\d{2})?\)|\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]|\[\d+(?:\.\d+)?s\])\s*/;
const SPEAKER_REGEX = /^((?:[A-Z][a-zA-Z.'-]*|[A-Z]{2,})(?:\s+(?:[A-Z][a-zA-Z.'-]*|[A-Z]{2,})){0,4}:\s+)/;

export default function TranscriptFormatter({
  content,
  annotationRanges = [],
  activeRange,
  theme = 'dark',
}: TranscriptFormatterProps) {
  const palette = getTextFallbackPalette(theme);
  const blocks = buildTranscriptBlocks(content, palette);

  return (
    <MappedSourceText
      blocks={blocks}
      annotationRanges={annotationRanges}
      activeRange={activeRange}
      emptyState="No transcript content detected"
      containerStyle={{
        ...READER_CONTAINER_STYLE,
        color: palette.body,
      }}
    />
  );
}

function buildTranscriptBlocks(
  content: string,
  palette: ReturnType<typeof getTextFallbackPalette>,
): MappedTextBlock[] {
  const blocks: MappedTextBlock[] = [];
  let lineStart = 0;

  for (const line of content.split('\n')) {
    const lineEnd = lineStart + line.length;
    if (line.trim().length > 0) {
      blocks.push({
        key: `transcript-${lineStart}-${lineEnd}`,
        style: { marginBottom: '12px' },
        parts: buildTranscriptParts(line, lineStart, palette),
      });
    }
    lineStart = lineEnd + 1;
  }

  return blocks;
}

function buildTranscriptParts(
  line: string,
  startOffset: number,
  palette: ReturnType<typeof getTextFallbackPalette>,
): MappedTextPart[] {
  const parts: MappedTextPart[] = [];
  let cursor = 0;

  const timestampMatch = line.match(TIMESTAMP_REGEX);
  if (timestampMatch) {
    const text = timestampMatch[0];
    parts.push({
      text,
      start: startOffset + cursor,
      end: startOffset + cursor + text.length,
        style: {
          fontSize: '11px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          color: palette.muted,
        },
      });
    cursor += text.length;
  }

  const speakerMatch = line.slice(cursor).match(SPEAKER_REGEX);
  if (speakerMatch) {
    const text = speakerMatch[0];
    parts.push({
      text,
      start: startOffset + cursor,
      end: startOffset + cursor + text.length,
        style: {
          fontSize: '12px',
          fontWeight: 600,
          color: palette.heading,
        },
      });
    cursor += text.length;
  }

  if (cursor < line.length) {
    parts.push({
      text: line.slice(cursor),
      start: startOffset + cursor,
      end: startOffset + line.length,
      style: {
        ...READER_BODY_BLOCK_STYLE,
        color: palette.body,
      },
    });
  }

  if (parts.length === 0) {
    parts.push({
      text: line,
      start: startOffset,
      end: startOffset + line.length,
      style: {
        ...READER_BODY_BLOCK_STYLE,
        color: palette.body,
      },
    });
  }

  return parts;
}
