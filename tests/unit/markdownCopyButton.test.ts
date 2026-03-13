// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';
import { AppThemeProvider } from '@/components/theme/AppThemeProvider';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Markdown copy button', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows copied feedback after clipboard API copy succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await act(async () => {
      root.render(
        React.createElement(
          AppThemeProvider,
          null,
          React.createElement(MarkdownWithNodeTokens, {
            content: '```ts\nconst alpha = 1;\n```',
          }),
        ),
      );
    });

    const button = document.querySelector('button[aria-label="Copy code"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    await act(async () => {
      button!.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('const alpha = 1;');
    expect(document.querySelector('button[aria-label="Copied"]')).not.toBeNull();
  });

  it('falls back to execCommand copy when clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    await act(async () => {
      root.render(
        React.createElement(
          AppThemeProvider,
          null,
          React.createElement(MarkdownWithNodeTokens, {
            content: '```ts\nconst beta = 2;\n```',
          }),
        ),
      );
    });

    const button = document.querySelector('button[aria-label="Copy code"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    await act(async () => {
      button!.click();
      await Promise.resolve();
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('button[aria-label="Copied"]')).not.toBeNull();
  });
});
