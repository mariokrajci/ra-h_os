function normalizeTitleForComparison(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[`*_~#[\]]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTitle(candidate: string, title: string): boolean {
  const normalizedCandidate = normalizeTitleForComparison(candidate);
  const normalizedTitle = normalizeTitleForComparison(title);
  return normalizedCandidate.length > 0 && normalizedCandidate === normalizedTitle;
}

export function titlesMatch(candidate: string, title?: string | null): boolean {
  if (!title?.trim()) {
    return false;
  }

  return matchesTitle(candidate, title);
}

export function stripLeadingDuplicateTitle(content: string, title?: string | null): string {
  if (!title?.trim() || !content.trim()) {
    return content;
  }

  const lines = content.split('\n');
  let startIndex = 0;

  while (startIndex < lines.length && lines[startIndex].trim() === '') {
    startIndex += 1;
  }

  if (startIndex >= lines.length) {
    return content;
  }

  const firstLine = lines[startIndex].trim();
  let removeThroughIndex = -1;

  const atxHeadingMatch = firstLine.match(/^#{1,6}\s+(.*?)\s*#*$/);
  if (atxHeadingMatch && matchesTitle(atxHeadingMatch[1], title)) {
    removeThroughIndex = startIndex;
  } else if (
    matchesTitle(firstLine, title) &&
    startIndex + 1 < lines.length &&
    /^\s*(=+|-+)\s*$/.test(lines[startIndex + 1])
  ) {
    removeThroughIndex = startIndex + 1;
  } else if (matchesTitle(firstLine, title)) {
    removeThroughIndex = startIndex;
  }

  if (removeThroughIndex === -1) {
    return content;
  }

  let nextIndex = removeThroughIndex + 1;
  while (nextIndex < lines.length && lines[nextIndex].trim() === '') {
    nextIndex += 1;
  }

  return lines.slice(nextIndex).join('\n');
}
