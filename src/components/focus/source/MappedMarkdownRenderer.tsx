"use client";

import React from 'react';
import { titlesMatch } from '@/components/focus/contentNormalization';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { MappedTextFragment, type MappedTextPart } from './MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from './sourceMapping';
import MappedHighlightedCodeBlock from './MappedHighlightedCodeBlock';
import { READER_BODY_COLOR, READER_BODY_FONT_SIZE, READER_BODY_LINE_HEIGHT, READER_CONTAINER_STYLE, READER_FONT_FAMILY } from './readerStyles';
import { getTextFallbackPalette, type ReaderTheme } from '@/components/focus/reader/utils';

interface MappedMarkdownRendererProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  theme?: ReaderTheme;
  suppressedLeadingHeadingTitle?: string;
}

interface PositionLike {
  start?: { offset?: number };
  end?: { offset?: number };
}

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  lang?: string | null;
  depth?: number;
  ordered?: boolean;
  checked?: boolean | null;
  children?: MarkdownNode[];
  position?: PositionLike;
  align?: Array<'left' | 'right' | 'center' | null> | null;
}

const parser = unified().use(remarkParse).use(remarkGfm);

export default function MappedMarkdownRenderer({
  content,
  annotationRanges = [],
  activeRange,
  theme = 'dark',
  suppressedLeadingHeadingTitle,
}: MappedMarkdownRendererProps) {
  const normalizedContent = normalizeEmbeddedHtmlMarkdown(content);
  const tree = parser.parse(normalizedContent) as MarkdownNode;
  const palette = getTextFallbackPalette(theme);
  const renderedChildren = maybeSuppressLeadingHeading(
    tree.children ?? [],
    suppressedLeadingHeadingTitle
  );

  return (
    <div
      data-mapped-source-root
      className="app-prose"
      style={{
        ...READER_CONTAINER_STYLE,
        fontFamily: READER_FONT_FAMILY,
        fontSize: READER_BODY_FONT_SIZE,
        lineHeight: READER_BODY_LINE_HEIGHT,
        color: theme === 'dark' ? READER_BODY_COLOR : palette.body,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25em',
      }}
    >
      {renderChildren(renderedChildren, normalizedContent, annotationRanges, activeRange, palette)}
    </div>
  );
}

function maybeSuppressLeadingHeading(nodes: MarkdownNode[], title?: string): MarkdownNode[] {
  if (!title?.trim() || nodes.length === 0) {
    return nodes;
  }

  const firstMeaningfulNodeIndex = nodes.findIndex((node) => node.type !== 'html');
  if (firstMeaningfulNodeIndex === -1) {
    return nodes;
  }

  const candidate = nodes[firstMeaningfulNodeIndex];
  if (candidate.type !== 'heading') {
    return nodes;
  }

  const headingText = collectNodeText(candidate).trim();
  if (!titlesMatch(headingText, title)) {
    return nodes;
  }

  return nodes.filter((_, index) => index !== firstMeaningfulNodeIndex);
}

function collectNodeText(node: MarkdownNode): string {
  if (node.type === 'text') {
    return node.value ?? '';
  }

  return (node.children ?? []).map(collectNodeText).join('');
}

function normalizeEmbeddedHtmlMarkdown(content: string): string {
  if (!content.includes('<')) {
    return content;
  }

  let normalized = content.replace(/<table[\s\S]*?<\/table>/gi, convertHtmlTableToMarkdown);
  normalized = convertHtmlBlocksToMarkdown(normalized);
  normalized = normalizeInlineHtml(normalized);
  return normalized;
}

