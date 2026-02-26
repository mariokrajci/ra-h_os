"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Check, Copy } from 'lucide-react';

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
          background: '#22c55e',
          color: '#000',
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
        color: '#e5e5e5'
      }}>
        {truncatedTitle}
      </span>
    </span>
  );
}

// Pattern to match [NODE:id:"title"]
const nodePattern = /\[NODE:\s*(\d+)\s*:\s*["""'](.+?)["""']\s*\]/g;

interface MarkdownWithNodeTokensProps {
  content: string;
  onNodeClick?: (nodeId: number) => void;
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

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = React.useState(false);

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
          border: '1px solid #30363d',
          background: copied ? '#1f6feb22' : '#0d1117cc',
          color: copied ? '#58a6ff' : '#8b949e',
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
        style={atomOneDark}
        customStyle={{
          margin: 0,
          padding: '14px 16px',
          borderRadius: 6,
          border: '1px solid #30363d',
          background: '#161b22',
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

export default function MarkdownWithNodeTokens({ content, onNodeClick }: MarkdownWithNodeTokensProps) {
  if (!content) return null;

  // Store placeholders and their node data
  const placeholders: { id: string; title: string }[] = [];

  // Replace node tokens with placeholders before markdown parsing
  nodePattern.lastIndex = 0;
  const normalizedContent = maybeWrapAsciiTreeAsCode(content);
  const contentWithPlaceholders = normalizedContent.replace(nodePattern, (_match, id, title) => {
    const index = placeholders.length;
    placeholders.push({ id, title });
    return `%%NODE_PLACEHOLDER_${index}%%`;
  });

  // Helper function to process text and replace placeholders with components
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

  // Recursively process children to replace placeholders
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

  return (
    <>
      <style jsx>{`
        .markdown-table tbody tr:nth-child(even) {
          background: #0f1621;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Style headings
        h1: ({ children }) => (
          <h1 style={{ fontSize: '1.5em', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px', color: '#e5e5e5' }}>
            {processChildren(children, 'h1')}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: '1.3em', fontWeight: 'bold', marginTop: '14px', marginBottom: '6px', color: '#e5e5e5' }}>
            {processChildren(children, 'h2')}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '12px', marginBottom: '4px', color: '#e5e5e5' }}>
            {processChildren(children, 'h3')}
          </h3>
        ),
        // Style paragraphs
        p: ({ children }) => (
          <p style={{ marginTop: '8px', marginBottom: '8px', lineHeight: '1.7' }}>
            {processChildren(children, 'p')}
          </p>
        ),
        // Style bold/italic
        strong: ({ children }) => (
          <strong style={{ fontWeight: 'bold', color: '#f5f5f5' }}>
            {processChildren(children, 'strong')}
          </strong>
        ),
        em: ({ children }) => (
          <em style={{ fontStyle: 'italic' }}>
            {processChildren(children, 'em')}
          </em>
        ),
        // Style lists
        ul: ({ children }) => (
          <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px', listStyleType: 'disc' }}>
            {processChildren(children, 'ul')}
          </ul>
        ),
        ol: ({ children }) => (
          <ol style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px', listStyleType: 'decimal' }}>
            {processChildren(children, 'ol')}
          </ol>
        ),
        li: ({ children }) => (
          <li style={{ marginBottom: '4px' }}>
            {processChildren(children, 'li')}
          </li>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', marginTop: '8px', marginBottom: '10px' }}>
            <table
              className="markdown-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                borderSpacing: 0,
                border: '1px solid #3d444d',
                fontSize: 'inherit',
              }}
            >
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead>{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody>{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr style={{ borderBottom: '1px solid #3d444d' }}>{children}</tr>
        ),
        th: ({ children }) => (
          <th
            style={{
              padding: '6px 13px',
              borderRight: '1px solid #3d444d',
              textAlign: 'left',
              fontWeight: 700,
              color: '#e6edf3',
              verticalAlign: 'top',
            }}
          >
            {processChildren(children, 'th')}
          </th>
        ),
        td: ({ children }) => (
          <td
            style={{
              padding: '6px 13px',
              borderRight: '1px solid #3d444d',
              verticalAlign: 'top',
              color: '#d0d7de',
              lineHeight: 1.45,
            }}
          >
            {processChildren(children, 'td')}
          </td>
        ),
        // Style links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#22c55e', textDecoration: 'underline' }}
          >
            {processChildren(children, 'a')}
          </a>
        ),
        // Style code
        code: ({ children, className, ...props }: any) => {
          const codeText = String(children).replace(/\n$/, '');
          const explicitInline = typeof props?.inline === 'boolean' ? props.inline : undefined;
          // Fenced blocks without language don't provide className; detect them by multiline content.
          const isInline = explicitInline ?? (!className && !codeText.includes('\n'));
          const language = className?.replace('language-', '').toLowerCase() || 'text';
          if (isInline) {
            return (
              <code style={{
                background: 'rgba(110, 118, 129, 0.4)',
                padding: '0.2em 0.4em',
                borderRadius: '6px',
                fontSize: '85%',
                fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, "Liberation Mono", monospace'
              }}>
                {processChildren(children, 'code')}
              </code>
            );
          }
          return <CodeBlock code={codeText} language={language} />;
        },
        pre: ({ children }) => <>{children}</>,
        // Style blockquotes
        blockquote: ({ children }) => (
          <blockquote style={{
            borderLeft: '3px solid #333',
            paddingLeft: '12px',
            marginLeft: '0',
            marginTop: '8px',
            marginBottom: '8px',
            color: '#999'
          }}>
            {processChildren(children, 'blockquote')}
          </blockquote>
        )
        }}
      >
        {contentWithPlaceholders}
      </ReactMarkdown>
    </>
  );
}
