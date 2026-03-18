export interface ClipboardPayload {
  html?: string;
  rtf?: string;
  text?: string;
  files?: File[];
  sourceHint?: string;
}

export interface MarkdownPasteResult {
  chosenFormat: 'html' | 'rtf' | 'text' | 'none';
  markdown?: string;
  fallbackUsed: boolean;
  warnings: string[];
}

