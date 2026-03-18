"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { getReaderFormatLabel, resolveReaderFormat, toTextContentType } from './ContentDetector';
import RawFormatter from './formatters/RawFormatter';
import TranscriptFormatter from './formatters/TranscriptFormatter';
import BookFormatter from './formatters/BookFormatter';
import MarkdownFormatter from './formatters/MarkdownFormatter';
import SourceSearchBar from './SourceSearchBar';
import type { Annotation, NodeMetadata } from '@/types/database';
import { useAppTheme } from '@/components/theme/AppThemeProvider';
import {
  extractMappedSelection,
  findOccurrenceRange,
  resolveAnnotationHighlightRanges,
  type SourceSelection,
} from './sourceMapping';

interface SourceReaderProps {
  content: string;
  nodeTitle?: string;
  sourceUrl?: string;
  metadata?: NodeMetadata | null;
  onTextSelect?: (text: string) => void;
  onSourceSelect?: (selection: SourceSelection) => void;
  annotations?: Annotation[];
  highlightedText?: string | null;
  highlightMatchIndex?: number;
}

/**
 * Source Reader - Read-only formatted view of source content
 *
 * This is a pure presentation component that NEVER modifies the source data.
 * It detects content type and applies appropriate formatting for comfortable reading.
 */
export default function SourceReader({
  content,
  nodeTitle,
  sourceUrl,
  metadata,
  onTextSelect,
  onSourceSelect,
  annotations = [],
  highlightedText,
  highlightMatchIndex,
}: SourceReaderProps) {
  const { resolvedTheme } = useAppTheme();
  const [showSearch, setShowSearch] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState<string | null>(null);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Resolve reader format from explicit contract first, then heuristics fallback.
  const readerFormat = useMemo(
    () => resolveReaderFormat(content, sourceUrl, metadata),
    [content, metadata, sourceUrl]
  );
  const contentType = useMemo(() => toTextContentType(readerFormat), [readerFormat]);
  const contentTypeLabel = getReaderFormatLabel(readerFormat);
  const readerTheme = resolvedTheme === 'light' ? 'warm' : 'dark';

  // Combined highlight: search takes precedence over external highlight
  const activeHighlight = searchHighlight || highlightedText;
  const activeHighlightIndex = showSearch ? searchMatchIndex : (highlightMatchIndex ?? 0);
  const activeRange = useMemo(
    () => activeHighlight ? findOccurrenceRange(content, activeHighlight, activeHighlightIndex) : null,
    [activeHighlight, activeHighlightIndex, content]
  );
  const annotationRanges = useMemo(
    () => resolveAnnotationHighlightRanges(content, annotations),
    [annotations, content]
  );

  // Keyboard shortcut for Cmd+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to current match whenever activeRange changes (i.e. user navigates between matches)
  useEffect(() => {
    if (!activeRange || !showSearch) return;

    // Wait for the next animation frame — by then React has committed the new mark to the DOM
    const raf = requestAnimationFrame(() => {
      const container = contentRef.current;
      const currentMatch = container?.querySelector('mark[data-search-match="current"]');
      if (!container || !currentMatch) return;

      const containerRect = container.getBoundingClientRect();
      const matchRect = currentMatch.getBoundingClientRect();
      const pad = 60;

      const matchTop = matchRect.top - containerRect.top + container.scrollTop;
      const matchBottom = matchTop + matchRect.height;

      if (matchTop - pad < container.scrollTop) {
        container.scrollTo({ top: Math.max(0, matchTop - pad), behavior: 'smooth' });
      } else if (matchBottom + pad > container.scrollTop + container.clientHeight) {
        container.scrollTo({ top: matchBottom + pad - container.clientHeight, behavior: 'smooth' });
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [activeRange, showSearch]);

  const handleSearchClose = useCallback(() => {
    setShowSearch(false);
    setSearchHighlight(null);
    setSearchMatchIndex(0);
  }, []);

  const handleHighlightChange = useCallback((text: string | null, matchIndex: number) => {
    setSearchHighlight(text);
    setSearchMatchIndex(matchIndex);
  }, []);

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Use a native scroll listener on the ref so we catch scroll regardless of layout
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 200);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !contentRef.current) return;

    const mappedSelection = extractMappedSelection(selection.getRangeAt(0), contentRef.current, content);
    if (!mappedSelection) return;

    if (mappedSelection.text.length > 10) {
      onTextSelect?.(mappedSelection.text);
    }
    if (mappedSelection.text.length >= 3) {
      onSourceSelect?.(mappedSelection);
    }
    // Do not clear the selection — the user may want to copy the selected text.
    // The annotation data is already captured in mappedSelection at this point.
  }, [content, onSourceSelect, onTextSelect]);

  // Render appropriate formatter based on content type
  const renderContent = () => {
    switch (contentType) {
      case 'transcript':
        return <TranscriptFormatter content={content} annotationRanges={annotationRanges} activeRange={activeRange} theme={readerTheme} />;
      case 'book':
      case 'article':
        return <BookFormatter content={content} annotationRanges={annotationRanges} activeRange={activeRange} theme={readerTheme} />;
      case 'markdown':
        return (
          <MarkdownFormatter
            content={content}
            annotationRanges={annotationRanges}
            activeRange={activeRange}
            theme={readerTheme}
            suppressedLeadingHeadingTitle={nodeTitle}
            sourceUrl={sourceUrl}
          />
        );
      default:
        return <RawFormatter content={content} annotationRanges={annotationRanges} activeRange={activeRange} theme={readerTheme} />;
    }
  };

  return (
    <div className="app-panel-strong" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '4px',
      overflow: 'hidden',
      background: 'var(--app-surface-strong)',
    }}>
      {/* Header with content type and search */}
      {content && content.length >= 50 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--app-hairline)',
        }}>
          <span style={{
            fontSize: '10px',
            color: 'var(--app-text-subtle)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Format: {contentTypeLabel}
          </span>
          <button
            onClick={() => setShowSearch(!showSearch)}
            title="Search content (⌘F)"
            className={`app-button app-button--ghost app-button--compact app-button--icon${showSearch ? ' is-active' : ''}`}
            style={{
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <span>Search</span>
          </button>
        </div>
      )}

      {/* Search bar */}
      {showSearch && content && (
        <SourceSearchBar
          content={content}
          onClose={handleSearchClose}
          onHighlightChange={handleHighlightChange}
        />
      )}

      {/* Formatted content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          style={{ height: '100%', overflow: 'auto' }}
        >
          {renderContent()}
        </div>

        {showScrollTop && (
          <button
            onClick={scrollToTop}
            title="Back to top"
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--app-hairline)',
              background: 'var(--app-surface-strong)',
              color: 'var(--app-text-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.85,
              zIndex: 10,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
