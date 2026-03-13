// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DocsModal from '@/components/docs/DocsModal';
import { AppThemeProvider } from '@/components/theme/AppThemeProvider';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLDivElement[] = [];

function createJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe('DocsModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let resolveUiDoc: (() => void) | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    root = createRoot(container);

    resolveUiDoc = null;
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/docs') {
        return createJsonResponse({
          success: true,
          data: [
            { slug: '0_overview', title: 'Overview', order: 0, fileName: '0_overview.md' },
            { slug: '6_ui', title: 'User Interface', order: 6, fileName: '6_ui.md' },
          ],
        });
      }

      if (url === '/api/docs/0_overview') {
        return createJsonResponse({
          success: true,
          data: {
            slug: '0_overview',
            title: 'Overview',
            content: '# Overview\n\nHello docs\n\n| Doc | Description |\n|-----|-------------|\n| UI | Component structure |\n\n```ts\nconst x = 1;\n```',
            order: 0,
            fileName: '0_overview.md',
          },
        });
      }

      if (url === '/api/docs/6_ui') {
        await new Promise<void>((resolve) => {
          resolveUiDoc = resolve;
        });
        return createJsonResponse({
          success: true,
          data: {
            slug: '6_ui',
            title: 'User Interface',
            content: '# User Interface\n\nUI docs',
            order: 6,
            fileName: '6_ui.md',
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.unstubAllGlobals();
    while (containers.length > 0) {
      containers.pop()?.remove();
    }
  });

  it('loads numbered docs and renders the selected document', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          AppThemeProvider,
          null,
          React.createElement(DocsModal, {
            isOpen: true,
            onClose: vi.fn(),
          }),
        ),
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/docs');
    expect(fetchMock).toHaveBeenCalledWith('/api/docs/0_overview');
    expect(document.body.textContent).toContain('Overview');
    expect(document.body.textContent).toContain('Hello docs');
    expect(document.body.querySelector('h1')?.textContent).toBe('Overview');
    expect(document.body.querySelector('table')).not.toBeNull();
    expect(document.body.querySelector('th')?.textContent).toBe('Doc');
    expect(document.body.querySelector('code')?.textContent).toContain('const x = 1;');
  });

  it('filters docs by search text and highlights matches in the active doc', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          AppThemeProvider,
          null,
          React.createElement(DocsModal, {
            isOpen: true,
            onClose: vi.fn(),
          }),
        ),
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const searchInput = document.body.querySelector('input[placeholder="Search docs..."]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      resolveUiDoc?.();
      searchInput!.value = 'user interface';
      searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput!.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('User Interface');
    expect(fetchMock).toHaveBeenCalledWith('/api/docs/6_ui');
    const docButtons = Array.from(document.body.querySelectorAll('[data-doc-button="true"]'));
    expect(docButtons).toHaveLength(1);
    expect(docButtons[0]?.textContent).toContain('User Interface');
    const mark = document.body.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent?.toLowerCase()).toContain('user interface');
  });

  it('waits for the full docs index before applying content search filters', async () => {
    await act(async () => {
      root.render(
        React.createElement(
          AppThemeProvider,
          null,
          React.createElement(DocsModal, {
            isOpen: true,
            onClose: vi.fn(),
          }),
        ),
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const searchInput = document.body.querySelector('input[placeholder="Search docs..."]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      searchInput!.value = 'user interface';
      searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Indexing docs...');
    expect(document.body.textContent).not.toContain('No docs match your search.');

    await act(async () => {
      resolveUiDoc?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('User Interface');
    const docButtons = Array.from(document.body.querySelectorAll('[data-doc-button="true"]'));
    expect(docButtons).toHaveLength(1);
    expect(docButtons[0]?.textContent).toContain('User Interface');
  });
});
