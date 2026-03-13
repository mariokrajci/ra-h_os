import fs from 'fs';
import path from 'path';

export interface AppDocMeta {
  slug: string;
  title: string;
  order: number;
  fileName: string;
}

export interface AppDoc extends AppDocMeta {
  content: string;
}

const DOCS_DIR = path.join(process.cwd(), 'docs');
const NUMBERED_DOC_PATTERN = /^(\d+)[_-](.+)\.md$/;

function isNumberedTopLevelDoc(fileName: string): boolean {
  return NUMBERED_DOC_PATTERN.test(fileName);
}

function formatFallbackTitle(fileName: string): string {
  const withoutExtension = fileName.replace(/\.md$/, '');
  const withoutPrefix = withoutExtension.replace(/^\d+[_-]/, '');
  return withoutPrefix
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getMarkdownTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function toSlug(fileName: string): string {
  return fileName.replace(/\.md$/, '');
}

function resolveDocPath(slug: string): string | null {
  const fileName = `${slug}.md`;
  if (!isNumberedTopLevelDoc(fileName)) {
    return null;
  }

  const fullPath = path.join(DOCS_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fullPath;
}

export function listAppDocs(): AppDocMeta[] {
  const fileNames = fs.readdirSync(DOCS_DIR)
    .filter(fileName => isNumberedTopLevelDoc(fileName))
    .sort((a, b) => {
      const [, aOrder = '0'] = a.match(NUMBERED_DOC_PATTERN) || [];
      const [, bOrder = '0'] = b.match(NUMBERED_DOC_PATTERN) || [];
      return Number(aOrder) - Number(bOrder);
    });

  return fileNames.map((fileName) => {
    const fullPath = path.join(DOCS_DIR, fileName);
    const content = fs.readFileSync(fullPath, 'utf8');
    const order = Number(fileName.match(NUMBERED_DOC_PATTERN)?.[1] || 0);

    return {
      slug: toSlug(fileName),
      title: getMarkdownTitle(content) || formatFallbackTitle(fileName),
      order,
      fileName,
    };
  });
}

export function readAppDoc(slug: string): AppDoc | null {
  const fullPath = resolveDocPath(slug);
  if (!fullPath) {
    return null;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const fileName = path.basename(fullPath);
  return {
    slug,
    title: getMarkdownTitle(content) || formatFallbackTitle(fileName),
    order: Number(fileName.match(NUMBERED_DOC_PATTERN)?.[1] || 0),
    fileName,
    content,
  };
}
