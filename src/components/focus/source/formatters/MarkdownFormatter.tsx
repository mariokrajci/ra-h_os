"use client";

import { useCallback, useMemo, useRef } from 'react';
import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';

interface MarkdownFormatterProps {
  content: string;
  onTextSelect?: (text: string) => void;
  highlightedText?: string | null;
  highlightMatchIndex?: number;
}

export default function MarkdownFormatter({
  content,
  onTextSelect,
  highlightedText,
  highlightMatchIndex = 0,
}: MarkdownFormatterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    if (!onTextSelect) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 10) {
      const truncatedText = text.length > 2000 ? text.slice(0, 2000) + '...' : text;
      onTextSelect(truncatedText);
      selection?.removeAllRanges();
    }
  }, [onTextSelect]);

  // Compute all match start positions for the highlight term
  const matchPositions = useMemo(() => {
    if (!highlightedText) return [];
    const positions: number[] = [];
    const searchLower = highlightedText.toLowerCase();
    const contentLower = content.toLowerCase();
    let pos = 0;
    while (pos < contentLower.length) {
      const idx = contentLower.indexOf(searchLower, pos);
      if (idx === -1) break;
      positions.push(idx);
      pos = idx + 1;
    }
    return positions;
  }, [content, highlightedText]);

  // Track match counter across paragraph renders
  const globalMatchCounter = useRef(0);
  globalMatchCounter.current = 0;

  const renderWithHighlight = useCallback((text: string): React.ReactNode => {
    if (!highlightedText) return text;
    const textLower = text.toLowerCase();
    const searchLower = highlightedText.toLowerCase();
    if (!textLower.includes(searchLower)) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let pos = 0;
    while (pos < textLower.length) {
      const index = textLower.indexOf(searchLower, pos);
      if (index === -1) break;
      if (index > lastIndex) parts.push(text.slice(lastIndex, index));
      const isCurrent = globalMatchCounter.current === highlightMatchIndex;
      globalMatchCounter.current++;
      parts.push(
        <mark
          key={`match-${index}`}
          data-search-match={isCurrent ? 'current' : 'other'}
          style={{
            background: isCurrent ? 'rgba(250,204,21,0.4)' : 'rgba(168,85,247,0.2)',
            color: isCurrent ? '#fef08a' : '#e9d5ff',
            padding: '2px 0',
            borderRadius: '2px',
          }}
        >
          {text.slice(index, index + highlightedText.length)}
        </mark>
      );
      lastIndex = index + highlightedText.length;
      pos = index + 1;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts.length > 0 ? <>{parts}</> : text;
  }, [highlightedText, highlightMatchIndex]);

  // Scroll to current match after render
  const prevHighlight = useRef<string | null>(null);
  if (highlightedText !== prevHighlight.current) {
    prevHighlight.current = highlightedText ?? null;
    if (highlightedText && containerRef.current) {
      setTimeout(() => {
        const el = containerRef.current?.querySelector('mark[data-search-match="current"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }

  // If no highlight needed, render via MarkdownWithNodeTokens as before
  if (!highlightedText) {
    return (
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: '24px 16px',
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: '16px',
          lineHeight: '1.75',
          color: '#d4d4d4',
        }}
      >
        <MarkdownWithNodeTokens content={content} />
      </div>
    );
  }

  // With highlight: fall back to paragraph-split plain text rendering
  // (Markdown formatting is sacrificed in highlight mode to enable accurate match marking)
  const paragraphs = content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
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
        gap: '1.5em',
      }}
    >
      {paragraphs.map((para, idx) => (
        <p key={idx} style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
          {renderWithHighlight(para)}
        </p>
      ))}
    </div>
  );
}
