"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';

interface DocMeta {
  slug: string;
  title: string;
  order: number;
  fileName: string;
}

interface DocRecord extends DocMeta {
  content: string;
}

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DocsModal({ isOpen, onClose }: DocsModalProps) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [docRecords, setDocRecords] = useState<Record<string, DocRecord>>({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocRecord | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [indexingDocs, setIndexingDocs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredDocs = docs.filter((doc) => {
    if (!normalizedSearchQuery) return true;
    if (indexingDocs) return true;
    const searchableContent = [
      doc.title,
      doc.fileName,
      docRecords[doc.slug]?.content || '',
    ].join('\n').toLowerCase();
    return searchableContent.includes(normalizedSearchQuery);
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const loadDocs = async () => {
      setLoadingList(true);
      try {
        const response = await fetch('/api/docs');
        const payload = await response.json();
        if (response.ok && payload.success && Array.isArray(payload.data)) {
          setDocs(payload.data);
          setDocRecords({});
          setIndexingDocs(payload.data.length > 0);
          setSearchQuery('');
          const firstSlug = payload.data[0]?.slug ?? null;
          setSelectedSlug(firstSlug);
        }
      } catch (error) {
        console.error('Failed to load docs list:', error);
      } finally {
        setLoadingList(false);
      }
    };

    loadDocs();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || docs.length === 0) return;

    const loadAllDocs = async () => {
      const nextRecords: Record<string, DocRecord> = {};
      await Promise.all(docs.map(async (doc) => {
        if (docRecords[doc.slug]) {
          nextRecords[doc.slug] = docRecords[doc.slug];
          return;
        }
        try {
          const response = await fetch(`/api/docs/${doc.slug}`);
          const payload = await response.json();
          if (response.ok && payload.success) {
            nextRecords[doc.slug] = payload.data;
          }
        } catch (error) {
          console.error(`Failed to preload doc ${doc.slug}:`, error);
        }
      }));
      setDocRecords((current) => ({ ...current, ...nextRecords }));
      setIndexingDocs(false);
    };

    loadAllDocs();
  }, [isOpen, docs]);

  useEffect(() => {
    if (!isOpen || !selectedSlug) return;

    const cachedDoc = docRecords[selectedSlug];
    if (cachedDoc) {
      setActiveDoc(cachedDoc);
      return;
    }

    const loadDoc = async () => {
      setLoadingDoc(true);
      try {
        const response = await fetch(`/api/docs/${selectedSlug}`);
        const payload = await response.json();
        if (response.ok && payload.success) {
          setDocRecords((current) => ({ ...current, [selectedSlug]: payload.data }));
          setActiveDoc(payload.data);
        }
      } catch (error) {
        console.error(`Failed to load doc ${selectedSlug}:`, error);
      } finally {
        setLoadingDoc(false);
      }
    };

    loadDoc();
  }, [docRecords, isOpen, selectedSlug]);

  useEffect(() => {
    if (!isOpen) return;

    if (filteredDocs.length === 0) {
      return;
    }

    const selectedStillVisible = selectedSlug ? filteredDocs.some((doc) => doc.slug === selectedSlug) : false;
    if (!selectedStillVisible) {
      setSelectedSlug(filteredDocs[0].slug);
    }
  }, [filteredDocs, isOpen, selectedSlug]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--app-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '80vw',
          height: '85vh',
          background: 'var(--app-panel)',
          border: '1px solid var(--app-border)',
          borderRadius: '10px',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '260px',
            borderRight: '1px solid var(--app-border)',
            background: 'var(--app-toolbar)',
            padding: '20px 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '0 20px 16px', fontSize: '18px', fontWeight: 600, color: 'var(--app-text)' }}>
            Docs
          </div>
          <div style={{ padding: '0 20px 12px', fontSize: '12px', color: 'var(--app-text-muted)', lineHeight: 1.5 }}>
            Read-only product and system documentation from the top-level numbered docs.
          </div>
          <div style={{ padding: '0 20px 12px' }}>
            <input
              type="search"
              value={searchQuery}
              onInput={(event) => setSearchQuery((event.target as HTMLInputElement).value)}
              placeholder="Search docs..."
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid var(--app-border)',
                background: 'var(--app-panel)',
                color: 'var(--app-text)',
                padding: '10px 12px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', padding: '0 8px 8px' }}>
            {loadingList ? (
              <div style={{ padding: '12px', color: 'var(--app-text-muted)', fontSize: '13px' }}>Loading docs...</div>
            ) : normalizedSearchQuery && indexingDocs ? (
              <div style={{ padding: '12px', color: 'var(--app-text-muted)', fontSize: '13px' }}>
                Indexing docs...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--app-text-muted)', fontSize: '13px' }}>
                No docs match your search.
              </div>
            ) : filteredDocs.map((doc) => {
              const isActive = selectedSlug === doc.slug;
              return (
                <button
                  key={doc.slug}
                  data-doc-button="true"
                  onClick={() => setSelectedSlug(doc.slug)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isActive ? 'var(--app-selected)' : 'transparent',
                    border: isActive ? '1px solid var(--app-toolbar-border)' : '1px solid transparent',
                    borderRadius: '8px',
                    color: isActive ? 'var(--app-text)' : 'var(--app-text-muted)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '2px' }}>{doc.fileName}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{doc.title}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--app-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--app-text)' }}>
                {activeDoc?.title || 'Documentation'}
              </div>
              {activeDoc && (
                <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '4px' }}>
                  {activeDoc.fileName}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--app-text-muted)',
                cursor: 'pointer',
                fontSize: '24px',
                lineHeight: 1,
              }}
              title="Close"
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {loadingDoc || !activeDoc ? (
              <div style={{ color: 'var(--app-text-muted)', fontSize: '14px' }}>
                {loadingDoc ? 'Loading doc...' : 'Select a document'}
              </div>
            ) : (
              <div style={{ color: 'var(--app-text)', fontSize: '14px', lineHeight: 1.7 }}>
                <MarkdownWithNodeTokens content={activeDoc.content} highlightQuery={searchQuery} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
