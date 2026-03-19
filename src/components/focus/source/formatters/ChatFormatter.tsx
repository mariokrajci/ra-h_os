"use client";

import React from 'react';
import MappedSourceText, { type MappedTextBlock } from '../MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from '../sourceMapping';
import { READER_BODY_BLOCK_STYLE, READER_CONTAINER_STYLE } from '../readerStyles';
import { getTextFallbackPalette, type ReaderTheme } from '@/components/focus/reader/utils';
import MarkdownFormatter from './MarkdownFormatter';

type ChatRole = 'you' | 'assistant';

interface ChatTurn {
  role: ChatRole;
  start: number;
  end: number;
  text: string;
}

interface ChatFormatterProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  theme?: ReaderTheme;
}

const CHAT_MARKER_REGEX = /(?:^|\n)\s*(?:\*\*)?(You|ChatGPT):(?:\*\*)?\s*/gi;

export function parseChatTurns(content: string): ChatTurn[] {
  CHAT_MARKER_REGEX.lastIndex = 0;
  const markers: Array<{ role: ChatRole; markerStart: number; bodyStart: number }> = [];
  let match: RegExpExecArray | null = null;

  while ((match = CHAT_MARKER_REGEX.exec(content)) !== null) {
    markers.push({
      role: match[1].toLowerCase() === 'you' ? 'you' : 'assistant',
      markerStart: match.index,
      bodyStart: CHAT_MARKER_REGEX.lastIndex,
    });
  }

  if (markers.length === 0) return [];

  const turns: ChatTurn[] = [];
  for (let i = 0; i < markers.length; i += 1) {
    const current = markers[i];
    const next = markers[i + 1];
    let start = current.bodyStart;
    let end = next ? next.markerStart : content.length;

    while (start < end && /\s/.test(content[start])) start += 1;
    while (end > start && /\s/.test(content[end - 1])) end -= 1;

    if (start < end) {
      turns.push({
        role: current.role,
        start,
        end,
        text: content.slice(start, end),
      });
    }
  }

  return turns;
}

export default function ChatFormatter({
  content,
  annotationRanges = [],
  activeRange,
  theme = 'dark',
}: ChatFormatterProps) {
  const palette = getTextFallbackPalette(theme);
  const turns = parseChatTurns(content);

  if (turns.length === 0) {
    const fallbackBlocks: MappedTextBlock[] = [{
      key: 'chat-fallback',
      style: {
        ...READER_BODY_BLOCK_STYLE,
        color: palette.body,
      },
      parts: [{ text: content, start: 0, end: content.length }],
    }];

    return (
      <MappedSourceText
        blocks={fallbackBlocks}
        annotationRanges={annotationRanges}
        activeRange={activeRange}
        containerStyle={{
          ...READER_CONTAINER_STYLE,
          color: palette.body,
        }}
      />
    );
  }

  return (
    <div style={{ ...READER_CONTAINER_STYLE, display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {turns.map((turn, index) => {
        const isUser = turn.role === 'you';
        const bubbleAnnotationRanges = annotationRanges
          .filter((range) => range.start < turn.end && range.end > turn.start)
          .map((range) => ({
            ...range,
            start: Math.max(0, range.start - turn.start),
            end: Math.min(turn.text.length, range.end - turn.start),
          }));
        const bubbleActiveRange = activeRange && activeRange.start < turn.end && activeRange.end > turn.start
          ? {
              start: Math.max(0, activeRange.start - turn.start),
              end: Math.min(turn.text.length, activeRange.end - turn.start),
            }
          : null;

        return (
          <div
            key={`chat-bubble-${turn.start}-${turn.end}-${index}`}
            style={{
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
              width: 'fit-content',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: '6px',
                color: isUser ? '#1d4ed8' : palette.muted,
                textAlign: isUser ? 'right' : 'left',
              }}
            >
              {isUser ? 'You' : 'ChatGPT'}
            </div>
            <div
              style={{
                border: `1px solid ${isUser ? 'rgba(59, 130, 246, 0.35)' : 'rgba(148, 163, 184, 0.35)'}`,
                background: isUser
                  ? 'rgba(191, 219, 254, 0.6)'
                  : (theme === 'dark' ? 'rgba(51, 65, 85, 0.34)' : 'rgba(255, 255, 255, 0.72)'),
                borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '12px 14px',
                boxShadow: isUser
                  ? 'none'
                  : (theme === 'dark'
                    ? '0 1px 2px rgba(0, 0, 0, 0.25)'
                    : '0 1px 2px rgba(15, 23, 42, 0.08)'),
              }}
            >
              <MarkdownFormatter
                content={turn.text}
                annotationRanges={bubbleAnnotationRanges}
                activeRange={bubbleActiveRange}
                theme={isUser ? 'warm' : theme}
                containerStyle={{
                  padding: 0,
                  margin: 0,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
