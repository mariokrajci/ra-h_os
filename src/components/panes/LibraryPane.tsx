"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookReader } from '@/components/focus/reader';
import type { Node } from '@/types/database';
import PaneHeader from './PaneHeader';
import type { LibraryPaneProps } from './types';
import BookCard from './library/BookCard';
import LibraryFilters, { type LibraryFilter, type LibrarySort } from './library/LibraryFilters';
import { applyBookMatchCandidate, type BookMatchCandidate } from './library/bookMatch';

function isLibraryNode(node: Node): boolean {
  if (node.metadata?.file_type === 'pdf' || node.metadata?.file_type === 'epub') return true;
  if (node.metadata?.book_title || node.metadata?.book_author || node.metadata?.cover_url) return true;
  if (node.link?.match(/\.(pdf|epub)($|\?)/i)) return true;
  return false;
}

function applyFilter(nodes: Node[], filter: LibraryFilter): Node[] {
  switch (filter) {
    case 'in_progress':
      return nodes.filter((node) => {
        const percent = node.metadata?.reading_progress?.percent ?? 0;
        return percent > 0 && percent < 100;
      });
    case 'completed':
      return nodes.filter((node) => (node.metadata?.reading_progress?.percent ?? 0) >= 100);
    case 'not_started':
      return nodes.filter((node) => (node.metadata?.reading_progress?.percent ?? 0) === 0);
    default:
      return nodes;
  }
}

function applySort(nodes: Node[], sort: LibrarySort): Node[] {
  return [...nodes].sort((a, b) => {
    if (sort === 'title') {
      return (a.metadata?.book_title || a.title).localeCompare(b.metadata?.book_title || b.title);
    }
    if (sort === 'date_added') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    const aDate = a.metadata?.reading_progress?.last_read_at || a.created_at;
    const bDate = b.metadata?.reading_progress?.last_read_at || b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

export default function LibraryPane({
  slot,
  isActive,
  onPaneAction,
  onCollapse,
  onSwapPanes,
  refreshToken,
}: LibraryPaneProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sort, setSort] = useState<LibrarySort>('last_read');
  const [readerNode, setReaderNode] = useState<Node | null>(null);

  const fetchNodes = useCallback(async () => {
    const response = await fetch('/api/nodes?limit=500');
    const json = await response.json();
    if (json.success) {
      setNodes((json.data as Node[]).filter(isLibraryNode));
    }
  }, []);

  useEffect(() => {
    fetchNodes().catch((error) => console.error('Failed to load library nodes:', error));
  }, [fetchNodes, refreshToken]);

  const visibleNodes = useMemo(
    () => applySort(applyFilter(nodes, filter), sort),
    [filter, nodes, sort],
  );

  const confirmMatch = useCallback(async (node: Node, candidate: BookMatchCandidate) => {
    const nextMetadata = applyBookMatchCandidate(node.metadata || {}, candidate);
    await fetch(`/api/nodes/${node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: nextMetadata }),
    });

    setNodes((prev) => prev.map((item) => (
      item.id === node.id
        ? { ...item, metadata: nextMetadata }
        : item
    )));
  }, []);

  const retryBookEnrichment = useCallback(async (node: Node) => {
    await fetch(`/api/nodes/${node.id}/enrich-book`, {
      method: 'POST',
    });

    setNodes((prev) => prev.map((item) => (
      item.id === node.id
        ? {
          ...item,
          metadata: {
            ...(item.metadata || {}),
            book_metadata_status: 'pending',
          },
        }
        : item
    )));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PaneHeader slot={slot} onCollapse={onCollapse} onSwapPanes={onSwapPanes}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#e5e5e5' : '#888' }}>
          Library
        </div>
      </PaneHeader>
      <LibraryFilters filter={filter} sort={sort} onFilterChange={setFilter} onSortChange={setSort} />
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {visibleNodes.length === 0 ? (
          <div style={{ color: '#666', fontSize: '13px' }}>No readable PDFs or EPUBs yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '18px' }}>
            {visibleNodes.map((node) => (
              <BookCard
                key={node.id}
                node={node}
                onOpen={setReaderNode}
                onConfirmMatch={confirmMatch}
                onRetryMetadata={retryBookEnrichment}
              />
            ))}
          </div>
        )}
      </div>

      {readerNode ? (
        <BookReader
          nodeId={readerNode.id}
          title={readerNode.title}
          content={readerNode.chunk || ''}
          link={readerNode.link}
          metadata={readerNode.metadata}
          onClose={() => setReaderNode(null)}
          onProgressUpdate={async (progress) => {
            if (!progress) return;
            await fetch(`/api/nodes/${readerNode.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ metadata: { reading_progress: progress } }),
            });
            setNodes((prev) => prev.map((node) => (
              node.id === readerNode.id
                ? { ...node, metadata: { ...(node.metadata || {}), reading_progress: progress } }
                : node
            )));
          }}
          onCreateAnnotation={async (annotation) => {
            await fetch('/api/annotations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ node_id: readerNode.id, ...annotation }),
            });
          }}
        />
      ) : null}
    </div>
  );
}
