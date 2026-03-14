function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')           // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → keep text
    .replace(/`([^`]+)`/g, '$1')             // inline code
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold / italic
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')   // underscore bold/italic
    .replace(/^\s*[-*+]\s+/gm, '')           // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')           // ordered list markers
    .replace(/\s+/g, ' ')
    .trim();
}

export function getMobileNotePreview(input: {
  description?: string | null;
  notes?: string | null;
}): string {
  const raw = stripMarkdown(
    input.description?.trim() || input.notes?.trim() || ''
  );

  if (!raw) return 'No preview yet.';
  if (raw.length <= 137) return raw;
  return `${raw.slice(0, 137).trimEnd()}...`;
}
