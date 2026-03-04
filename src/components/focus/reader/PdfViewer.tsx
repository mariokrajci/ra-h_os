"use client";

import { useEffect, useRef, useState } from 'react';
import type { ReaderNavItem } from './BookReaderNav';
import { renderPdfTextLayer } from './pdfTextLayer';
import { extractPdfSelection, getMostRelevantPdfPage, getPdfRenderMetrics } from './utils';

interface PdfViewerProps {
  src: string;
  initialPage?: number;
  onProgress: (progress: { mode: 'pdf'; percent: number; page: number; total_pages: number; last_read_at: string }) => void;
  onNavItemsChange?: (items: ReaderNavItem[]) => void;
  onSelection?: (selection: {
    text: string;
    position: { x: number; y: number };
    anchor: Record<string, unknown>;
    fallback_context: string;
  }) => void;
  onError?: (error: unknown) => void;
}

const PDFJS_MODULE_URL = '/api/pdfjs/pdf.mjs';
const PDFJS_WORKER_URL = '/api/pdfjs/pdf.worker.mjs';

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  TextLayer: new (args: {
    textContentSource: unknown;
    container: HTMLDivElement;
    viewport: { scale: number };
  }) => {
    render: () => Promise<void>;
  };
  getDocument: (src: string) => { promise: Promise<any> };
};

type PdfViewMode = 'paged' | 'scroll';

function getStoredPdfViewMode(): PdfViewMode {
  if (typeof window === 'undefined') return 'paged';
  return localStorage.getItem('pdf_view_mode') === 'scroll' ? 'scroll' : 'paged';
}

interface PdfPageSurfaceProps {
  pdf: any;
  pdfjs: PdfJsModule;
  pageNumber: number;
  zoom: number;
  onSelection?: (selection: {
    text: string;
    position: { x: number; y: number };
    anchor: Record<string, unknown>;
    fallback_context: string;
  }) => void;
  onError?: (error: unknown) => void;
  registerFrame?: (node: HTMLDivElement | null) => void;
}

function PdfPageSurface({ pdf, pdfjs, pageNumber, zoom, onSelection, onError, registerFrame }: PdfPageSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const pageFrameRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    registerFrame?.(pageFrameRef.current);
    return () => registerFrame?.(null);
  }, [registerFrame]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (!pdf || !pdfjs || !canvasRef.current || !textLayerRef.current || pageNumber < 1 || pageNumber > pdf.numPages) return;

      const currentPage = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = currentPage.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const textLayer = textLayerRef.current;
      const pageFrame = pageFrameRef.current;
      const context = canvas.getContext('2d');
      if (!context || !pageFrame) return;
      const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const metrics = getPdfRenderMetrics(viewport.width, viewport.height, devicePixelRatio);

      textLayer.replaceChildren();
      pageFrame.style.width = `${metrics.cssWidth}px`;
      pageFrame.style.height = `${metrics.cssHeight}px`;
      textLayer.style.width = `${metrics.cssWidth}px`;
      textLayer.style.height = `${metrics.cssHeight}px`;
      canvas.style.width = `${metrics.cssWidth}px`;
      canvas.style.height = `${metrics.cssHeight}px`;
      canvas.width = metrics.canvasWidth;
      canvas.height = metrics.canvasHeight;
      const renderTask = currentPage.render({
        canvasContext: context,
        viewport,
        transform: metrics.transform ?? undefined,
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch (error: any) {
        if (error?.name === 'RenderingCancelledException') {
          return;
        }
        throw error;
      } finally {
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
      }

      if (cancelled) return;

      await renderPdfTextLayer(pdfjs, currentPage, textLayer, viewport);
    }

    load().catch((error) => {
      console.error('Failed to render PDF page:', error);
      onError?.(error);
    });
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [onError, pageNumber, pdf, pdfjs, zoom]);

  return (
    <div ref={pageFrameRef} style={{ position: 'relative', boxShadow: '0 16px 40px rgba(0,0,0,0.35)', flex: '0 0 auto', background: '#fff' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div
        ref={textLayerRef}
        onMouseUp={() => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || !textLayerRef.current) return;
          const extracted = extractPdfSelection(selection.getRangeAt(0), textLayerRef.current, pageNumber, zoom);
          if (!extracted) return;
          onSelection?.(extracted);
        }}
      />
    </div>
  );
}

