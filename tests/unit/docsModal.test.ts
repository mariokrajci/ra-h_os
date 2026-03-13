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

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    containers.push(container);
    root = createRoot(container);

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
});
