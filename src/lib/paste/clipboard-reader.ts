import type { ClipboardPayload } from '@/lib/paste/types';

async function readTypeFromItem(item: ClipboardItem, type: string): Promise<string | undefined> {
  if (!item.types.includes(type)) return undefined;
  try {
    const blob = await item.getType(type);
    const text = await blob.text();
    return text || undefined;
  } catch {
    return undefined;
  }
}

export async function readClipboardFromNavigator(): Promise<ClipboardPayload> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return {};

  const payload: ClipboardPayload = {};

  if (typeof navigator.clipboard.read === 'function') {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        payload.html ||= await readTypeFromItem(item, 'text/html');
        payload.rtf ||= await readTypeFromItem(item, 'text/rtf');
        payload.text ||= await readTypeFromItem(item, 'text/plain');
      }
    } catch {
      // Fall back to readText below.
    }
  }

  if (!payload.text && typeof navigator.clipboard.readText === 'function') {
    try {
      const text = await navigator.clipboard.readText();
      payload.text = text || undefined;
    } catch {
      // Ignore and return what we have.
    }
  }

  return payload;
}