export default function PdfViewer({ src, initialPage = 1, onProgress, onNavItemsChange, onSelection, onError }: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageFramesRef = useRef<Record<number, HTMLDivElement | null>>({});
  const pdfRef = useRef<any>(null);
  const pdfjsRef = useRef<PdfJsModule | null>(null);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.25);
  const [viewMode, setViewMode] = useState<PdfViewMode>(getStoredPdfViewMode);

  useEffect(() => {
    localStorage.setItem('pdf_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const pdfjs = await import(/* webpackIgnore: true */ PDFJS_MODULE_URL) as PdfJsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      pdfjsRef.current = pdfjs;

      const pdf = await pdfjs.getDocument(src).promise;
      if (cancelled) return;

      pdfRef.current = pdf;
      setTotalPages(pdf.numPages);
      setPage((value) => Math.max(1, Math.min(value, pdf.numPages)));
      onNavItemsChange?.(
        Array.from({ length: pdf.numPages }, (_, index) => ({
          id: `page-${index + 1}`,
          label: `Page ${index + 1}`,
        })),
      );
    }

    load().catch((error) => {
      console.error('Failed to load PDF:', error);
      onError?.(error);
    });
    return () => {
      cancelled = true;
    };
  }, [onError, onNavItemsChange, src]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || totalPages <= 0) return;

    onProgress({
      mode: 'pdf',
      percent: pdf.numPages > 0 ? (page / pdf.numPages) * 100 : 0,
      page,
      total_pages: pdf.numPages,
      last_read_at: new Date().toISOString(),
    });
  }, [onProgress, page, totalPages]);

  useEffect(() => {
    if (viewMode !== 'scroll') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateCurrentPage = () => {
      const containerRect = container.getBoundingClientRect();
      const candidates = Object.entries(pageFramesRef.current)
        .map(([pageNumber, node]) => {
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return {
            pageNumber: Number(pageNumber),
            top: rect.top - containerRect.top,
            height: rect.height,
          };
        })
        .filter((value): value is { pageNumber: number; top: number; height: number } => value !== null);

      const nextPage = getMostRelevantPdfPage(candidates, containerRect.height);
      if (nextPage && nextPage !== page) {
        setPage(nextPage);
      }
    };

    updateCurrentPage();
    container.addEventListener('scroll', updateCurrentPage, { passive: true });
    window.addEventListener('resize', updateCurrentPage);
    return () => {
      container.removeEventListener('scroll', updateCurrentPage);
      window.removeEventListener('resize', updateCurrentPage);
    };
  }, [page, totalPages, viewMode]);

  useEffect(() => {
    if (viewMode !== 'scroll') return;
    const node = pageFramesRef.current[page];
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollIntoView({ block: 'start' });
    });
  }, [viewMode]);

  const pdf = pdfRef.current;
  const pdfjs = pdfjsRef.current;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  const changePage = (nextPage: number) => {
    const clampedPage = Math.max(1, Math.min(totalPages || nextPage, nextPage));
    setPage(clampedPage);

    if (viewMode === 'scroll') {
      pageFramesRef.current[clampedPage]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '10px 0' }}>
        <button onClick={() => changePage(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center' }}>
          {page} / {totalPages || '...'}
        </div>
        <button onClick={() => changePage(page + 1)} disabled={totalPages > 0 ? page >= totalPages : true}>
          Next
        </button>
        <div style={{ width: '1px', background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />
        <button
          onClick={() => setViewMode('paged')}
          disabled={viewMode === 'paged'}
          aria-label="Use paged PDF view"
        >
          Paged
        </button>
        <button
          onClick={() => setViewMode('scroll')}
          disabled={viewMode === 'scroll'}
          aria-label="Use vertical scroll PDF view"
        >
          Scroll
        </button>
        <div style={{ width: '1px', background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />
        <button onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.25).toFixed(2))))} disabled={zoom <= 0.75}>
          -
        </button>
        <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', minWidth: '48px', justifyContent: 'center' }}>
          {Math.round(zoom * 100)}%
        </div>
        <button onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} disabled={zoom >= 3}>
          +
        </button>
      </div>
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          paddingBottom: '24px',
          paddingInline: '24px',
        }}
      >
        {pdf && pdfjs ? (
          viewMode === 'scroll' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', paddingBlock: '8px' }}>
              {pageNumbers.map((pageNumber) => (
                <PdfPageSurface
                  key={pageNumber}
                  pdf={pdf}
                  pdfjs={pdfjs}
                  pageNumber={pageNumber}
                  zoom={zoom}
                  onSelection={onSelection}
                  onError={onError}
                  registerFrame={(node) => {
                    pageFramesRef.current[pageNumber] = node;
                  }}
                />
              ))}
            </div>
          ) : (
            <PdfPageSurface
              pdf={pdf}
              pdfjs={pdfjs}
              pageNumber={page}
              zoom={zoom}
              onSelection={onSelection}
              onError={onError}
              registerFrame={(node) => {
                pageFramesRef.current[page] = node;
              }}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