function convertHtmlBlocksToMarkdown(fragment: string): string {
  if (!/<\/?(?:ol|ul|li|p|div|h[1-6])\b/i.test(fragment)) {
    return fragment;
  }

  const tokens = fragment.match(/<\/?(?:ol|ul|li|p|div|h[1-6])\b[^>]*>|[^<]+/gi) ?? [fragment];
  const out: string[] = [];
  const listStack: Array<{ type: 'ol' | 'ul'; index: number }> = [];
  let currentLine = '';
  let activeHeadingDepth: number | null = null;

  const flushLine = () => {
    const trimmed = currentLine.trimEnd();
    if (trimmed.trim().length > 0) {
      out.push(trimmed);
    }
    currentLine = '';
  };

  const ensureBlankLine = () => {
    if (out.length === 0 || out[out.length - 1] === '') return;
    out.push('');
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (/^<h[1-6]\b/.test(lower)) {
      flushLine();
      ensureBlankLine();
      activeHeadingDepth = Number(lower.match(/^<h([1-6])\b/)?.[1] || 1);
      currentLine = `${'#'.repeat(activeHeadingDepth)} `;
      continue;
    }

    if (/^<\/h[1-6]>/.test(lower)) {
      flushLine();
      ensureBlankLine();
      activeHeadingDepth = null;
      continue;
    }

    if (/^<(p|div)\b/.test(lower)) {
      flushLine();
      ensureBlankLine();
      continue;
    }

    if (/^<\/(p|div)>/.test(lower)) {
      flushLine();
      ensureBlankLine();
      continue;
    }

    if (/^<ol\b/.test(lower)) {
      flushLine();
      ensureBlankLine();
      listStack.push({ type: 'ol', index: 0 });
      continue;
    }

    if (/^<\/ol>/.test(lower)) {
      flushLine();
      listStack.pop();
      ensureBlankLine();
      continue;
    }

    if (/^<ul\b/.test(lower)) {
      flushLine();
      ensureBlankLine();
      listStack.push({ type: 'ul', index: 0 });
      continue;
    }

    if (/^<\/ul>/.test(lower)) {
      flushLine();
      listStack.pop();
      ensureBlankLine();
      continue;
    }

    if (/^<li\b/.test(lower)) {
      flushLine();
      const depth = Math.max(0, listStack.length - 1);
      const currentList = listStack[listStack.length - 1];
      const prefix = currentList?.type === 'ol'
        ? `${++currentList.index}. `
        : '- ';
      currentLine = `${'  '.repeat(depth)}${prefix}`;
      continue;
    }

    if (/^<\/li>/.test(lower)) {
      flushLine();
      continue;
    }

    currentLine += token.replace(/\s+/g, ' ');
  }

  flushLine();

  return out.join('\n');
}

