"use client";

import React from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { MappedTextFragment, type MappedTextPart } from './MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from './sourceMapping';
import MappedHighlightedCodeBlock from './MappedHighlightedCodeBlock';

interface MappedMarkdownRendererProps {
  content: string;
  annotationRanges?: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
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
  children?: MarkdownNode[];
  position?: PositionLike;
  align?: Array<'left' | 'right' | 'center' | null> | null;
}

const parser = unified().use(remarkParse).use(remarkGfm);

export default function MappedMarkdownRenderer({
  content,
  annotationRanges = [],
  activeRange,
}: MappedMarkdownRendererProps) {
  const tree = parser.parse(content) as MarkdownNode;

  return (
    <div
      data-mapped-source-root
      style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '24px 16px',
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '16px',
        lineHeight: '1.75',
        color: '#d4d4d4',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25em',
      }}
    >
      {renderChildren(tree.children ?? [], content, annotationRanges, activeRange)}
    </div>
  );
}

function renderChildren(
  nodes: MarkdownNode[],
  content: string,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined
): React.ReactNode[] {
  return nodes.map((node, index) => (
    <React.Fragment key={`${node.type}-${index}`}>
      {renderNode(node, content, annotationRanges, activeRange, index)}
    </React.Fragment>
  ));
}

function renderNode(
  node: MarkdownNode,
  content: string,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined,
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
        1: { fontSize: '1.5em', fontWeight: 'bold', margin: 0, color: '#e5e5e5' },
        2: { fontSize: '1.3em', fontWeight: 'bold', margin: 0, color: '#e5e5e5' },
        3: { fontSize: '1.1em', fontWeight: 'bold', margin: 0, color: '#e5e5e5' },
      };
      return React.createElement(
        Tag,
        { key, style: styles[depth] ?? styles[3] },
        renderChildren(node.children ?? [], content, annotationRanges, activeRange)
      );
    }
    case 'paragraph':
      return (
        <p key={key} style={{ margin: 0, lineHeight: '1.7' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </p>
      );
    case 'text':
      return renderPartNode(key, {
        text: node.value ?? '',
        ...getTextOffsets(node, content, node.value ?? ''),
      }, annotationRanges, activeRange);
    case 'strong':
      return (
        <strong key={key} style={{ fontWeight: 'bold', color: '#f5f5f5' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </strong>
      );
    case 'emphasis':
      return (
        <em key={key} style={{ fontStyle: 'italic' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </em>
      );
    case 'delete':
      return (
        <del key={key}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </del>
      );
    case 'link':
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#22c55e', textDecoration: 'underline' }}
        >
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </a>
      );
    case 'inlineCode':
      return (
        <code
          key={key}
          style={{
            background: 'rgba(110, 118, 129, 0.4)',
            padding: '0.2em 0.4em',
            borderRadius: '6px',
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
        />
      );
    case 'list':
      return node.ordered ? (
        <ol key={key} style={{ margin: 0, paddingLeft: '20px' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </ol>
      ) : (
        <ul key={key} style={{ margin: 0, paddingLeft: '20px' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </ul>
      );
    case 'listItem':
      return (
        <li key={key} style={{ marginBottom: '4px' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </li>
      );
    case 'blockquote':
      return (
        <blockquote
          key={key}
          style={{
            borderLeft: '3px solid #333',
            paddingLeft: '12px',
            margin: 0,
            color: '#999',
          }}
        >
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
        </blockquote>
      );
    case 'table':
      return renderTable(node, content, annotationRanges, activeRange, key);
    case 'tableRow':
      return (
        <tr key={key} style={{ borderBottom: '1px solid #3d444d' }}>
          {renderChildren(node.children ?? [], content, annotationRanges, activeRange)}
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
            borderRight: '1px solid #3d444d',
            textAlign: 'left',
            verticalAlign: 'top',
            color: isHeader ? '#e6edf3' : '#d0d7de',
            fontWeight: isHeader ? 700 : undefined,
          },
        },
        renderChildren(node.children ?? [], content, annotationRanges, activeRange)
      );
    }
    case 'tableHead':
      return <thead key={key}>{renderChildren(node.children ?? [], content, annotationRanges, activeRange)}</thead>;
    case 'tableBody':
      return <tbody key={key}>{renderChildren(node.children ?? [], content, annotationRanges, activeRange)}</tbody>;
    case 'break':
      return <br key={key} />;
    case 'thematicBreak':
      return <hr key={key} style={{ width: '100%', borderColor: '#30363d' }} />;
    default:
      return node.children
        ? <React.Fragment key={key}>{renderChildren(node.children, content, annotationRanges, activeRange)}</React.Fragment>
        : null;
  }
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
          border: '1px solid #3d444d',
        }}
      >
        {headerRow ? (
          <thead>
            {renderTableRow(headerRow, content, annotationRanges, activeRange, 'head', true)}
          </thead>
        ) : null}
        {bodyRows.length > 0 ? (
          <tbody>
            {bodyRows.map((row, index) =>
              renderTableRow(row, content, annotationRanges, activeRange, `body-${index}`, false)
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
  key: React.Key,
  isHeader: boolean
) {
  const Tag = isHeader ? 'th' : 'td';

  return (
    <tr key={key} style={{ borderBottom: '1px solid #3d444d' }}>
      {(node.children ?? []).map((cell, index) =>
        React.createElement(
          Tag,
          {
            key: `${key}-${index}`,
            style: {
              padding: '6px 13px',
              borderRight: '1px solid #3d444d',
              textAlign: 'left',
              verticalAlign: 'top',
              color: isHeader ? '#e6edf3' : '#d0d7de',
              fontWeight: isHeader ? 700 : undefined,
            },
          },
          renderChildren(cell.children ?? [], content, annotationRanges, activeRange)
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
