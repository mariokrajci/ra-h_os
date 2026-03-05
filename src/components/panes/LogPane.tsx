"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry } from '@/types/database';
import { LogPaneProps } from './types';
import PaneHeader from './PaneHeader';
import LogDateSection from '@/components/log/LogDateSection';

type EntriesByDate = Record<string, LogEntry[]>;

const PAGE_SIZE_DAYS = 7;

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LogPane({ slot, isActive, onPaneAction, onCollapse, onSwapPanes, onNodeOpen }: LogPaneProps) {
  const [entriesByDate, setEntriesByDate] = useState<EntriesByDate>({});
  const [allDates, setAllDates] = useState<string[]>([]);
  const [loadedDates, setLoadedDates] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [newEntryId, setNewEntryId] = useState<number | null>(null);
  const newEntryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchDates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDates = async () => {
    const res = await fetch('/api/log/dates');
    const json = await res.json();
    if (!json.success) return;

    let dates: string[] = json.data;
    const today = getToday();
    if (!dates.includes(today)) dates = [today, ...dates];

    setAllDates(dates);
    const initial = dates.slice(0, PAGE_SIZE_DAYS);
    setLoadedDates(initial);
    setHasMore(dates.length > PAGE_SIZE_DAYS);
    await fetchEntriesForDates(initial);
  };

  const fetchEntriesForDates = async (dates: string[]) => {
    const results = await Promise.all(
      dates.map(async date => {
        const res = await fetch(`/api/log?date=${date}`);
        const json = await res.json();
        return { date, entries: json.success ? (json.data as LogEntry[]) : [] };
      })
    );
    setEntriesByDate(prev => {
      const next = { ...prev };
      results.forEach(({ date, entries }) => { next[date] = entries; });
      return next;
    });
  };

  const loadMore = async () => {
    const next = allDates.slice(loadedDates.length, loadedDates.length + PAGE_SIZE_DAYS);
    await fetchEntriesForDates(next);
    const updated = [...loadedDates, ...next];
    setLoadedDates(updated);
    setHasMore(updated.length < allDates.length);
  };

  const handleSave = useCallback(async (id: number, content: string) => {
    const res = await fetch(`/api/log/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      keepalive: true,
    });
    const json = await res.json();
    if (!json.success) return;
    setEntriesByDate(prev => {
      const next = { ...prev };
      for (const date of Object.keys(next)) {
        next[date] = next[date].map(e => e.id === id ? { ...e, content } : e);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    const res = await fetch(`/api/log/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) return;
    setEntriesByDate(prev => {
      const next = { ...prev };
      for (const date of Object.keys(next)) {
        next[date] = next[date].filter(e => e.id !== id);
      }
      return next;
    });
  }, []);

  const handlePromote = useCallback(async (id: number) => {
    const res = await fetch(`/api/log/${id}/promote`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) return;
    const nodeId: number = json.data.nodeId;
    setEntriesByDate(prev => {
      const next = { ...prev };
      for (const date of Object.keys(next)) {
        next[date] = next[date].map(e => e.id === id ? { ...e, promoted_node_id: nodeId } : e);
      }
      return next;
    });
    onNodeOpen?.(nodeId);
  }, [onNodeOpen]);

  const handleEnterAtEnd = useCallback(async (afterId: number) => {
    let entryDate = getToday();
    for (const [date, entries] of Object.entries(entriesByDate)) {
      if (entries.some(e => e.id === afterId)) { entryDate = date; break; }
    }
    const existing = entriesByDate[entryDate] ?? [];
    const afterIdx = existing.findIndex(e => e.id === afterId);
    const order_idx = afterIdx + 1;
    const res = await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: entryDate, content: '', order_idx }),
    });
    const json = await res.json();
    if (!json.success) return;
    const newEntry: LogEntry = json.data;
    setEntriesByDate(prev => {
      const dateEntries = [...(prev[entryDate] ?? [])];
      dateEntries.splice(order_idx, 0, newEntry);
      return { ...prev, [entryDate]: dateEntries };
    });
    if (newEntryTimerRef.current) clearTimeout(newEntryTimerRef.current);
    setNewEntryId(newEntry.id);
    newEntryTimerRef.current = setTimeout(() => setNewEntryId(null), 100);
  }, [entriesByDate]);

  const handleGhostCommit = useCallback(async (content: string) => {
    const today = getToday();
    const existing = entriesByDate[today] ?? [];
    const order_idx = existing.length;
    const res = await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, content, order_idx }),
    });
    const json = await res.json();
    if (!json.success) return;
    const newEntry: LogEntry = json.data;
    setEntriesByDate(prev => ({ ...prev, [today]: [...(prev[today] ?? []), newEntry] }));
    if (!loadedDates.includes(today)) {
      setLoadedDates(prev => [today, ...prev]);
    }
  }, [entriesByDate, loadedDates]);

  useEffect(() => {
    const handler = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.contentEditable === 'true') active.blur();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d0d' }}>
      <PaneHeader slot={slot} onCollapse={onCollapse} onSwapPanes={onSwapPanes}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 12px' }}>
          <span style={{ fontSize: '13px', color: '#888', fontWeight: 500 }}>Log</span>
        </div>
      </PaneHeader>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loadedDates.map(date => (
          <LogDateSection
            key={date}
            date={date}
            entries={entriesByDate[date] ?? []}
            onSave={handleSave}
            onDelete={handleDelete}
            onPromote={handlePromote}
            onEnterAtEnd={handleEnterAtEnd}
            onNodeOpen={onNodeOpen}
            newEntryId={newEntryId}
            showGhost={date === getToday()}
            onGhostCommit={handleGhostCommit}
          />
        ))}
        {hasMore && (
          <button
            onClick={loadMore}
            style={{ background: 'none', border: '1px solid #222', borderRadius: '6px', color: '#555', cursor: 'pointer', padding: '8px 16px', fontSize: '12px', width: '100%', marginTop: '8px' }}
          >
            Load older entries
          </button>
        )}
      </div>
    </div>
  );
}
