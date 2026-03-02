export interface PdfSectionExtractionResult {
  text: string;
  strategy: 'sections' | 'book_sections' | 'fallback';
  sectionTitles: string[];
}

type PrioritySectionTitle =
  | 'abstract'
  | 'executive summary'
  | 'introduction'
  | 'conclusion';

interface DetectedHeading {
  lineIndex: number;
  normalizedTitle: PrioritySectionTitle;
}

interface BookHeading {
  lineIndex: number;
  title: string;
  kind: 'target' | 'boundary';
  chapterNumber?: number;
}

const PRIORITY_HEADINGS: PrioritySectionTitle[] = [
  'abstract',
  'executive summary',
  'introduction',
  'conclusion',
];

const FALLBACK_SLICE_LENGTH = 12000;

export function extractPdfPrioritySections(text: string): PdfSectionExtractionResult {
  const bookSections = extractBookPrioritySections(text);
  if (bookSections) {
    return bookSections;
  }

  const headings = detectPriorityHeadings(text);

  if (headings.length < 2) {
    return buildFallbackResult(text);
  }

  const lines = text.split('\n');
  const sectionTitles: string[] = [];
  const sectionBodies: string[] = [];

  for (let index = 0; index < headings.length; index++) {
    const current = headings[index];
    const next = headings[index + 1];
    const sectionLines = lines
      .slice(current.lineIndex, next ? next.lineIndex : lines.length)
      .join('\n')
      .trim();

    if (!sectionLines) {
      continue;
    }

    sectionTitles.push(current.normalizedTitle);
    sectionBodies.push(sectionLines);
  }

  if (sectionTitles.length < 2) {
    return buildFallbackResult(text);
  }

  return {
    text: sectionBodies.join('\n\n'),
    strategy: 'sections',
    sectionTitles,
  };
}

function extractBookPrioritySections(text: string): PdfSectionExtractionResult | null {
  if (!looksBookLike(text)) {
    return null;
  }

  const mergedTextSections = extractBookPrioritySectionsFromMergedText(text);
  if (mergedTextSections) {
    return mergedTextSections;
  }

  const lines = text.split('\n');
  const detectedHeadings = detectBookHeadings(lines);
  if (detectedHeadings.length === 0) {
    return null;
  }

  const intro = findLastHeadingByTitle(detectedHeadings, 'Introduction');
  const about = findLastHeadingByTitle(detectedHeadings, 'About This Book');
  const chapterHeadings = dedupeChapterHeadingsByLastOccurrence(detectedHeadings)
    .filter((heading): heading is BookHeading & { chapterNumber: number } =>
      heading.kind === 'target' && typeof heading.chapterNumber === 'number'
    )
    .sort((left, right) => left.chapterNumber - right.chapterNumber);

  if (!intro || !about || chapterHeadings.length < 2) {
    return null;
  }

  const firstChapter = chapterHeadings[0];
  const lastChapter = chapterHeadings[chapterHeadings.length - 1];
  const selected = [intro, about, firstChapter, lastChapter]
    .filter((heading, index, all) => index === 0 || heading.lineIndex !== all[index - 1].lineIndex);

  const sectionBodies = selected.map((heading) => {
    const endIndex = findNextBoundaryLineIndex(detectedHeadings, heading.lineIndex, lines.length);
    return lines.slice(heading.lineIndex, endIndex).join('\n').trim();
  }).filter(Boolean);

  if (sectionBodies.length < 4) {
    return null;
  }

  return {
    text: sectionBodies.join('\n\n'),
    strategy: 'book_sections',
    sectionTitles: selected.map((heading) => heading.title),
  };
}

interface TextHeading {
  start: number;
  title: string;
  kind: 'target' | 'boundary';
  chapterNumber?: number;
}

