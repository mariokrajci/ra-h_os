"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MappedTextFragment, type MappedTextPart } from './MappedSourceText';
import type { AnnotationHighlightRange, TextRange } from './sourceMapping';
import CodeBlockWithCopy from './CodeBlockWithCopy';
import {
  highlightCodeTokens,
  normalizeHighlightLanguage,
  type HighlightToken,
} from './shikiHighlighting';
import type { ReaderTheme } from '@/components/focus/reader/utils';

interface MappedHighlightedCodeBlockProps {
  code: string;
  language?: string | null;
  codeStartOffset: number;
  annotationRanges: AnnotationHighlightRange[];
  activeRange?: TextRange | null;
  theme?: ReaderTheme;
}

const PRE_STYLE: React.CSSProperties = {
  margin: 0,
  padding: '14px 16px',
  borderRadius: 6,
  border: '1px solid var(--app-border)',
  background: 'var(--app-panel)',
  overflowX: 'auto',
};

const CODE_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: '13px',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
};

export default function MappedHighlightedCodeBlock({
  code,
  language,
  codeStartOffset,
  annotationRanges,
  activeRange,
  theme = 'dark',
}: MappedHighlightedCodeBlockProps) {
  const normalizedLanguage = useMemo(() => normalizeHighlightLanguage(language), [language]);
  const [highlightedLines, setHighlightedLines] = useState<HighlightToken[][] | null>(null);
  const themeName = theme === 'dark' ? 'horizon' : 'github-light';

  useEffect(() => {
    let cancelled = false;

    highlightCodeTokens(code, normalizedLanguage, themeName).then((result) => {
      if (!cancelled) {
        setHighlightedLines(result.lines);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, normalizedLanguage, themeName]);

  return (
    <CodeBlockWithCopy code={code}>
      <pre style={PRE_STYLE}>
        <code
          className={language ? `language-${normalizedLanguage ?? language}` : undefined}
          style={CODE_STYLE}
        >
          {highlightedLines
            ? renderHighlightedTokens(
                highlightedLines,
                codeStartOffset,
                annotationRanges,
                activeRange
              )
            : (
              <MappedTextFragment
                part={{
                  text: code,
                  start: codeStartOffset,
                  end: codeStartOffset + code.length,
                }}
                annotationRanges={annotationRanges}
                activeRange={activeRange}
              />
            )}
        </code>
      </pre>
    </CodeBlockWithCopy>
  );
}

function renderHighlightedTokens(
  lines: HighlightToken[][],
  codeStartOffset: number,
  annotationRanges: AnnotationHighlightRange[],
  activeRange: TextRange | null | undefined
) {
  const children: React.ReactNode[] = [];
  let cursor = codeStartOffset;

  lines.forEach((line, lineIndex) => {
    line.forEach((token, tokenIndex) => {
      const part: MappedTextPart = {
        text: token.content,
        start: cursor,
        end: cursor + token.content.length,
      };
      cursor += token.content.length;

      children.push(
        <span
          key={`line-${lineIndex}-token-${tokenIndex}`}
          style={tokenStyle(token)}
        >
          <MappedTextFragment
            part={part}
            annotationRanges={annotationRanges}
            activeRange={activeRange}
          />
        </span>
      );
    });

    if (lineIndex < lines.length - 1) {
      children.push(
        <MappedTextFragment
          key={`line-${lineIndex}-newline`}
          part={{
            text: '\n',
            start: cursor,
            end: cursor + 1,
          }}
          annotationRanges={annotationRanges}
          activeRange={activeRange}
        />
      );
      cursor += 1;
    }
  });

  return children;
}

function tokenStyle(token: HighlightToken): React.CSSProperties {
  return {
    color: token.color,
    fontStyle: (token.fontStyle ?? 0) & 1 ? 'italic' : 'normal',
    fontWeight: (token.fontStyle ?? 0) & 2 ? 700 : undefined,
    textDecoration: (token.fontStyle ?? 0) & 4 ? 'underline' : undefined,
  };
}
