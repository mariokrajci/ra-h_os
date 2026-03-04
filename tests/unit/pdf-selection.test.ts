// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { extractPdfSelection } from '@/components/focus/reader/utils';

describe('extractPdfSelection', () => {
  it('returns a normalized annotation payload for text selected inside a PDF text layer', () => {
    const root = document.createElement('div');
    const first = document.createElement('span');
    const second = document.createElement('span');
    first.textContent = 'Hello ';
    second.textContent = 'world';
    root.append(first, second);
    document.body.append(root);

    const range = document.createRange();
    range.setStart(first.firstChild!, 0);
    range.setEnd(second.firstChild!, 5);

    const rect = { left: 100, top: 40, width: 60, height: 16, right: 160, bottom: 56, x: 100, y: 40, toJSON: () => ({}) };
    range.getBoundingClientRect = () => rect as DOMRect;
    range.getClientRects = () => ({
      length: 1,
      item: (index: number) => (index === 0 ? rect as DOMRect : null),
      [Symbol.iterator]: function* iterator() { yield rect as DOMRect; },
    }) as unknown as DOMRectList;

    const selection = extractPdfSelection(range, root, 3, 1.5);

    expect(selection).toEqual({
      text: 'Hello world',
      position: { x: 130, y: 40 },
      anchor: {
        kind: 'pdf_text',
        page: 3,
        zoom: 1.5,
        rects: [{ left: 100, top: 40, width: 60, height: 16 }],
      },
      fallback_context: 'Hello world',
    });
  });

  it('ignores selections outside the PDF text layer root', () => {
    const root = document.createElement('div');
    const inside = document.createElement('span');
    const outside = document.createElement('span');
    inside.textContent = 'inside';
    outside.textContent = 'outside';
    root.append(inside);
    document.body.append(root, outside);

    const range = document.createRange();
    range.setStart(outside.firstChild!, 0);
    range.setEnd(outside.firstChild!, 3);

    expect(extractPdfSelection(range, root, 1, 1.25)).toBeNull();
  });
});
