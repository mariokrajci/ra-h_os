"use client";

import React from 'react';
import MappedSourceText, { type MappedTextBlock, type MappedTextPart } from '../MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from '../sourceMapping';
import { READER_BODY_BLOCK_STYLE, READER_CONTAINER_STYLE } from '../readerStyles';

interface TranscriptFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
}

const TIMESTAMP_REGEX = /^(\[?\d{1,2}:\d{2}(?::\d{2})?\]?|\(\d{1,2}:\d{2}(?::\d{2})?\)|\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]|\[\d+(?:\.\d+)?s\])\s*/;
const SPEAKER_REGEX = /^((?:[A-Z][a-zA-Z.'-]*|[A-Z]{2,})(?:\s+(?:[A-Z][a-zA-Z.'-]*|[A-Z]{2,})){0,4}:\s+)/;

export default function TranscriptFormatter({
  content,
  annotationRanges = [],
  activeRange,
}: TranscriptFormatterProps) {
  const blocks = buildTranscriptBlocks(content);

  return (
    <MappedSourceText
      blocks={blocks}
      annotationRanges={annotationRanges}
      activeRange={activeRange}
      emptyState="No transcript content detected"
      containerStyle={READER_CONTAINER_STYLE}
    />
  );
}

function buildTranscriptBlocks(content: string): MappedTextBlock[] {
  const blocks: MappedTextBlock[] = [];
  let lineStart = 0;

  for (const line of content.split('\n')) {
    const lineEnd = lineStart + line.length;
    if (line.trim().length > 0) {
      blocks.push({
        key: `transcript-${lineStart}-${lineEnd}`,
        style: { marginBottom: '12px' },
        parts: buildTranscriptParts(line, lineStart),
      });
    }
    lineStart = lineEnd + 1;
  }

  return blocks;
}

function buildTranscriptParts(line: string, startOffset: number): MappedTextPart[] {
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
        color: '#555',
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
        color: '#888',
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
      },
    });
  }

  return parts;
}
