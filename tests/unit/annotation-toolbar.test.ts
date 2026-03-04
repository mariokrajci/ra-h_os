// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnnotationToolbar from '@/components/annotations/AnnotationToolbar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLDivElement[] = [];

afterEach(() => {
  while (containers.length > 0) {
    const container = containers.pop();
    if (container) container.remove();
  }
});

describe('AnnotationToolbar', () => {
  it('dismisses when clicking outside the toolbar', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    const onDismiss = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(AnnotationToolbar, {
          position: { x: 120, y: 120 },
          onAnnotate: vi.fn(),
          onDismiss,
        }),
      );
    });

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when clicking inside the toolbar', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    const onDismiss = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(AnnotationToolbar, {
          position: { x: 120, y: 120 },
          onAnnotate: vi.fn(),
          onDismiss,
        }),
      );
    });

    const insideButton = container.querySelector('button[aria-label="Annotate with yellow"]') as HTMLButtonElement | null;
    expect(insideButton).not.toBeNull();

    await act(async () => {
      insideButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(0);
  });
});
