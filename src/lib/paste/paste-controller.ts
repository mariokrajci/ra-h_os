import { htmlToMarkdown } from '@/lib/paste/markdown-converter';
import { tidyMarkdown } from '@/lib/paste/markdown-post-processor';
import { normaliseClipboardHtml } from '@/lib/paste/rich-content-normalizer';
import type { ClipboardPayload, MarkdownPasteResult } from '@/lib/paste/types';

export function convertClipboardPayloadToMarkdown(clipboard: ClipboardPayload): MarkdownPasteResult {
  const warnings: string[] = [];

  if (clipboard.html) {
    try {
      const normalized = normaliseClipboardHtml(clipboard.html);
      const markdown = tidyMarkdown(htmlToMarkdown(normalized));
      return {
        chosenFormat: 'html',
        markdown,
        fallbackUsed: false,
        warnings,
      };
    } catch {
      warnings.push('HTML conversion failed; falling back to plain text.');
    }
  }

  if (clipboard.text) {
    return {
      chosenFormat: 'text',
      markdown: tidyMarkdown(clipboard.text),
      fallbackUsed: true,
      warnings,
    };
  }

  return {
    chosenFormat: 'none',
    markdown: '',
    fallbackUsed: true,
    warnings,
  };
}