function convertHtmlTableToMarkdown(tableHtml: string): string {
  const rows = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((match) => extractTableCells(match[1]))
    .filter((cells) => cells.length > 0);

  if (rows.length === 0) {
    return normalizeInlineHtml(tableHtml);
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => Array.from({ length: columnCount }, (_, index) => escapeMarkdownTableCell(row[index] ?? '')));
  const header = normalizedRows[0];
  const body = normalizedRows.slice(1);
  const divider = Array.from({ length: columnCount }, () => '---');

  return [
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function extractTableCells(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)).map((match) =>
    normalizeInlineHtml(match[2])
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function normalizeInlineHtml(fragment: string): string {
  return fragment
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, inner) => `\`${decodeHtmlEntities(stripTags(inner)).trim()}\``)
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, inner) => {
      const label = normalizeInlineHtml(inner).replace(/\s+/g, ' ').trim() || href;
      return `[${label}](${href})`;
    })
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_match, _tag, inner) => `**${normalizeInlineHtml(inner).trim()}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_match, _tag, inner) => `*${normalizeInlineHtml(inner).trim()}*`)
    .replace(/<\/?(p|div|span|center|tbody|thead|tr|td|th|table)[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function renderChildren(
  nodes: MarkdownNode[],
  content: string,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined,
  palette: ReturnType<typeof getTextFallbackPalette>,
): React.ReactNode[] {
  return nodes.map((node, index) => (
    <React.Fragment key={`${node.type}-${index}`}>
      {renderNode(node, content, annotationRanges, activeRange, palette, index)}
    </React.Fragment>
  ));
}

function renderNode(
  node: MarkdownNode,
  content: string,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined,
  palette: ReturnType<typeof getTextFallbackPalette>,
  key: React.Key
): React.ReactNode {
  switch (node.type) {
    case 'heading': {
      const depth = Math.max(1, Math.min(6, node.depth ?? 1)) as 1 | 2 | 3 | 4 | 5 | 6;
      const headingTagMap: Record<1 | 2 | 3 | 4 | 5 | 6, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'> = {
        1: 'h1',
        2: 'h2',
        3: 'h3',
        4: 'h4',
        5: 'h5',
        6: 'h6',
      };
      const Tag = headingTagMap[depth];
      const styles: Record<number, React.CSSProperties> = {
        1: { fontSize: '1.5em', fontWeight: 'bold', margin: 0, color: palette.heading },
        2: { fontSize: '1.3em', fontWeight: 'bold', margin: 0, color: palette.heading },
        3: { fontSize: '1.1em', fontWeight: 'bold', margin: 0, color: palette.heading },
      };
      return React.createElement(
        Tag,
        { key, style: styles[depth] ?? styles[3] },
        renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)
      );
    }
    case 'paragraph':
      return (
        <p key={key} style={{ margin: 0, lineHeight: '1.7' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </p>
      );
    case 'text':
      return renderPartNode(key, {
        text: node.value ?? '',
        ...getTextOffsets(node, content, node.value ?? ''),
      }, annotationRanges, activeRange);
    case 'strong':
      return (
        <strong key={key} style={{ fontWeight: 'bold', color: palette.heading }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </strong>
      );
    case 'emphasis':
      return (
        <em key={key} style={{ fontStyle: 'italic' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </em>
      );
    case 'delete':
      return (
        <del key={key}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </del>
      );
    case 'link':
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: palette.accent, textDecoration: 'underline' }}
        >
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </a>
      );
    case 'inlineCode':
      return (
        <code
          key={key}
          className="app-code-inline"
          style={{
            fontSize: '85%',
            fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, "Liberation Mono", monospace',
          }}
        >
          {renderPartNode(`${key}-inline-code`, {
            text: node.value ?? '',
            ...getLiteralOffsets(node, content, node.value ?? ''),
          }, annotationRanges, activeRange)}
        </code>
      );
    case 'code':
      return (
        <MappedHighlightedCodeBlock
          key={key}
          code={node.value ?? ''}
          language={node.lang}
          codeStartOffset={getLiteralOffsets(node, content, node.value ?? '').start}
          annotationRanges={annotationRanges}
          activeRange={activeRange}
          theme={themeFromPalette(palette)}
        />
      );
    case 'list':
      return node.ordered ? (
        <ol key={key} style={{ margin: 0, paddingLeft: '20px' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </ol>
      ) : (
        <ul
          key={key}
          style={{
            margin: 0,
            paddingLeft: '20px',
            listStyle: (node.children ?? []).some((child) => child.checked !== null && child.checked !== undefined)
              ? 'none'
              : undefined,
          }}
        >
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </ul>
      );
    case 'listItem':
      return renderListItem(node, content, annotationRanges, activeRange, palette, key);
    case 'blockquote':
      return (
        <blockquote
          key={key}
          style={{ margin: 0, color: palette.blockquote }}
        >
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </blockquote>
      );
    case 'table':
      return renderTable(node, content, annotationRanges, activeRange, palette, key);
    case 'tableRow':
      return (
        <tr key={key} style={{ borderBottom: '1px solid #3d444d' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}
        </tr>
      );
    case 'tableCell': {
      const isHeader = Boolean((node as unknown as { data?: { hName?: string } }).data?.hName === 'th');
      const Tag = isHeader ? 'th' : 'td';
      return React.createElement(
        Tag,
        {
          key,
          style: {
            padding: '6px 13px',
              borderRight: `1px solid ${palette.tableBorder}`,
              textAlign: 'left',
              verticalAlign: 'top',
              color: isHeader ? palette.heading : palette.body,
              fontWeight: isHeader ? 700 : undefined,
            },
          },
        renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)
      );
    }
    case 'tableHead':
      return <thead key={key}>{renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}</thead>;
    case 'tableBody':
      return <tbody key={key}>{renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette)}</tbody>;
    case 'break':
      return <br key={key} />;
    case 'thematicBreak':
      return <hr key={key} style={{ width: '100%', borderColor: palette.rule }} />;
    default:
      return node.children
        ? <React.Fragment key={key}>{renderChildren(node.children, content, annotationRanges, activeRange, palette)}</React.Fragment>
        : null;
  }
}

function renderListItem(
  node: MarkdownNode,
  content: string,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined,
  palette: ReturnType<typeof getTextFallbackPalette>,
  key: React.Key
) {
  const isTaskItem = node.checked !== null && node.checked !== undefined;
  const children = renderChildren(node.children ?? [], content, annotationRanges, activeRange, palette);

  if (!isTaskItem) {
    return (
      <li key={key} style={{ marginBottom: '4px' }}>
        {children}
      </li>
    );
  }

  return (
    <li
      key={key}
      style={{
        marginBottom: '8px',
        listStyle: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        marginLeft: '-20px',
      }}
    >
      <input
        type="checkbox"
        checked={Boolean(node.checked)}
        disabled
        readOnly
        aria-label={node.checked ? 'Completed task' : 'Incomplete task'}
        style={{
          marginTop: '0.28em',
          width: '16px',
          height: '16px',
          accentColor: palette.accent,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </li>
  );
}

function themeFromPalette(
  palette: ReturnType<typeof getTextFallbackPalette>
): ReaderTheme {
  return palette.body === '#d4d4d4' ? 'dark' : 'warm';
}

function renderPartNode(
  key: React.Key,
  part: MappedTextPart,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined
) {
  return (
    <MappedTextFragment
      key={key}
      part={part}
      annotationRanges={annotationRanges}
      activeRange={activeRange}
    />
  );
}

function renderTable(
  node: MarkdownNode,
  content: string,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined,
  palette: ReturnType<typeof getTextFallbackPalette>,
  key: React.Key
) {
  const rows = node.children ?? [];
  const [headerRow, ...bodyRows] = rows;

  return (
    <div key={key} style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderSpacing: 0,
          border: `1px solid ${palette.tableBorder}`,
        }}
      >
        {headerRow ? (
          <thead>
            {renderTableRow(headerRow, content, annotationRanges, activeRange, palette, 'head', true)}
          </thead>
        ) : null}
        {bodyRows.length > 0 ? (
          <tbody>
            {bodyRows.map((row, index) =>
              renderTableRow(row, content, annotationRanges, activeRange, palette, `body-${index}`, false)
            )}
          </tbody>
        ) : null}
      </table>
    </div>
  );
}

function renderTableRow(
  node: MarkdownNode,
  content: string,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined,
  palette: ReturnType<typeof getTextFallbackPalette>,
  key: React.Key,
  isHeader: boolean
) {
  const Tag = isHeader ? 'th' : 'td';

  return (
    <tr key={key} style={{ borderBottom: `1px solid ${palette.tableBorder}` }}>
      {(node.children ?? []).map((cell, index) =>
        React.createElement(
          Tag,
          {
            key: `${key}-${index}`,
            style: {
              padding: '6px 13px',
              borderRight: `1px solid ${palette.tableBorder}`,
              textAlign: 'left',
              verticalAlign: 'top',
              color: isHeader ? palette.heading : palette.body,
              fontWeight: isHeader ? 700 : undefined,
            },
          },
          renderChildren(cell.children ?? [], content, annotationRanges, activeRange, palette)
        )
      )}
    </tr>
  );
}

function getTextOffsets(node: MarkdownNode, _content: string, fallbackText: string) {
  const start = node.position?.start?.offset ?? 0;
  const end = node.position?.end?.offset ?? start + fallbackText.length;
  return { start, end };
}

function getLiteralOffsets(node: MarkdownNode, content: string, value: string) {
  const start = node.position?.start?.offset ?? 0;
  const end = node.position?.end?.offset ?? start + value.length;
  const slice = content.slice(start, end);
  const innerIndex = slice.indexOf(value);

  if (innerIndex >= 0) {
    return { start: start + innerIndex, end: start + innerIndex + value.length };
  }

  return { start, end: start + value.length };
}
