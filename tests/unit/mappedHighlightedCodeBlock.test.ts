// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import MappedHighlightedCodeBlock from '@/components/focus/source/MappedHighlightedCodeBlock';

// React 19 expects this flag in non-RTL test environments.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLDivElement[] = [];

afterEach(() => {
  while (containers.length > 0) {
    const container = containers.pop();
    if (container) {
      container.remove();
    }
  }
});

describe('MappedHighlightedCodeBlock', () => {
  it('upgrades supported languages to token-colored output', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(MappedHighlightedCodeBlock, {
          code: 'const value = 1;\n',
          language: 'ts',
          codeStartOffset: 0,
          annotationRanges: [],
          activeRange: null,
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.innerHTML).toContain('language-typescript');
    expect(container.innerHTML).toContain('style="color:');
    expect(container.innerHTML).toContain('data-source-start="0"');
  });

  it('keeps plain mapped fallback for unsupported languages', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(MappedHighlightedCodeBlock, {
          code: 'const value = 1;\n',
          language: 'unknownlang',
          codeStartOffset: 0,
          annotationRanges: [],
          activeRange: null,
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.innerHTML).toContain('language-unknownlang');
    expect(container.innerHTML).not.toContain('style="color:');
    expect(container.innerHTML).toContain('const value = 1;');
  });

  it('preserves annotation and active highlights inside tokenized code', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(MappedHighlightedCodeBlock, {
          code: 'const value = 1;\n',
          language: 'ts',
          codeStartOffset: 0,
          annotationRanges: [{ start: 6, end: 11, color: 'yellow', annotationId: 1 }],
          activeRange: { start: 14, end: 15 },
        })
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.innerHTML).toContain('rgba(250, 204, 21, 0.42)');
    expect(container.innerHTML).toContain('data-search-match="current"');
  });
});
