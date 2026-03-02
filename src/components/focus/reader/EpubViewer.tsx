"use client";

import { useEffect, useRef } from 'react';
import type { ReaderNavItem } from './BookReaderNav';

interface EpubViewerProps {
  src: string;
  initialCfi?: string;
  onProgress: (progress: { mode: 'epub'; percent: number; cfi?: string; last_read_at: string }) => void;
  onNavItemsChange?: (items: ReaderNavItem[]) => void;
  onError?: (error: unknown) => void;
}

export default function EpubViewer({ src, initialCfi, onProgress, onNavItemsChange, onError }: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!containerRef.current) return;
      const epubModule = await import('epubjs');
      const ePub = (epubModule.default ?? epubModule) as any;
      const book = ePub(src);
      const rendition = book.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
      });
      renditionRef.current = rendition;

      await book.ready;
      await book.locations.generate(1000);

      if (cancelled) return;

      const toc = Array.isArray(book.navigation?.toc) ? book.navigation.toc : [];
      onNavItemsChange?.(
        toc.map((entry: any, index: number) => ({
          id: entry.href || `toc-${index}`,
          label: entry.label || `Chapter ${index + 1}`,
        })),
      );

      rendition.on('relocated', (location: any) => {
        const cfi = location?.start?.cfi;
        const percent = cfi ? book.locations.percentageFromCfi(cfi) * 100 : 0;
        onProgress({
          mode: 'epub',
          percent,
          cfi,
          last_read_at: new Date().toISOString(),
        });
      });

      rendition.display(initialCfi || undefined);
    }

    load().catch((error) => {
      console.error('Failed to load EPUB:', error);
      onError?.(error);
    });
    return () => {
      cancelled = true;
      renditionRef.current?.destroy?.();
    };
  }, [initialCfi, onError, onNavItemsChange, onProgress, src]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
