// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { applyMarkdownPasteToTextarea, isPasteAsMarkdownShortcut } from '@/lib/paste/shortcut';

describe('paste shortcut helpers', () => {
  it('detects Option/Alt+V and ignores other modifier combinations', () => {
    expect(
      isPasteAsMarkdownShortcut({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyV',
        key: 'v',
      }),
    ).toBe(true);

    expect(
      isPasteAsMarkdownShortcut({
        altKey: true,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        code: 'KeyV',
        key: 'v',
      }),
    ).toBe(false);

    expect(
      isPasteAsMarkdownShortcut({
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: 'KeyV',
        key: 'v',
      }),
    ).toBe(false);
  });

  it('inserts converted markdown at the current textarea selection', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'hello world';
    textarea.selectionStart = 6;
    textarea.selectionEnd = 11;
    document.body.appendChild(textarea);

    let value = textarea.value;
    const setValue = vi.fn((next: string) => {
      value = next;
      textarea.value = next;
    });

    const inserted = await applyMarkdownPasteToTextarea(textarea, {
      getValue: () => value,
      setValue,
      readClipboard: async () => ({ text: '**markdown**' }),
    });

    expect(inserted).toBe(true);
    expect(setValue).toHaveBeenCalledWith('hello **markdown**');
  });
});
