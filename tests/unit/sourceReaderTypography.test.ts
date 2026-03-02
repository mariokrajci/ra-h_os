import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RawFormatter from '@/components/focus/source/formatters/RawFormatter';
import BookFormatter from '@/components/focus/source/formatters/BookFormatter';
import MappedMarkdownRenderer from '@/components/focus/source/MappedMarkdownRenderer';

describe('source reader typography', () => {
  it('renders raw fallback content without serif font declarations', () => {
    const html = renderToStaticMarkup(
      React.createElement(RawFormatter, {
        content: 'Plain source paragraph.\n\nAnother paragraph.',
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).not.toContain('Georgia');
    expect(html).not.toContain('Times New Roman');
  });

  it('renders book reader content without serif font declarations', () => {
    const html = renderToStaticMarkup(
      React.createElement(BookFormatter, {
        content: 'Chapter text.\n\nMore chapter text.',
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).not.toContain('Georgia');
    expect(html).not.toContain('Times New Roman');
  });

  it('renders markdown reader content with the unified sans-serif reading font', () => {
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: '# Heading\n\nParagraph text.',
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('Geist');
    expect(html).not.toContain('Georgia');
    expect(html).not.toContain('Times New Roman');
  });
});
