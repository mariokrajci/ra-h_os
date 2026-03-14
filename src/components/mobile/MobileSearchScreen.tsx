"use client";

import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

import { useNotesFeed } from './useNotesFeed';
import { getMobileNotePreview } from './mobileNotesPresentation';
import { formatRelativeTime } from './formatRelativeTime';

interface SearchResult {
  id: number;
  title: string;
  notes?: string | null;
  description?: string | null;
  updated_at: string;
}

export default function MobileSearchScreen({
  onBack,
  onOpenNode,
  animation,
}: {
  onBack: () => void;
  onOpenNode: (nodeId: number) => void;
  animation: string | undefined;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recent notes for empty state
  const { nodes: recentNodes } = useNotesFeed(0, 'ui.mobile.search.recent');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/nodes/search?q=${encodeURIComponent(query)}&limit=20`);
        const result = await response.json();
        if (result.success) {
          setResults(result.data || []);
        }
      } catch (error) {
        console.error('Failed to search:', error);
      } finally {
        setSearching(false);
      }
    }, 160);

    return () => clearTimeout(timeout);
  }, [query]);

  const showEmpty = !query.trim();
  const showSearching = !showEmpty && searching;
  const showNoResults = !showEmpty && !searching && results.length === 0;
  const showResults = !showEmpty && !searching && results.length > 0;

  function renderRow(item: { id: number; title: string; notes?: string | null; description?: string | null; updated_at: string }, index: number, total: number) {
    return (
      <Fragment key={item.id}>
        <button
          type="button"
          onClick={() => onOpenNode(item.id)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '12px 16px',
            minHeight: '64px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '3px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 650,
              color: 'var(--app-text)',
              lineHeight: 1.25,
              fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.title || `Untitled #${item.id}`}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--app-text-subtle)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {formatRelativeTime(item.updated_at)}
            </div>
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--app-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getMobileNotePreview(item)}
          </div>
        </button>
        {index < total - 1 && (
          <div style={{ height: '0.5px', background: 'var(--app-border)', marginLeft: '16px' }} />
        )}
      </Fragment>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Header with search input */}
      <div style={{
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid var(--app-border)',
        padding: '14px 16px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="app-button app-button--ghost app-button--compact"
            style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 6px 4px', flexShrink: 0 }}
            onClick={onBack}
          >
            <ChevronLeft size={18} />
            Notes
          </button>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="app-input"
            style={{ flex: 1, padding: '10px 14px', fontSize: '16px' }}
          />
        </div>
      </div>

      {/* Results / empty state */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}>
        {showEmpty && (
          <>
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent
              </div>
            </div>
            {recentNodes.slice(0, 8).map((node, i) => renderRow(node, i, Math.min(recentNodes.length, 8)))}
          </>
        )}

        {showSearching && (
          <div style={{ padding: '20px 16px', color: 'var(--app-text-muted)', fontSize: '14px' }}>Searching…</div>
        )}

        {showNoResults && (
          <div style={{ padding: '20px 16px', color: 'var(--app-text-muted)', fontSize: '14px' }}>
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {showResults && results.map((result, i) => renderRow(result, i, results.length))}
      </div>
    </div>
  );
}
