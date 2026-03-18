const MAX_CAPTURE_CHARS = 200_000;

export function sanitizeCapturedText(input: string): string {
  if (!input) return '';
  let value = input.replace(/\r\n/g, '\n');
  value = value.replace(/\u0000/g, '');
  // Drop non-printable control chars except TAB/LF.
  value = value.replace(/[\u0001-\u0008\u000B-\u001F\u007F]/g, '');
  value = stripDangerousHtml(value);
  value = neutralizeUnsafeMarkdownLinks(value);
  if (value.length > MAX_CAPTURE_CHARS) {
    value = value.slice(0, MAX_CAPTURE_CHARS);
  }
  return value.trim();
}

export function sanitizeCapturedUrl(input?: string): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function sanitizeCapturedTitle(input?: string): string | undefined {
  if (!input) return undefined;
  const cleaned = sanitizeCapturedText(input).replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, 300);
}

function stripDangerousHtml(text: string): string {
  return text
    .replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|form|meta|link)\b[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|form|meta|link)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
}

function neutralizeUnsafeMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_full, label, rawHref) => {
    const href = String(rawHref || '').trim();
    if (!href) return `[${label}]()`;
    if (/^(javascript|data|vbscript):/i.test(href)) {
      return `[${label}](#)`;
    }
    return `[${label}](${href})`;
  });
}
