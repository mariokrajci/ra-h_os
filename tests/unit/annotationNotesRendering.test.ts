import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';

describe('annotation notes rendering', () => {
  it('renders commentless annotations as compact highlight blocks', () => {
    const html = renderToStaticMarkup(
      React.createElement(MarkdownWithNodeTokens, {
        content: 'Before\n\n[[annotation:1]]\n\nAfter',
        annotations: {
          1: {
            id: 1,
            node_id: 9,
            text: 'Selected source text',
            color: 'yellow',
            comment: null,
            occurrence_index: 0,
            created_at: '2026-03-01T00:00:00.000Z',
          },
        },
        onJumpToSource: () => {},
        onDeleteAnnotation: () => {},
      })
    );

    expect(html).toContain('Selected source text');
    expect(html).toContain('Jump to source');
    expect(html).toContain('Delete highlight');
    expect(html).toContain('data-highlight-block="compact"');
    expect(html).not.toContain('data-annotation-block="full"');
  });

  it('renders commented annotations as full annotation blocks', () => {
    const html = renderToStaticMarkup(
      React.createElement(MarkdownWithNodeTokens, {
        content: '[[annotation:2]]',
        annotations: {
          2: {
            id: 2,
            node_id: 9,
            text: 'Annotated text',
            color: 'blue',
            comment: 'This matters',
            occurrence_index: 1,
            created_at: '2026-03-01T00:00:00.000Z',
          },
        },
        onJumpToSource: () => {},
        onDeleteAnnotation: () => {},
      })
    );

    expect(html).toContain('Annotated text');
    expect(html).toContain('This matters');
    expect(html).toContain('data-annotation-block="full"');
    expect(html).not.toContain('data-highlight-block="compact"');
  });
});
