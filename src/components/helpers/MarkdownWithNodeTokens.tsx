"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Check, Copy } from 'lucide-react';
import AnnotationBlock from '@/components/annotations/AnnotationBlock';
import HighlightBlock from '@/components/annotations/HighlightBlock';
import { Annotation } from '@/types/database';
import { useAppTheme } from '@/components/theme/AppThemeProvider';

interface NodeLabelInlineProps {
  id: string;
  title: string;
  onNodeClick?: (nodeId: number) => void;
}

function NodeLabelInline({ id, title, onNodeClick }: NodeLabelInlineProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNodeClick) {
      onNodeClick(parseInt(id));
    }
  };

  const maxTitleLength = 40;
  const truncatedTitle = title.length > maxTitleLength
    ? `${title.substring(0, maxTitleLength)}...`
    : title;
  const showTooltip = title.length > maxTitleLength;

  return (
    <span
      onClick={handleClick}
      title={showTooltip ? title : undefined}
      style={{
        display: 'inline',
        cursor: 'pointer',
        verticalAlign: 'baseline'
      }}
    >
      <span
        style={{
          display: 'inline',
          padding: '2px 6px',
          background: 'var(--toolbar-accent)',
          color: 'var(--app-accent-contrast)',
          borderRadius: '3px',
          fontSize: '11px',
          fontWeight: '600',
          marginRight: '4px',
          lineHeight: '1',
          verticalAlign: 'baseline'
        }}
      >
        {id}
      </span>
      <span style={{
        fontWeight: 'bold',
        textDecoration: 'underline',
        color: 'var(--app-text)'
      }}>
        {truncatedTitle}
      </span>
    </span>
  );
}

