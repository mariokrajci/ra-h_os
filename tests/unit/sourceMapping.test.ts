import { describe, expect, it } from 'vitest';
import {
  buildHighlightSegments,
  findOccurrenceRange,
  getParagraphBlocks,
  resolveAnnotationHighlightRanges,
} from '@/components/focus/source/sourceMapping';
import type { Annotation } from '@/types/database';

describe('sourceMapping', () => {
  it('splits paragraph blocks while preserving raw offsets', () => {
    const blocks = getParagraphBlocks('Alpha\n\nBeta\n\nGamma');

    expect(blocks).toEqual([
      { text: 'Alpha', start: 0, end: 5 },
      { text: 'Beta', start: 7, end: 11 },
      { text: 'Gamma', start: 13, end: 18 },
    ]);
  });

  it('finds the nth occurrence using canonical source offsets', () => {
    const range = findOccurrenceRange('alpha beta alpha beta', 'alpha', 1);

    expect(range).toEqual({ start: 11, end: 16 });
  });

  it('resolves persistent annotation ranges from occurrence_index', () => {
    const annotations: Annotation[] = [
      {
        id: 1,
        node_id: 9,
        text: 'alpha',
        color: 'yellow',
        comment: null,
        occurrence_index: 1,
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ];

    const ranges = resolveAnnotationHighlightRanges('alpha beta alpha beta', annotations);

    expect(ranges).toEqual([
      {
        start: 11,
        end: 16,
        color: 'yellow',
        annotationId: 1,
      },
    ]);
  });

  it('builds deterministic overlapping segments with jump highlight precedence', () => {
    const segments = buildHighlightSegments('abcdef', [
      { start: 1, end: 4, color: 'yellow', annotationId: 1 },
      { start: 3, end: 5, color: 'blue', annotationId: 2 },
    ], { start: 2, end: 5 });

    expect(segments).toEqual([
      { text: 'a', annotationColors: [], isActiveJumpTarget: false },
      { text: 'b', annotationColors: ['yellow'], isActiveJumpTarget: false },
      { text: 'c', annotationColors: ['yellow'], isActiveJumpTarget: true },
      { text: 'd', annotationColors: ['yellow', 'blue'], isActiveJumpTarget: true },
      { text: 'e', annotationColors: ['blue'], isActiveJumpTarget: true },
      { text: 'f', annotationColors: [], isActiveJumpTarget: false },
    ]);
  });
});
