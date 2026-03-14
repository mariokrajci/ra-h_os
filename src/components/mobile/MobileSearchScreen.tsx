"use client";

import { useEffect, useState } from 'react';

interface SearchResult {
  id: number;
  title: string;
  dimensions?: string[];
}

export default function MobileSearchScreen({
  onBack,
  onOpenNode,
}: {
  onBack: () => void;
  onOpenNode: (nodeId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/nodes/search?q=${encodeURIComponent(query)}&limit=20`);
        const result = await response.json();
        if (result.success) {
          setResults(result.data || []);
        }
      } catch (error) {
        console.error('Failed to search mobile notes:', error);
      }
    }, 160);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)', paddingBottom: '92px' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--app-border)' }}>
        <button type="button" className="app-button app-button--ghost app-button--compact" onClick={onBack}>Back</button>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes..."
          className="app-input"
          style={{ marginTop: '12px', padding: '12px 14px' }}
        />
      </div>

      <div style={{ padding: '8px 12px 0' }}>
        {!query.trim() ? (
          <div style={{ padding: '16px 4px', color: 'var(--app-text-muted)' }}>Search by title or content.</div>
        ) : results.length === 0 ? (
          <div style={{ padding: '16px 4px', color: 'var(--app-text-muted)' }}>No results yet.</div>
        ) : (
          results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => onOpenNode(result.id)}
              className="app-button app-button--ghost"
              style={{ width: '100%', textAlign: 'left', padding: '14px 12px', marginBottom: '8px', borderRadius: '14px', borderColor: 'var(--app-border)', background: 'var(--app-panel)' }}
            >
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{result.title}</div>
              <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--app-text-muted)' }}>
                {result.dimensions?.length ? result.dimensions.join(', ') : 'Open note'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
