import { readClipboardFromNavigator } from '@/lib/paste/clipboard-reader';
import { convertClipboardPayloadToMarkdown } from '@/lib/paste/paste-controller';
import type { ClipboardPayload } from '@/lib/paste/types';

interface ShortcutEventLike {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  code: string;
  key?: string;
}

interface ApplyMarkdownPasteOptions {
  getValue: () => string;
  setValue: (next: string) => void;
  readClipboard?: () => Promise<ClipboardPayload>;
}

export function isPasteAsMarkdownShortcut(event: ShortcutEventLike): boolean {
  const key = event.key?.toLowerCase();
  return (
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.code === 'KeyV' || key === 'v' || key === '√')
  );
}

export async function applyMarkdownPasteToTextarea(
  textarea: HTMLTextAreaElement,
  options: ApplyMarkdownPasteOptions,
): Promise<boolean> {
  const readClipboard = options.readClipboard ?? readClipboardFromNavigator;
  const clipboard = await readClipboard();
  const conversion = convertClipboardPayloadToMarkdown(clipboard);
  const insertText = conversion.markdown ?? '';
  if (!insertText) return false;

  const value = options.getValue();
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const nextValue = value.slice(0, start) + insertText + value.slice(end);
  const cursor = start + insertText.length;

  options.setValue(nextValue);
  setTimeout(() => {
    if (typeof textarea.focus === 'function') {
      textarea.focus();
    }
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(cursor, cursor);
    }
  }, 0);
  return true;
}

