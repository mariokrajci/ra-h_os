// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/context/DimensionIconsContext', () => ({
  useDimensionIcons: () => ({ dimensionIcons: {} }),
}));

vi.mock('@/components/helpers/MarkdownWithNodeTokens', () => ({
  default: () => React.createElement('div', null, 'markdown'),
}));

vi.mock('@/components/focus/dimensions/DimensionTags', () => ({
  default: () => React.createElement('div', null, 'dimensions'),
}));

vi.mock('@/components/common/ConfirmDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/focus/source', () => ({
  SourceReader: () => React.createElement('div', null, 'source'),
}));

vi.mock('@/components/focus/reader', () => ({
  BookReader: () => React.createElement('div', null, 'reader'),
}));

vi.mock('@/components/focus/book/BookMetadataTab', () => ({
  BookMetadataTab: () => React.createElement('div', null, 'book metadata'),
}));

vi.mock('@/components/focus/FormattingToolbar', () => ({
  default: () => null,
}));

vi.mock('@/components/annotations/AnnotationToolbar', () => ({
  default: () => null,
}));

vi.mock('@/components/helpers/NodeLabelRenderer', () => ({
  parseAndRenderContent: (value: string) => value,
}));

vi.mock('@/components/panes/library/bookMatch', () => ({
  applyBookMatchCandidate: vi.fn(),
  getBookMatchCandidates: () => [],
}));

vi.mock('@/utils/nodeIcons', () => ({
  getNodeIcon: () => React.createElement('span', null, 'icon'),
}));

vi.mock('@/lib/paste/shortcut', () => ({
  applyMarkdownPasteToTextarea: vi.fn(),
  isPasteAsMarkdownShortcut: () => false,
}));

import FocusPanel from '@/components/focus/FocusPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLDivElement[] = [];

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

function createJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

function findButton(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll('button')).find(button =>
    button.textContent?.includes(text)
  ) as HTMLButtonElement | undefined;
}

describe('FocusPanel edge proposals', () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    root = createRoot(container);

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/dimensions/popular') {
        return createJsonResponse({ success: true, data: [] });
      }

      if (url === '/api/nodes/1') {
        return createJsonResponse({
          node: {
            id: 1,
            title: 'Active note',
            description: 'By Simon Willison, this note mentions OpenAI.',
            notes: 'Notes',
            dimensions: [],
            metadata: {},
            created_at: '2026-03-13T12:00:00.000Z',
            updated_at: '2026-03-13T12:00:00.000Z',
          },
        });
      }

      if (url === '/api/nodes/2') {
        return createJsonResponse({
          node: {
            id: 2,
            title: 'Second note',
            description: 'By OpenAI.',
            notes: 'Notes',
            dimensions: [],
            metadata: {},
            created_at: '2026-03-13T12:00:00.000Z',
            updated_at: '2026-03-13T12:00:00.000Z',
          },
        });
      }

      if (url === '/api/nodes/1/edges' || url === '/api/nodes/2/edges') {
        return createJsonResponse({ success: true, data: [] });
      }

      if (url === '/api/annotations?nodeId=1' || url === '/api/annotations?nodeId=2') {
        return createJsonResponse({ success: true, data: [] });
      }

      if (url === '/api/nodes/1/edge-proposals') {
        return createJsonResponse({
          success: true,
          data: [
            {
              sourceNodeId: 1,
              targetNodeId: 7,
              targetNodeTitle: 'Simon Willison',
              reason: 'Explicitly mentioned in description: "Simon Willison"',
              matchedText: 'Simon Willison',
            },
          ],
        });
      }

      if (url === '/api/nodes/2/edge-proposals') {
        return createJsonResponse({
          success: true,
          data: [
            {
              sourceNodeId: 2,
              targetNodeId: 9,
              targetNodeTitle: 'OpenAI',
              reason: 'Explicitly mentioned in description: "OpenAI"',
              matchedText: 'OpenAI',
            },
          ],
        });
      }

      if (url === '/api/edges' && init?.method === 'POST') {
        return createJsonResponse({ success: true }, true, 201);
      }

      if (url === '/api/nodes/1/edge-proposals/dismiss' && init?.method === 'POST') {
        return createJsonResponse({ success: true });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    while (containers.length > 0) {
      const current = containers.pop();
      current?.remove();
    }
  });

  it('prefetches proposals when the active note changes', async () => {
    await act(async () => {
      root.render(React.createElement(FocusPanel, {
        openTabs: [1],
        activeTab: 1,
        onTabSelect: vi.fn(),
        onTabClose: vi.fn(),
      }));
    });

    await flush();

    await act(async () => {
      root.render(React.createElement(FocusPanel, {
        openTabs: [1, 2],
        activeTab: 2,
        onTabSelect: vi.fn(),
        onTabClose: vi.fn(),
      }));
    });

    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/nodes/1/edge-proposals');
    expect(fetchMock).toHaveBeenCalledWith('/api/nodes/2/edge-proposals');
  });

  it('renders suggested connections inside the edges tab and approves them', async () => {
    await act(async () => {
      root.render(React.createElement(FocusPanel, {
        openTabs: [1],
        activeTab: 1,
        onTabSelect: vi.fn(),
        onTabClose: vi.fn(),
      }));
    });

    await flush();

    await act(async () => {
      findButton(container, 'Edges')?.click();
    });

    expect(container.textContent).toContain('Suggested connections');
    expect(container.textContent).toContain('Simon Willison');
    expect(container.textContent).toContain('Explicitly mentioned in description');

    await act(async () => {
      findButton(container, 'Approve')?.click();
    });

    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/edges',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(container.textContent).not.toContain('Simon Willison');
  });

  it('dismisses a suggestion from the edges tab', async () => {
    await act(async () => {
      root.render(React.createElement(FocusPanel, {
        openTabs: [1],
        activeTab: 1,
        onTabSelect: vi.fn(),
        onTabClose: vi.fn(),
      }));
    });

    await flush();

    await act(async () => {
      findButton(container, 'Edges')?.click();
    });

    await act(async () => {
      findButton(container, 'Dismiss')?.click();
    });

    await flush();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/nodes/1/edge-proposals/dismiss',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(container.textContent).not.toContain('Simon Willison');
  });
});
