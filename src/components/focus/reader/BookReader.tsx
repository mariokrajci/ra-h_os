"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { restoreNodeFile } from './fileRestore';

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
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoringFile, setIsRestoringFile] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    text: string;
    position: { x: number; y: number };
    start_offset?: number;
    source_mode: ReaderMode;
    anchor?: Record<string, unknown>;
    fallback_context?: string;
  } | null>(null);

  const detectedMode = useMemo(() => detectReaderMode(metadata, link, content), [content, link, metadata]);
  const textFallbackType = useMemo(() => resolveTextFallbackType(content), [content]);
  const mode = viewerModeOverride ?? detectedMode;
  const src = useMemo(() => getReaderSource(nodeId, metadata, link), [link, metadata, nodeId]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const background = theme === 'dark' ? '#0f0f0f' : '#f7f1e3';
  const textColor = theme === 'dark' ? '#d4d4d4' : '#2c2820';
  const restoreKind = detectedMode === 'pdf' ? 'pdf' : detectedMode === 'epub' ? 'epub' : null;

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
    setRestoreError(null);
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

  const handleRestoreFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile || !restoreKind) return;

    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    const isEpub = selectedFile.type === 'application/epub+zip' || selectedFile.name.toLowerCase().endsWith('.epub');
    if ((restoreKind === 'pdf' && !isPdf) || (restoreKind === 'epub' && !isEpub)) {
      setRestoreError(`Please select a valid ${restoreKind.toUpperCase()} file.`);
      return;
    }

    try {
      setIsRestoringFile(true);
      setRestoreError(null);
      await restoreNodeFile(nodeId, selectedFile);
      setViewerErrorMessage(null);
      setViewerModeOverride(null);
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Failed to restore file.');
    } finally {
      setIsRestoringFile(false);
    }
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
            onSelection={(selection) => {
              setPendingAnnotation({
                text: selection.text,
                position: selection.position,
                source_mode: 'pdf',
                anchor: selection.anchor,
                fallback_context: selection.fallback_context,
              });
            }}
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
                {restoreKind ? (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRestoringFile}
                      style={{
                        border: '1px solid rgba(140, 108, 60, 0.55)',
                        background: 'rgba(140, 108, 60, 0.15)',
                        color: theme === 'dark' ? '#f7d8b2' : '#6f4a1f',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: isRestoringFile ? 'default' : 'pointer',
                      }}
                    >
                      {isRestoringFile ? 'Restoring...' : `Restore ${restoreKind.toUpperCase()} file`}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={restoreKind === 'pdf' ? '.pdf,application/pdf' : '.epub,application/epub+zip'}
                      onChange={handleRestoreFileSelection}
                      style={{ display: 'none' }}
                    />
                    {restoreError ? (
                      <span style={{ fontSize: '11px', opacity: 0.9 }}>{restoreError}</span>
                    ) : null}
                  </div>
                ) : null}
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
                setPendingAnnotation({
                  text,
                  start_offset: Math.max(0, start),
                  position: { x: rect.left + rect.width / 2, y: rect.top },
                  source_mode: 'text',
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

      {pendingAnnotation ? (
        <AnnotationToolbar
          position={pendingAnnotation.position}
          onAnnotate={(color, comment) => {
            onCreateAnnotation({
              text: pendingAnnotation.text,
              color,
              comment,
              start_offset: pendingAnnotation.start_offset,
              source_mode: pendingAnnotation.source_mode,
              anchor: pendingAnnotation.anchor,
              fallback_context: pendingAnnotation.fallback_context,
            });
            setPendingAnnotation(null);
            window.getSelection()?.removeAllRanges();
          }}
          onDismiss={() => {
            setPendingAnnotation(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      ) : null}
    </div>
  );
}