function detectPriorityHeadings(text: string): DetectedHeading[] {
  const lines = text.split('\n');
  const headings: DetectedHeading[] = [];
  const seenTitles = new Set<PrioritySectionTitle>();

  lines.forEach((line, lineIndex) => {
    const normalizedTitle = matchPriorityHeading(line);
    if (!normalizedTitle || seenTitles.has(normalizedTitle)) {
      return;
    }

    headings.push({
      lineIndex,
      normalizedTitle,
    });
    seenTitles.add(normalizedTitle);
  });

  return headings;
}

function matchPriorityHeading(line: string): PrioritySectionTitle | null {
  const normalizedLine = normalizeHeading(line);
  if (!normalizedLine) {
    return null;
  }

  return PRIORITY_HEADINGS.find((heading) => normalizedLine === heading) ?? null;
}

function normalizeHeading(line: string): string {
  return line
    .trim()
    .replace(/^\d+(?:\.\d+)*[\s.)-]*/, '')
    .replace(/[.:]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function looksBookLike(text: string): boolean {
  return /\btable of contents\b/i.test(text)
    || /\babout this book\b/i.test(text)
    || /\bchapter\s+1\b/i.test(text);
}

function detectBookHeadings(lines: string[]): BookHeading[] {
  const headings: BookHeading[] = [];

  lines.forEach((line, lineIndex) => {
    const heading = parseBookHeading(line);
    if (!heading) {
      return;
    }

    headings.push({
      lineIndex,
      ...heading,
    });
  });

  return headings;
}

function parseBookHeading(line: string): Omit<BookHeading, 'lineIndex'> | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const noTrailingPage = trimmed.replace(/\s+\d+\s*$/, '').trim();

  if (/^introduction$/i.test(noTrailingPage)) {
    return { title: 'Introduction', kind: 'target' };
  }

  if (/^about this book$/i.test(noTrailingPage)) {
    return { title: 'About This Book', kind: 'target' };
  }

  const chapterMatch = noTrailingPage.match(/^chapter\s+(\d+)\s*:\s*(.+)$/i);
  if (chapterMatch) {
    const chapterNumber = Number(chapterMatch[1]);
    return {
      title: `Chapter ${chapterNumber}: ${chapterMatch[2].trim()}`,
      kind: 'target',
      chapterNumber,
    };
  }

  if (/^appendix\b/i.test(noTrailingPage)) {
    return { title: noTrailingPage, kind: 'boundary' };
  }

  if (/^index$/i.test(noTrailingPage)) {
    return { title: 'Index', kind: 'boundary' };
  }

  return null;
}

function findLastHeadingByTitle(headings: BookHeading[], title: string): BookHeading | null {
  for (let index = headings.length - 1; index >= 0; index--) {
    if (headings[index].kind === 'target' && headings[index].title === title) {
      return headings[index];
    }
  }

  return null;
}

function findNextBoundaryLineIndex(headings: BookHeading[], lineIndex: number, totalLines: number): number {
  const nextHeading = headings
    .filter((heading) => heading.lineIndex > lineIndex)
    .sort((left, right) => left.lineIndex - right.lineIndex)[0];

  return nextHeading?.lineIndex ?? totalLines;
}

function dedupeChapterHeadingsByLastOccurrence(headings: BookHeading[]): BookHeading[] {
  const deduped = new Map<string, BookHeading>();

  headings.forEach((heading) => {
    if (heading.kind === 'target' && typeof heading.chapterNumber === 'number') {
      deduped.set(heading.title, heading);
      return;
    }

    deduped.set(`${heading.kind}:${heading.title}:${heading.lineIndex}`, heading);
  });

  return Array.from(deduped.values());
}

