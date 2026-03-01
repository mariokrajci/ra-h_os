import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MappedMarkdownRenderer from '@/components/focus/source/MappedMarkdownRenderer';

describe('MappedMarkdownRenderer', () => {
  it('renders rich markdown elements with mapped source offsets', () => {
    const markdown = [
      '# Heading',
      '',
      'Paragraph with **bold** text, *italic* text, [link](https://example.com), and `inline code`.',
      '',
      '- Item one',
      '- Item two',
      '',
      '> Quoted line',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const value = 1;',
      '```',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('<h1');
    expect(html).toContain('<strong');
    expect(html).toContain('<em');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('<code');
    expect(html).toContain('Copy code');
    expect(html).toContain('<ul');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
    expect(html).toContain('data-source-start=');
    expect(html).toContain('data-source-end=');
    expect(html).toContain('Heading');
    expect(html).toContain('inline code');
    expect(html).toContain('data-source-start="180"');
    expect(html).toContain('data-source-end="196">const value = 1;');
  });

  it('renders copy affordance for fenced code blocks but not inline code', () => {
    const markdown = 'Inline `code` only.\n\n```js\nconsole.log(1)\n```';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html.match(/aria-label="Copy code"/g)?.length).toBe(1);
  });

  it('renders fenced code blocks with mapped source offsets', () => {
    const markdown = '```ts\nconst value = 1;\n```';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('data-source-start=');
    expect(html).toContain('language-typescript');
  });

  it('falls back to plain mapped code for unsupported languages', () => {
    const markdown = '```unknownlang\nconst value = 1;\n```';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).not.toContain('#c678dd');
    expect(html).toContain('const value = 1;');
    expect(html).toContain('data-source-start=');
  });

  it('applies persistent and active highlights to markdown text spans', () => {
    const markdown = 'Alpha **beta** gamma alpha beta';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [{ start: 6, end: 10, color: 'yellow', annotationId: 1 }],
        activeRange: { start: 17, end: 22 },
      })
    );

    expect(html).toContain('data-search-match="current"');
    expect(html).toContain('rgba(250, 204, 21, 0.42)');
    expect(html).toContain('rgba(245, 158, 11, 0.16)');
  });

});
