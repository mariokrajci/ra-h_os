// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { applyMarkdownPasteToTextareaMock, isPasteAsMarkdownShortcutMock } = vi.hoisted(() => ({
  applyMarkdownPasteToTextareaMock: vi.fn(async () => true),
  isPasteAsMarkdownShortcutMock: vi.fn(() => false),
}));

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
  applyMarkdownPasteToTextarea: applyMarkdownPasteToTextareaMock,
  isPasteAsMarkdownShortcut: isPasteAsMarkdownShortcutMock,
}));

import QuickAddInput from '@/components/agents/QuickAddInput';
import FocusPanel from '@/components/focus/FocusPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

function findButtonByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

describe('paste shortcut wiring', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    applyMarkdownPasteToTextareaMock.mockClear();
    isPasteAsMarkdownShortcutMock.mockReset();
    isPasteAsMarkdownShortcutMock.mockReturnValue(true);
    vi.stubGlobal('React', React);

    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/dimensions/popular') {
        return createJsonResponse({ success: true, data: [] });
      }
      if (url === '/api/nodes/1') {
        return createJsonResponse({
          node: {
            id: 1,
            title: 'Active note',
            description: '',
            notes: 'Existing note body',
            chunk: 'Existing source body',
            dimensions: [],
            metadata: {},
            created_at: '2026-03-13T12:00:00.000Z',
            updated_at: '2026-03-13T12:00:00.000Z',
          },
        });
      }
      if (url === '/api/nodes/1/edges') {
        return createJsonResponse({ success: true, data: [] });
      }
      if (url === '/api/annotations?nodeId=1') {
        return createJsonResponse({ success: true, data: [] });
      }
      if (url === '/api/nodes/1/edge-proposals') {
        return createJsonResponse({ success: true, data: [] });
      }
      if (url === '/api/nodes/1/chunks') {
        return createJsonResponse({ success: true, chunks: [] });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses markdown paste handler in Quick Add textarea on Alt+V', async () => {
    await act(async () => {
      root.render(
        React.createElement(QuickAddInput, {
          isOpen: true,
          onClose: vi.fn(),
          onSubmit: vi.fn(async () => {}),
        }),
      );
    });

    const textarea = document.querySelector('textarea.qa-textarea') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await act(async () => {
      textarea!.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        altKey: true,
        bubbles: true,
      }));
      await Promise.resolve();
    });

    expect(applyMarkdownPasteToTextareaMock).toHaveBeenCalledTimes(1);
    expect(applyMarkdownPasteToTextareaMock).toHaveBeenCalledWith(
      textarea,
      expect.objectContaining({
        getValue: expect.any(Function),
        setValue: expect.any(Function),
      }),
    );
  });

  it('uses markdown paste handler in FocusPanel notes and source editors on Alt+V', async () => {
    await act(async () => {
      root.render(React.createElement(FocusPanel, {
        openTabs: [1],
        activeTab: 1,
        onTabSelect: vi.fn(),
        onTabClose: vi.fn(),
      }));
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByText(container, 'Edit')?.click();
    });

    const notesTextarea = container.querySelector('textarea[placeholder*="Start writing"]') as HTMLTextAreaElement | null;
    expect(notesTextarea).not.toBeNull();

    await act(async () => {
      notesTextarea!.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        altKey: true,
        bubbles: true,
      }));
      await Promise.resolve();
    });

    expect(applyMarkdownPasteToTextareaMock).toHaveBeenCalledTimes(1);
    expect(applyMarkdownPasteToTextareaMock).toHaveBeenLastCalledWith(
      notesTextarea,
      expect.objectContaining({
        getValue: expect.any(Function),
        setValue: expect.any(Function),
      }),
    );

    await act(async () => {
      findButtonByText(container, 'Source')?.click();
    });

    await act(async () => {
      findButtonByText(container, 'Edit')?.click();
    });

    const sourceTextarea = container.querySelector('textarea[placeholder*="Add source content"]') as HTMLTextAreaElement | null;
    expect(sourceTextarea).not.toBeNull();

    await act(async () => {
      sourceTextarea!.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        altKey: true,
        bubbles: true,
      }));
      await Promise.resolve();
    });

    expect(applyMarkdownPasteToTextareaMock).toHaveBeenCalledTimes(2);
    expect(applyMarkdownPasteToTextareaMock).toHaveBeenLastCalledWith(
      sourceTextarea,
      expect.objectContaining({
        getValue: expect.any(Function),
        setValue: expect.any(Function),
      }),
    );
  });
});
