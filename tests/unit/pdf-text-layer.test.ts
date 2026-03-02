// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { renderPdfTextLayer } from '@/components/focus/reader/pdfTextLayer';

describe('renderPdfTextLayer', () => {
  it('creates and renders a selectable text layer for the current PDF page', async () => {
    const renderMock = vi.fn().mockResolvedValue(undefined);
    const TextLayerMock = vi.fn().mockImplementation(({ container }) => ({
      render: vi.fn().mockImplementation(async () => {
        const span = document.createElement('span');
        span.textContent = 'Hello';
        container.appendChild(span);
        await renderMock();
      }),
    }));
    const container = document.createElement('div');
    const viewport = { scale: 1.25 };
    const textContent = { items: [], styles: {} };
    const page = {
      getTextContent: vi.fn().mockResolvedValue(textContent),
    };

    await renderPdfTextLayer(
      { TextLayer: TextLayerMock as unknown as typeof TextLayerMock },
      page,
      container,
      viewport as any,
    );

    expect(container.className).toBe('textLayer');
    expect(container.style.pointerEvents).toBe('auto');
    expect(container.style.getPropertyValue('--total-scale-factor')).toBe('1.25');
    expect(container.style.caretColor).toBe('canvastext');
    expect(page.getTextContent).toHaveBeenCalledTimes(1);
    expect(TextLayerMock).toHaveBeenCalledWith({
      textContentSource: textContent,
      container,
      viewport,
    });
    const [span] = Array.from(container.querySelectorAll('span'));
    expect(span).toBeDefined();
    expect(span.style.color).toBe('transparent');
    expect(span.style.position).toBe('absolute');
    expect(span.style.whiteSpace).toBe('pre');
    expect(span.style.cursor).toBe('text');
    expect(span.style.zIndex).toBe('1');
    expect(span.style.fontSize).toBe('calc(var(--text-scale-factor) * var(--font-height))');
    expect(span.style.transform).toBe('rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))');
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
