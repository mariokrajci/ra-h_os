"use client";

import { useEffect, useMemo, useState } from 'react';

import { usePersistentState } from '@/hooks/usePersistentState';
import type { Node } from '@/types/database';

export type NotesSortOrder = 'updated' | 'created' | 'edges';

export const NOTES_SORT_OPTIONS: Array<{ value: NotesSortOrder; label: string }> = [
  { value: 'updated', label: 'Last edited' },
  { value: 'created', label: 'Created' },
  { value: 'edges', label: 'Connections' },
];

export function useNotesFeed(refreshToken: number, stateKey = 'ui.mobile.notes.sort') {
  const [sortOrder, setSortOrder] = usePersistentState<NotesSortOrder>(stateKey, 'updated');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      setLoading(true);
      try {
        const response = await fetch(`/api/nodes?limit=100&sortBy=${sortOrder}`);
        const result = await response.json();
        if (!cancelled && result.success) {
          setNodes(result.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load notes feed:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadNotes();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, sortOrder]);

  const sortLabel = useMemo(() => {
    return NOTES_SORT_OPTIONS.find((option) => option.value === sortOrder)?.label ?? 'Last edited';
  }, [sortOrder]);

  return { sortOrder, setSortOrder, nodes, loading, sortLabel };
}