// Pattern to match [NODE:id:"title"]
const nodePattern = /\[NODE:\s*(\d+)\s*:\s*["""'](.+?)["""']\s*\]/g;

// Pattern to match [[annotation:ID]]
const annotationPattern = /\[\[annotation:(\d+)\]\]/g;

interface MarkdownWithNodeTokensProps {
  content: string;
  onNodeClick?: (nodeId: number) => void;
  annotations?: Record<number, Annotation>;
  onJumpToSource?: (text: string, matchIndex: number) => void;
  onDeleteAnnotation?: (id: number) => void;
}

function maybeWrapAsciiTreeAsCode(content: string): string {
  if (!content || content.includes('```')) return content;

  const lines = content.split('\n');
  if (lines.length < 5) return content;

  const treeLikeLines = lines.filter((line) => {
    const t = line.trim();
    return (
      t.startsWith('|') ||
      t.includes('|--') ||
      t.includes('\\--') ||
      t.includes('└──') ||
      t.includes('├──')
    );
  }).length;

  if (treeLikeLines >= 4 && treeLikeLines / lines.length >= 0.45) {
    return `\`\`\`text\n${content}\n\`\`\``;
  }

  return content;
}

function flattenCodeChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flattenCodeChildren).join('');
  if (React.isValidElement(children)) {
    const nested = (children.props as { children?: React.ReactNode })?.children;
    return nested !== undefined ? flattenCodeChildren(nested) : '';
  }
  return '';
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = React.useState(false);
  const { resolvedTheme } = useAppTheme();
  const syntaxTheme = resolvedTheme === 'light' ? github : atomOneDark;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  };

  return (
    <div style={{ marginTop: '8px', marginBottom: '10px', position: 'relative' }}>
      <button
        onClick={handleCopy}
        title={copied ? 'Copied' : 'Copy code'}
        aria-label={copied ? 'Copied' : 'Copy code'}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          border: '1px solid var(--app-border)',
          background: copied ? 'var(--app-selected)' : 'color-mix(in srgb, var(--app-surface-strong) 88%, transparent)',
          color: copied ? 'var(--app-info-text)' : 'var(--app-text-muted)',
          borderRadius: 6,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 2,
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <SyntaxHighlighter
        language={language}
        style={syntaxTheme}
        customStyle={{
          margin: 0,
          padding: '14px 16px',
          borderRadius: 6,
          border: '1px solid var(--app-border)',
          background: 'var(--app-surface-strong)',
          fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, "Liberation Mono", monospace',
          fontSize: '13px',
          lineHeight: 1.45,
          maxHeight: '360px',
          overflow: 'auto',
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownWithNodeTokens({
  content,
  onNodeClick,
  annotations = {},
  onJumpToSource,
  onDeleteAnnotation,
}: MarkdownWithNodeTokensProps) {
  if (!content) return null;

  // --- Node token placeholders ---
  const placeholders: { id: string; title: string }[] = [];
  nodePattern.lastIndex = 0;
  const normalizedContent = maybeWrapAsciiTreeAsCode(content);
  let contentWithPlaceholders = normalizedContent.replace(nodePattern, (_match, id, title) => {
    const index = placeholders.length;
    placeholders.push({ id, title });
    return `%%NODE_PLACEHOLDER_${index}%%`;
  });

  // --- Annotation token placeholders ---
  const annotationIds: number[] = [];
  annotationPattern.lastIndex = 0;
  contentWithPlaceholders = contentWithPlaceholders.replace(annotationPattern, (_match, idStr) => {
    const id = parseInt(idStr, 10);
    const index = annotationIds.length;
    annotationIds.push(id);
    return `%%ANNOTATION_PLACEHOLDER_${index}%%`;
  });

  // Helper: replace %%NODE_PLACEHOLDER_N%% in a text string with NodeLabelInline components
  const processText = (text: string, keyPrefix: string): React.ReactNode => {
    const placeholderPattern = /%%NODE_PLACEHOLDER_(\d+)%%/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let m;
    let matchCount = 0;

    placeholderPattern.lastIndex = 0;

    while ((m = placeholderPattern.exec(text)) !== null) {
      if (m.index > lastIdx) {
        parts.push(text.substring(lastIdx, m.index));
      }

      const placeholderIndex = parseInt(m[1]);
      const nodeData = placeholders[placeholderIndex];
      if (nodeData) {
        parts.push(
          <NodeLabelInline
            key={`${keyPrefix}-node-${nodeData.id}-${matchCount}`}
            id={nodeData.id}
            title={nodeData.title}
            onNodeClick={onNodeClick}
          />
        );
      }

      lastIdx = m.index + m[0].length;
      matchCount++;
    }

    if (lastIdx < text.length) {
      parts.push(text.substring(lastIdx));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  // Recursively process children to replace node placeholders
  const processChildren = (children: React.ReactNode, keyPrefix: string): React.ReactNode => {
    return React.Children.map(children, (child, index) => {
      if (typeof child === 'string') {
        return processText(child, `${keyPrefix}-${index}`);
      }
      if (React.isValidElement(child)) {
        const childElement = child as React.ReactElement<{ children?: React.ReactNode }>;
        if (childElement.props.children !== undefined) {
          return React.cloneElement(childElement, {
            children: processChildren(childElement.props.children, `${keyPrefix}-${index}`)
          });
        }
      }
      return child;
    });
  };

  // Shared ReactMarkdown components object (extracted to avoid duplication across sections)
  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 style={{ fontSize: '1.5em', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px', color: 'var(--app-text)' }}>
        {processChildren(children, 'h1')}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 style={{ fontSize: '1.3em', fontWeight: 'bold', marginTop: '14px', marginBottom: '6px', color: 'var(--app-text)' }}>
        {processChildren(children, 'h2')}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '12px', marginBottom: '4px', color: 'var(--app-text)' }}>
        {processChildren(children, 'h3')}
      </h3>
    ),
    p: ({ children }: any) => (
      <p style={{ marginTop: '8px', marginBottom: '8px', lineHeight: '1.7' }}>
        {processChildren(children, 'p')}
      </p>
    ),
    strong: ({ children }: any) => (
      <strong style={{ fontWeight: 'bold', color: 'var(--app-text)' }}>
        {processChildren(children, 'strong')}
      </strong>
    ),
    em: ({ children }: any) => (
      <em style={{ fontStyle: 'italic' }}>
        {processChildren(children, 'em')}
      </em>
    ),
    ul: ({ children }: any) => (
      <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px', listStyleType: 'disc' }}>
        {processChildren(children, 'ul')}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px', listStyleType: 'decimal' }}>
        {processChildren(children, 'ol')}
      </ol>
    ),
    li: ({ children }: any) => (
      <li style={{ marginBottom: '4px' }}>
        {processChildren(children, 'li')}
      </li>
    ),
    table: ({ children }: any) => (
      <div style={{ overflowX: 'auto', marginTop: '8px', marginBottom: '10px' }}>
        <table
          className="markdown-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderSpacing: 0,
            border: '1px solid var(--app-border)',
            fontSize: 'inherit',
          }}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => <thead>{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => <tr style={{ borderBottom: '1px solid var(--app-border)' }}>{children}</tr>,
    th: ({ children }: any) => (
      <th style={{ padding: '6px 13px', borderRight: '1px solid var(--app-border)', textAlign: 'left', fontWeight: 700, color: 'var(--app-text)', verticalAlign: 'top' }}>
        {processChildren(children, 'th')}
      </th>
    ),
    td: ({ children }: any) => (
      <td style={{ padding: '6px 13px', borderRight: '1px solid var(--app-border)', verticalAlign: 'top', color: 'var(--app-text)', lineHeight: 1.45 }}>
        {processChildren(children, 'td')}
      </td>
    ),
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--toolbar-accent)', textDecoration: 'underline' }}>
        {processChildren(children, 'a')}
      </a>
    ),
    code: ({ children, className, ...props }: any) => {
      const codeText = flattenCodeChildren(children).replace(/\n$/, '');
      const explicitInline = typeof props?.inline === 'boolean' ? props.inline : undefined;
      const isInline = explicitInline ?? (!className && !codeText.includes('\n'));
      const language = className?.replace('language-', '').toLowerCase() || 'text';
      if (isInline) {
        return (
          <code style={{
            background: 'var(--app-surface-subtle)',
            padding: '0.2em 0.4em',
            borderRadius: '6px',
            fontSize: '85%',
            color: 'var(--app-text)',
            fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, "Liberation Mono", monospace'
          }}>
            {processChildren(children, 'code')}
          </code>
        );
      }
      return <CodeBlock code={codeText} language={language} />;
    },
    pre: ({ children }: any) => <>{children}</>,
    blockquote: ({ children }: any) => (
      <blockquote style={{ borderLeft: '3px solid var(--app-border)', paddingLeft: '12px', marginLeft: '0', marginTop: '8px', marginBottom: '8px', color: 'var(--app-text-muted)' }}>
        {processChildren(children, 'blockquote')}
      </blockquote>
    ),
  };

  // Split content on annotation placeholders to interleave AnnotationBlock components
  const sections = contentWithPlaceholders.split(/%%ANNOTATION_PLACEHOLDER_\d+%%/);
  const annotationMatchesArr = [...contentWithPlaceholders.matchAll(/%%ANNOTATION_PLACEHOLDER_(\d+)%%/g)];

  return (
    <>
      <style>{`
        .markdown-table tbody tr:nth-child(even) {
          background: var(--app-table-stripe);
        }
      `}</style>
      {sections.map((section, sectionIdx) => (
        <React.Fragment key={sectionIdx}>
          {section.trim() && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {section}
            </ReactMarkdown>
          )}
          {annotationMatchesArr[sectionIdx] && (() => {
            const placeholderIndex = parseInt(annotationMatchesArr[sectionIdx][1], 10);
            const annotationId = annotationIds[placeholderIndex];
            const annotation = annotations[annotationId];
            if (!annotation) return null;
            const hasComment = Boolean(annotation.comment && annotation.comment.trim().length > 0);
            const BlockComponent = hasComment ? AnnotationBlock : HighlightBlock;
            return (
              <BlockComponent
                key={`annotation-${annotationId}`}
                annotation={annotation}
                onJumpToSource={onJumpToSource ?? (() => {})}
                onDelete={onDeleteAnnotation ?? (() => {})}
              />
            );
          })()}
        </React.Fragment>
      ))}
    </>
  );
}
