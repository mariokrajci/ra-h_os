"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { parseBookCommand } from '@/services/ingestion/bookCommand';

interface QuickAddSubmitPayload {
  input: string;
  mode: 'link' | 'note' | 'chat';
  description?: string;
  bookSelection?: {
    title: string;
    author?: string;
    isbn?: string;
    cover_url?: string;
    publisher?: string;
    first_published_year?: number;
    page_count?: number;
  };
}

interface QuickAddInputProps {
  onSubmit: (payload: QuickAddSubmitPayload) => Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
}

type DetectedType = 'youtube' | 'website' | 'pdf-url' | 'epub-url' | 'note' | 'chat';
interface BookLookupCandidate {
  title: string;
  author?: string;
  isbn?: string;
  cover_url?: string;
  publisher?: string;
  first_published_year?: number;
  page_count?: number;
  confidence?: number;
}

function detectType(raw: string): DetectedType {
  const trimmed = raw.trim();
  if (!trimmed) return 'note';
  if (/youtu(\.be|be\.com)/i.test(trimmed)) return 'youtube';
  if (/\.pdf($|\?)/i.test(trimmed) || /arxiv\.org\//i.test(trimmed)) return 'pdf-url';
  if (/\.epub($|\?)/i.test(trimmed)) return 'epub-url';
  if (/^https?:\/\//i.test(trimmed)) return 'website';
  return 'note';
}

const TYPE_LABELS: Record<DetectedType, string> = {
  youtube: 'YouTube',
  website: 'Link',
  'pdf-url': 'PDF',
  'epub-url': 'EPUB',
  note: 'Note',
  chat: 'Transcript',
};

const TYPE_COLORS: Record<DetectedType, string> = {
  youtube: '#ef4444',
  website: '#3b82f6',
  'pdf-url': '#f59e0b',
  'epub-url': '#8b5cf6',
  note: '#22c55e',
  chat: '#a78bfa',
};

export default function QuickAddInput({ onSubmit, isOpen, onClose }: QuickAddInputProps) {
  const [input, setInput] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualType, setManualType] = useState<DetectedType | null>(null);
  const [bookCandidates, setBookCandidates] = useState<BookLookupCandidate[]>([]);
  const [selectedBookCandidateIndex, setSelectedBookCandidateIndex] = useState(0);
  const [bookLookupLoading, setBookLookupLoading] = useState(false);
  const [bookLookupError, setBookLookupError] = useState<string | null>(null);

  const isControlled = isOpen !== undefined;
  const isExpanded = isControlled ? isOpen : isExpandedInternal;
  const setIsExpanded = isControlled
    ? (value: boolean) => { if (!value && onClose) onClose(); }
    : setIsExpandedInternal;

  const detectedType = useMemo(() => detectType(input), [input]);
  const effectiveType = manualType ?? detectedType;
  const parsedBookCommand = useMemo(() => parseBookCommand(input), [input]);
  const isBookFlow = !uploadedFile && parsedBookCommand.kind === 'book';
  const showTypePill = input.trim().length > 0 && !uploadedFile;

  useEffect(() => {
    setManualType(null);
  }, [input, uploadedFile]);

  useEffect(() => {
    if (!isBookFlow) {
      setBookCandidates([]);
      setSelectedBookCandidateIndex(0);
      setBookLookupLoading(false);
      setBookLookupError(null);
      return;
    }

    const title = parsedBookCommand.title?.trim();
    const author = parsedBookCommand.author?.trim();
    const isbn = parsedBookCommand.isbn?.trim();
    if (!title && !isbn) {
      setBookCandidates([]);
      setSelectedBookCandidateIndex(0);
      setBookLookupError('Add a title or ISBN so we can match the book.');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setBookLookupLoading(true);
      setBookLookupError(null);
      try {
        const response = await fetch('/api/books/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, author, isbn }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch book matches');
        }

        const candidates = Array.isArray(result.candidates)
          ? result.candidates.filter((candidate: any) => typeof candidate?.title === 'string' && candidate.title.trim().length > 0)
          : [];
        setBookCandidates(candidates);
        setSelectedBookCandidateIndex(0);
        if (candidates.length === 0) {
          setBookLookupError('No matches found. Try adding author or ISBN.');
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setBookCandidates([]);
        setBookLookupError(error instanceof Error ? error.message : 'Failed to fetch book matches');
      } finally {
        setBookLookupLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [isBookFlow, parsedBookCommand]);

  const typeOptions = useMemo<DetectedType[]>(() => {
    if (detectedType === 'note' || detectedType === 'chat') {
      return ['note', 'chat'];
    }
    return [detectedType, 'note'];
  }, [detectedType]);

  const cycleType = () => {
    if (typeOptions.length <= 1) return;
    const currentIndex = typeOptions.indexOf(effectiveType);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % typeOptions.length;
    setManualType(typeOptions[nextIndex] === detectedType ? null : typeOptions[nextIndex]);
  };

  const submitMode: QuickAddSubmitPayload['mode'] = effectiveType === 'chat'
    ? 'chat'
    : effectiveType === 'note'
      ? 'note'
      : 'link';
  const selectedBookCandidate = bookCandidates[selectedBookCandidateIndex] || null;

  const handleFileUpload = useCallback(async (file: File) => {
    setIsPosting(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');
      const uploadPath = isPdf
        ? '/api/extract/pdf/upload'
        : isEpub
          ? '/api/extract/epub/upload'
          : null;

      if (!uploadPath) {
        throw new Error('Only PDF and EPUB files are supported');
      }

      const response = await fetch(uploadPath, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      setUploadedFile(null);
      setInput('');
      setIsExpanded(false);
    } catch (error) {
      console.error('[QuickAddInput] Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsPosting(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (uploadedFile) {
      await handleFileUpload(uploadedFile);
      return;
    }
    if (!input.trim() || isPosting) return;
    if (isBookFlow && !selectedBookCandidate) return;
    setIsPosting(true);
    try {
      await onSubmit({
        input: input.trim(),
        mode: submitMode,
        bookSelection: isBookFlow && selectedBookCandidate ? {
          title: selectedBookCandidate.title,
          author: selectedBookCandidate.author,
          isbn: selectedBookCandidate.isbn,
          cover_url: selectedBookCandidate.cover_url,
          publisher: selectedBookCandidate.publisher,
          first_published_year: selectedBookCandidate.first_published_year,
          page_count: selectedBookCandidate.page_count,
        } : undefined,
      });
      setInput('');
      setIsExpanded(false);
    } catch (error) {
      console.error('[QuickAddInput] Submit error:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setInput('');
      setUploadedFile(null);
      setUploadError(null);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setUploadError(null);
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');
    if (!isPdf && !isEpub) {
      setUploadError('Only PDF and EPUB files are supported');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError(`File too large (${Math.round(file.size / 1024 / 1024)}MB). Max 50MB.`);
      return;
    }
    setUploadedFile(file);
    setInput('');
  }, []);

  const canSubmit = uploadedFile
    ? true
    : isBookFlow
      ? !!input.trim() && !!selectedBookCandidate
      : !!input.trim();

  const handleClose = () => {
    setIsExpanded(false);
    setInput('');
    setUploadedFile(null);
    setUploadError(null);
  };

  if (!isExpanded) {
    if (isControlled) return null;
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          color: '#22c55e',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          boxShadow: '0 0 12px rgba(34, 197, 94, 0.15)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
          e.currentTarget.style.borderColor = '#22c55e';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        }}
      >
        <span style={{
          width: '18px', height: '18px', borderRadius: '50%',
          background: '#22c55e', color: '#0a0a0a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700
        }}>+</span>
        Add Stuff
      </button>
    );
  }

  const modalContent = (
    <div
      className="qa-card"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => e.stopPropagation()}
    >
      {/* File preview */}
      {uploadedFile && (
        <div className="qa-file-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="qa-file-name">{uploadedFile.name}</span>
          <span className="qa-file-size">
            {uploadedFile.size < 1024 * 1024
              ? `${Math.round(uploadedFile.size / 1024)} KB`
              : `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB`}
          </span>
          <button onClick={() => { setUploadedFile(null); setUploadError(null); }} className="qa-file-remove">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div className="qa-error">{uploadError}</div>
      )}

      {/* Input area */}
      {!uploadedFile && (
        <div className={`qa-input-area ${dragOver ? 'dragging' : ''}`}>
          {dragOver && (
            <div className="qa-drag-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Drop PDF or EPUB</span>
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a URL, write a note, or drop a PDF/EPUB..."
            disabled={isPosting}
            autoFocus
            className="qa-textarea"
            style={{ opacity: dragOver ? 0.2 : 1 }}
          />
        </div>
      )}

      {/* Footer */}
      {isBookFlow && !uploadedFile && (
        <div className="qa-book-matches">
          <div className="qa-book-header">
            <span className="qa-book-title">Pick the correct book</span>
            {bookLookupLoading ? <span className="qa-book-meta">Searching...</span> : null}
          </div>
          {bookLookupError && !bookLookupLoading ? (
            <div className="qa-book-error">{bookLookupError}</div>
          ) : null}
          {bookCandidates.length > 0 && (
            <div className="qa-book-grid">
              {bookCandidates.map((candidate, index) => {
                const active = selectedBookCandidateIndex === index;
                return (
                  <button
                    key={`${candidate.title}-${candidate.isbn || index}`}
                    onClick={() => setSelectedBookCandidateIndex(index)}
                    className={`qa-book-card ${active ? 'active' : ''}`}
                    type="button"
                  >
                    <div className="qa-book-cover">
                      {candidate.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={candidate.cover_url} alt={candidate.title} />
                      ) : (
                        <span>{candidate.title.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="qa-book-copy">
                      <div className="qa-book-copy-title">{candidate.title}</div>
                      {candidate.author ? <div className="qa-book-copy-author">{candidate.author}</div> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="qa-footer">
        <div className="qa-footer-left">
          {showTypePill && !isBookFlow && (
            <button
              type="button"
              className="qa-type-pill"
              onClick={cycleType}
              style={{
              color: TYPE_COLORS[effectiveType],
              borderColor: TYPE_COLORS[effectiveType] + '30',
              background: TYPE_COLORS[effectiveType] + '0a',
            }}>
              <span className="qa-type-pill-main">{TYPE_LABELS[effectiveType]}</span>
              <span className="qa-type-pill-sub">click to change</span>
            </button>
          )}
          <span className="qa-hint">
            {uploadedFile
              ? 'Ready to upload'
              : <><kbd>{'\u2318\u21B5'}</kbd><span className="qa-hint-sep">send</span><kbd>esc</kbd><span className="qa-hint-sep">close</span></>
            }
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isPosting}
          className={`qa-submit ${canSubmit && !isPosting ? 'active' : ''}`}
        >
          {isPosting ? (
            <span className="qa-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/>
              <path d="M12 5l7 7-7 7"/>
            </svg>
          )}
        </button>
      </div>

      <style jsx>{`
        .qa-card {
          display: flex;
          flex-direction: column;
          gap: 0;
          background: #111111;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.03),
            0 24px 80px -12px rgba(0, 0, 0, 0.8),
            0 0 60px -10px rgba(34, 197, 94, 0.06);
          animation: qaIn 250ms cubic-bezier(0.16, 1, 0.3, 1);
          width: ${isControlled ? '600px' : 'auto'};
          max-width: ${isControlled ? '90vw' : 'none'};
        }

        .qa-input-area {
          position: relative;
          transition: all 0.2s ease;
        }

        .qa-input-area.dragging {
          background: rgba(34, 197, 94, 0.03);
        }

        .qa-drag-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #22c55e;
          font-size: 13px;
          font-weight: 500;
          z-index: 10;
          pointer-events: none;
        }

        .qa-textarea {
          width: 100%;
          min-height: 120px;
          max-height: 300px;
          padding: 20px 22px;
          background: transparent;
          border: none;
          color: #e5e5e5;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          resize: none;
          line-height: 1.6;
          transition: opacity 0.15s ease;
        }

        .qa-textarea::placeholder {
          color: #444;
        }

        .qa-file-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .qa-file-name {
          flex: 1;
          min-width: 0;
          color: #e5e5e5;
          font-size: 13px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .qa-file-size {
          color: #555;
          font-size: 11px;
          flex-shrink: 0;
        }

        .qa-file-remove {
          padding: 4px;
          background: transparent;
          border: none;
          color: #555;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          transition: color 0.15s ease;
        }

        .qa-file-remove:hover {
          color: #ef4444;
        }

        .qa-error {
          padding: 10px 20px;
          color: #ef4444;
          font-size: 12px;
          background: rgba(239, 68, 68, 0.06);
          border-bottom: 1px solid rgba(239, 68, 68, 0.1);
        }

        .qa-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px 12px 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .qa-book-matches {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 260px;
          overflow: auto;
        }

        .qa-book-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .qa-book-title {
          font-size: 11px;
          color: #8b8b8b;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          font-weight: 600;
        }

        .qa-book-meta {
          font-size: 10px;
          color: #666;
        }

        .qa-book-error {
          font-size: 11px;
          color: #b06a6a;
        }

        .qa-book-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 8px;
        }

        .qa-book-card {
          display: flex;
          gap: 8px;
          align-items: stretch;
          border: 1px solid #252525;
          background: #141414;
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          transition: border-color 0.12s ease, background 0.12s ease;
          text-align: left;
        }

        .qa-book-card:hover {
          border-color: #2f2f2f;
        }

        .qa-book-card.active {
          border-color: rgba(34, 197, 94, 0.6);
          background: rgba(34, 197, 94, 0.08);
        }

        .qa-book-cover {
          width: 34px;
          min-width: 34px;
          height: 48px;
          border-radius: 4px;
          overflow: hidden;
          background: #1d1d1d;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #777;
          font-size: 12px;
          font-weight: 600;
        }

        .qa-book-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .qa-book-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          justify-content: center;
        }

        .qa-book-copy-title {
          font-size: 11px;
          color: #d6d6d6;
          line-height: 1.3;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .qa-book-copy-author {
          font-size: 10px;
          color: #8a8a8a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .qa-footer-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .qa-type-pill {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid;
          text-transform: uppercase;
          animation: pillIn 150ms ease-out;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .qa-type-pill:hover {
          border-color: rgba(255, 255, 255, 0.22) !important;
        }

        .qa-type-pill-main {
          color: inherit;
        }

        .qa-type-pill-sub {
          color: #666;
          font-size: 9px;
          letter-spacing: 0.02em;
          text-transform: none;
        }

        .qa-hint {
          font-size: 11px;
          color: #3a3a3a;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .qa-hint kbd {
          display: inline-flex;
          align-items: center;
          padding: 1px 5px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 3px;
          font-size: 10px;
          font-family: inherit;
          color: #444;
        }

        .qa-hint-sep {
          margin: 0 1px;
          color: #333;
        }

        .qa-submit {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: rgba(255, 255, 255, 0.04);
          border: none;
          border-radius: 10px;
          color: #333;
          cursor: default;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .qa-submit.active {
          background: #22c55e;
          color: #052e16;
          cursor: pointer;
        }

        .qa-submit.active:hover {
          background: #16a34a;
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
        }

        .qa-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #052e16;
          border-top-color: transparent;
          border-radius: 50%;
          animation: qaSpin 0.8s linear infinite;
        }

        @keyframes qaIn {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(-6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pillIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes qaSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (isControlled) {
    const backdrop = (
      <div className="qa-backdrop" onClick={handleClose}>
        <div className="qa-container">
          {modalContent}
        </div>
        <style jsx>{`
          .qa-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: qaFadeIn 200ms ease-out;
          }
          .qa-container {
            width: 100%;
            max-width: 600px;
            height: fit-content;
          }
          @keyframes qaFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    );
    return typeof window !== 'undefined' ? createPortal(backdrop, document.body) : null;
  }

  return (
    <div style={{ position: 'absolute', top: '60px', left: '20px', right: '20px', zIndex: 100 }}>
      {modalContent}
    </div>
  );
}