function extractBookPrioritySectionsFromMergedText(text: string): PdfSectionExtractionResult | null {
  const headings = detectBookTextHeadings(text);
  if (headings.length === 0) {
    return null;
  }

  const intro = findLastTextHeadingByTitle(headings, 'Introduction');
  const about = findLastTextHeadingByTitle(headings, 'About This Book');
  const chapterHeadings = dedupeTextChapterHeadingsByLastOccurrence(headings)
    .filter((heading): heading is TextHeading & { chapterNumber: number } =>
      heading.kind === 'target' && typeof heading.chapterNumber === 'number'
    )
    .sort((left, right) => left.chapterNumber - right.chapterNumber);

  if (!intro || !about || chapterHeadings.length < 2) {
    return null;
  }

  const selected = [intro, about, chapterHeadings[0], chapterHeadings[chapterHeadings.length - 1]];
  const sectionBodies = selected
    .map((heading) => {
      const end = findNextTextBoundary(headings, heading.start, text.length);
      return text.slice(heading.start, end).trim();
    })
    .filter(Boolean);

  if (sectionBodies.length < 4) {
    return null;
  }

  return {
    text: sectionBodies.join('\n\n'),
    strategy: 'book_sections',
    sectionTitles: selected.map((heading) => heading.title),
  };
}

function detectBookTextHeadings(text: string): TextHeading[] {
  const headings: TextHeading[] = [];

  for (const match of text.matchAll(/\bIntroduction(?:\s+\d+)?\s+Introduction\b/gi)) {
    headings.push({
      start: match.index ?? 0,
      title: 'Introduction',
      kind: 'target',
    });
  }

  for (const match of text.matchAll(/\bAbout This Book\b/gi)) {
    headings.push({
      start: match.index ?? 0,
      title: 'About This Book',
      kind: 'target',
    });
  }

  for (const match of text.matchAll(/\bCHAPTER\s+(\d+)(?::|\s)+([A-Z][A-Za-z0-9–—&'(),\- ]{5,160}?)(?=\s+\d{1,4}(?![–-])\b)/g)) {
    const chapterNumber = Number(match[1]);
    headings.push({
      start: match.index ?? 0,
      title: `Chapter ${chapterNumber}: ${match[2].trim()}`,
      kind: 'target',
      chapterNumber,
    });
  }

  for (const match of text.matchAll(/\bAPPENDIX\s+[A-Z](?::|\s)+([A-Z][A-Za-z0-9–—&'(),\- ]{3,160}?)(?=\s+\d{1,4}(?![–-])\b)/g)) {
    headings.push({
      start: match.index ?? 0,
      title: `Appendix ${match[1].trim()}`,
      kind: 'boundary',
    });
  }

  for (const match of text.matchAll(/\bINDEX\b(?:\s+\d+)?/gi)) {
    headings.push({
      start: match.index ?? 0,
      title: 'Index',
      kind: 'boundary',
    });
  }

  return headings.sort((left, right) => left.start - right.start);
}

function findLastTextHeadingByTitle(headings: TextHeading[], title: string): TextHeading | null {
  for (let index = headings.length - 1; index >= 0; index--) {
    if (headings[index].kind === 'target' && headings[index].title === title) {
      return headings[index];
    }
  }

  return null;
}

function dedupeTextChapterHeadingsByLastOccurrence(headings: TextHeading[]): TextHeading[] {
  const deduped = new Map<string, TextHeading>();

  headings.forEach((heading) => {
    if (heading.kind === 'target' && typeof heading.chapterNumber === 'number') {
      deduped.set(heading.title, heading);
      return;
    }

    deduped.set(`${heading.kind}:${heading.title}:${heading.start}`, heading);
  });

  return Array.from(deduped.values());
}

function findNextTextBoundary(headings: TextHeading[], start: number, totalLength: number): number {
  const nextHeading = headings.find((heading) => heading.start > start);
  return nextHeading?.start ?? totalLength;
}

function buildFallbackResult(text: string): PdfSectionExtractionResult {
  if (text.length <= FALLBACK_SLICE_LENGTH * 2) {
    return {
      text,
      strategy: 'fallback',
      sectionTitles: [],
    };
  }

  return {
    text: `${text.slice(0, FALLBACK_SLICE_LENGTH)}\n\n[...]\n\n${text.slice(-FALLBACK_SLICE_LENGTH)}`,
    strategy: 'fallback',
    sectionTitles: [],
  };
}
