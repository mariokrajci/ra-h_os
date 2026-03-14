export function getMobileNotePreview(input: {
  description?: string | null;
  notes?: string | null;
}): string {
  const raw = (input.description?.trim() || input.notes?.trim() || 'No preview yet.')
    .replace(/\s+/g, ' ')
    .trim();

  if (raw.length <= 140) {
    return raw;
  }

  return `${raw.slice(0, 137).trimEnd()}...`;
}
