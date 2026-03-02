"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import AnnotationToolbar, { type AnnotationColor } from '@/components/annotations/AnnotationToolbar';
import BookFormatter from '../source/formatters/BookFormatter';
import MarkdownFormatter from '../source/formatters/MarkdownFormatter';
import RawFormatter from '../source/formatters/RawFormatter';
import TranscriptFormatter from '../source/formatters/TranscriptFormatter';
import type { Annotation, NodeMetadata } from '@/types/database';
import BookReaderNav, { type ReaderNavItem } from './BookReaderNav';
import BookReaderProgressBar from './BookReaderProgressBar';
import BookReaderToolbar from './BookReaderToolbar';
import {
  detectReaderMode,
  getReaderSource,
  resolveTextFallbackType,
  type ReaderMode,
} from './utils';

const PdfViewer = dynamic(() => import('./PdfViewer'), { ssr: false });
const EpubViewer = dynamic(() => import('./EpubViewer'), { ssr: false });

export interface ReaderAnnotationInput {
  text: string;
  color: AnnotationColor;
  comment?: string;
  start_offset?: number;
  source_mode: ReaderMode;
  anchor?: Record<string, unknown>;
  fallback_context?: string;
}

interface BookReaderProps {
  nodeId: number;
  title: string;
  content: string;
  link?: string;
  metadata?: NodeMetadata | null;
  annotations?: Annotation[];
  onClose: () => void;
  onProgressUpdate: (progress: NodeMetadata['reading_progress']) => void;
  onCreateAnnotation: (annotation: ReaderAnnotationInput) => void;
}

function getStoredTheme(): 'warm' | 'dark' {
  if (typeof window === 'undefined') return 'warm';
  return localStorage.getItem('reader_theme') === 'dark' ? 'dark' : 'warm';
}

function extractFallbackSections(content: string): ReaderNavItem[] {
  const matches = content.match(/^(chapter|part)\s+[^\n]+/gim) ?? [];
  return matches.slice(0, 30).map((match, index) => ({
    id: `section-${index}`,
    label: match.trim(),
  }));
}

export default function BookReader({
  nodeId,
  title,
  content,
  link,
  metadata,
  annotations = [],
  onClose,
  onProgressUpdate,
  onCreateAnnotation,
}: BookReaderProps) {
  const [theme, setTheme] = useState<'warm' | 'dark'>(getStoredTheme);
  const [showChrome, setShowChrome] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [navItems, setNavItems] = useState<ReaderNavItem[]>([]);
  const [percent, setPercent] = useState(metadata?.reading_progress?.percent ?? 0);
  const [viewerModeOverride, setViewerModeOverride] = useState<ReaderMode | null>(null);
  const [viewerErrorMessage, setViewerErrorMessage] = useState<string | null>(null);
  const [pendingTextAnnotation, setPendingTextAnnotation] = useState<{
    text: string;
    start: number;
    position: { x: number; y: number };
  } | null>(null);

  const detectedMode = useMemo(() => detectReaderMode(metadata, link, content), [content, link, metadata]);
  const textFallbackType = useMemo(() => resolveTextFallbackType(content), [content]);
  const mode = viewerModeOverride ?? detectedMode;
  const src = useMemo(() => getReaderSource(nodeId, metadata, link), [link, metadata, nodeId]);
  const background = theme === 'dark' ? '#0f0f0f' : '#f7f1e3';
  const textColor = theme === 'dark' ? '#d4d4d4' : '#2c2820';

  useEffect(() => {
    const timer = window.setTimeout(() => setShowChrome(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (mode === 'text') {
      setNavItems(extractFallbackSections(content));
    }
  }, [content, mode]);

  useEffect(() => {
    setViewerModeOverride(null);
    setViewerErrorMessage(null);
  }, [detectedMode, nodeId, src]);

  const handleProgress = (progress: NonNullable<NodeMetadata['reading_progress']>) => {
    setPercent(progress.percent);
    onProgressUpdate(progress);
  };

  const fallbackToText = (error: unknown) => {
    if (!content.trim()) return;
    setViewerModeOverride('text');
    setViewerErrorMessage(error instanceof Error ? error.message : 'Native document source unavailable');
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background, color: textColor }}
      onMouseMove={() => setShowChrome(true)}
    >
      <BookReaderNav items={navItems} open={navOpen} onSelect={() => setNavOpen(false)} />
      <BookReaderToolbar
        title={title}
        subtitle={mode === 'text' ? 'Fallback text reader' : mode === 'pdf' ? 'PDF reader' : 'EPUB reader'}
        percent={percent}
        theme={theme}
        visible={showChrome}
        onToggleTheme={() => {
          const next = theme === 'dark' ? 'warm' : 'dark';
          setTheme(next);
          localStorage.setItem('reader_theme', next);
        }}
        onToggleNav={() => setNavOpen((value) => !value)}
        onClose={onClose}
      />

      <div style={{ position: 'absolute', inset: 0, paddingTop: '56px' }}>
        {mode === 'pdf' ? (
          <PdfViewer
            src={src}
            initialPage={metadata?.reading_progress?.page || 1}
            onNavItemsChange={setNavItems}
            onProgress={handleProgress}
            onError={fallbackToText}
          />
        ) : null}

        {mode === 'epub' ? (
          <EpubViewer
            src={src}
            initialCfi={metadata?.reading_progress?.cfi}
            onNavItemsChange={setNavItems}
            onProgress={handleProgress}
            onError={fallbackToText}
          />
        ) : null}

        {mode === 'text' ? (
          <div style={{ height: '100%', overflow: 'auto' }}>
            {viewerErrorMessage ? (
              <div
                style={{
                  margin: '0 auto 12px',
                  maxWidth: '680px',
                  padding: '10px 14px',
                  background: theme === 'dark' ? '#2a1f15' : '#f1dcc7',
                  color: theme === 'dark' ? '#f7d8b2' : '#6f4a1f',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                Native document source unavailable. Showing extracted text fallback.
              </div>
            ) : null}
            <div
              onMouseUp={() => {
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) return;
                const text = selection.toString().trim();
                if (!text) return;
                const start = content.indexOf(text);
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setPendingTextAnnotation({
                  text,
                  start: Math.max(0, start),
                  position: { x: rect.left + rect.width / 2, y: rect.top },
                });
              }}
            >
              {textFallbackType === 'markdown' ? (
                <MarkdownFormatter content={content} theme={theme} />
              ) : textFallbackType === 'transcript' ? (
                <TranscriptFormatter content={content} theme={theme} />
              ) : textFallbackType === 'book' ? (
                <BookFormatter content={content} theme={theme} />
              ) : (
                <RawFormatter content={content} theme={theme} />
              )}
            </div>
          </div>
        ) : null}
      </div>

      <BookReaderProgressBar percent={percent} />

      {pendingTextAnnotation ? (
        <AnnotationToolbar
          position={pendingTextAnnotation.position}
          onAnnotate={(color, comment) => {
            onCreateAnnotation({
              text: pendingTextAnnotation.text,
              color,
              comment,
              start_offset: pendingTextAnnotation.start,
              source_mode: 'text',
            });
            setPendingTextAnnotation(null);
            window.getSelection()?.removeAllRanges();
          }}
          onDismiss={() => {
            setPendingTextAnnotation(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      ) : null}
    </div>
  );
}
