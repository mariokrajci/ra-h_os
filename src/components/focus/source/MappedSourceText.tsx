"use client";

import React from 'react';
import type { CSSProperties } from 'react';
import type { Annotation } from '@/types/database';
import type { AnnotationHighlightRange, TextRange } from './sourceMapping';
import { buildHighlightSegments } from './sourceMapping';

export interface MappedTextPart {
  text: string;
  start: number;
  end: number;
  style?: CSSProperties;
}

export interface MappedTextBlock {
  key: string;
  parts: MappedTextPart[];
  style?: CSSProperties;
}

interface MappedSourceTextProps {
  blocks: MappedTextBlock[];
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  emptyState?: string;
  containerStyle?: CSSProperties;
}

const ANNOTATION_BG: Record<Annotation['color'], string> = {
  yellow: 'rgba(245, 158, 11, 0.28)',
  red: 'rgba(239, 68, 68, 0.24)',
  blue: 'rgba(59, 130, 246, 0.24)',
  green: 'rgba(34, 197, 94, 0.24)',
};

const ANNOTATION_EDGE: Record<Annotation['color'], string> = {
  yellow: 'rgba(180, 83, 9, 0.38)',
  red: 'rgba(153, 27, 27, 0.38)',
  blue: 'rgba(29, 78, 216, 0.38)',
  green: 'rgba(21, 128, 61, 0.38)',
};

export default function MappedSourceText({
  blocks,
  annotationRanges = [],
  activeRange,
  emptyState = 'No source content',
  containerStyle,
}: MappedSourceTextProps) {
  if (blocks.length === 0) {
    return (
      <div style={{ color: '#555', fontSize: '15px', fontStyle: 'italic', textAlign: 'center', padding: '40px 20px' }}>
        {emptyState}
      </div>
    );
  }

  return (
    <div data-mapped-source-root style={containerStyle}>
      {blocks.map((block) => (
        <div key={block.key} style={block.style}>
          {block.parts.map((part, partIndex) => {
            return (
              <MappedTextFragment
                key={`${block.key}-${partIndex}`}
                part={part}
                annotationRanges={annotationRanges}
                activeRange={activeRange}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface MappedTextFragmentProps {
  part: MappedTextPart;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
}

export function MappedTextFragment({
  part,
  annotationRanges = [],
  activeRange,
}: MappedTextFragmentProps) {
  const relevantAnnotations = annotationRanges
    .filter((range) => range.start < part.end && range.end > part.start)
    .map((range) => ({
      ...range,
      start: Math.max(0, range.start - part.start),
      end: Math.min(part.text.length, range.end - part.start),
    }));
  const relevantActiveRange = activeRange && activeRange.start < part.end && activeRange.end > part.start
    ? {
        start: Math.max(0, activeRange.start - part.start),
        end: Math.min(part.text.length, activeRange.end - part.start),
      }
    : null;

  let offset = 0;
  const segments = buildHighlightSegments(part.text, relevantAnnotations, relevantActiveRange);

  return (
    <span style={part.style}>
      {segments.map((segment, segmentIndex) => {
        const segmentStart = part.start + offset;
        const segmentEnd = segmentStart + segment.text.length;
        offset += segment.text.length;

        const isMarked = segment.isActiveJumpTarget || segment.annotationColors.length > 0;
        const ElementTag = isMarked ? 'mark' : 'span';

        return (
          <ElementTag
            key={`${part.start}-${part.end}-${segmentIndex}`}
            data-source-start={segmentStart}
            data-source-end={segmentEnd}
            data-search-match={segment.isActiveJumpTarget ? 'current' : undefined}
            style={getSegmentStyle(segment.annotationColors, segment.isActiveJumpTarget)}
          >
            {segment.text}
          </ElementTag>
        );
      })}
    </span>
  );
}

function getSegmentStyle(annotationColors: Annotation['color'][], isActiveJumpTarget: boolean): CSSProperties {
  if (isActiveJumpTarget) {
    return {
      background: 'rgba(250, 204, 21, 0.42)',
      color: '#fef08a',
      padding: '2px 0',
      borderRadius: '2px',
    };
  }

  if (annotationColors.length === 0) {
    return {};
  }

  if (annotationColors.length === 1) {
    return {
      background: ANNOTATION_BG[annotationColors[0]],
      color: 'inherit',
      padding: '1px 0',
      borderRadius: '2px',
      boxShadow: `inset 0 -1px 0 ${ANNOTATION_EDGE[annotationColors[0]]}`,
    };
  }

  return {
    background: 'rgba(148, 163, 184, 0.16)',
    color: 'inherit',
    padding: '1px 0',
    borderRadius: '2px',
    boxShadow: 'inset 0 -1px 0 rgba(226, 232, 240, 0.35)',
  };
}
