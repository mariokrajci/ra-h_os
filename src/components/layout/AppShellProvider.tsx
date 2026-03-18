"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { DatabaseEvent } from '@/services/events';
import { createInitialShellRefreshState, reduceShellEvent, type ShellRefreshState } from './shellEvents';
import type { ReaderFormatValue } from '@/lib/readerFormat';

export interface PendingNode {
  id: string;
  input: string;
  inputType: string;
  submittedAt: number;
  status: 'processing' | 'error';
  error?: string;
}

interface QuickAddBookSelection {
  title: string;
  author?: string;
  isbn?: string;
  cover_url?: string;
  publisher?: string;
  first_published_year?: number;
  page_count?: number;
}

interface QuickAddPayload {
  input: string;
  mode: 'link' | 'note' | 'chat';
  description?: string;
  readerFormat?: ReaderFormatValue;
  bookSelection?: QuickAddBookSelection;
}

interface AppShellContextValue {
  refreshState: ShellRefreshState;
  pendingNodes: PendingNode[];
  setOpenTabs: (nodeIds: number[]) => void;
  refreshAll: () => void;
  submitQuickAdd: (payload: QuickAddPayload) => Promise<void>;
  dismissPendingNode: (id: string) => void;
  openLogEntry: boolean;
  consumeOpenLogEntry: () => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [refreshState, setRefreshState] = useState<ShellRefreshState>(createInitialShellRefreshState);
  const [pendingNodes, setPendingNodes] = useState<PendingNode[]>([]);
  const openTabsRef = useRef<number[]>([]);

  const setOpenTabs = useCallback((nodeIds: number[]) => {
    openTabsRef.current = nodeIds;
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshState((prev) => ({
      ...prev,
      nodes: prev.nodes + 1,
      focus: prev.focus + 1,
      folder: prev.folder + 1,
    }));
  }, []);

  const dismissPendingNode = useCallback((id: string) => {
    setPendingNodes((prev) => prev.filter((node) => node.id !== id));
  }, []);

  const consumeOpenLogEntry = useCallback(() => {
    setRefreshState((prev) => ({ ...prev, openLogEntry: false }));
  }, []);

  const submitQuickAdd = useCallback(async ({
    input,
    mode,
    description,
    readerFormat,
    bookSelection,
  }: QuickAddPayload) => {
    const response = await fetch('/api/quick-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, mode, description, readerFormat, bookSelection }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Failed to submit Quick Add' }));
      throw new Error(data.error || 'Failed to submit Quick Add');
    }

    const result = await response.json();
    const delegation = result.delegation;
    if (delegation?.id && delegation?.inputType) {
      setPendingNodes((prev) => [{
        id: String(delegation.id),
        input: input.slice(0, 120),
        inputType: delegation.inputType,
        submittedAt: Date.now(),
        status: 'processing',
      }, ...prev]);
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/events');

      eventSource.onmessage = (event) => {
        try {
          const data: DatabaseEvent = JSON.parse(event.data);

          setRefreshState((prev) => reduceShellEvent(prev, data, openTabsRef.current));

          if (data.type === 'QUICK_ADD_COMPLETED' && data.data?.quickAddId) {
            setPendingNodes((prev) => prev.filter((node) => node.id !== String(data.data.quickAddId)));
          }

          if (data.type === 'QUICK_ADD_FAILED' && data.data?.quickAddId) {
            setPendingNodes((prev) =>
              prev.map((node) =>
                node.id === String(data.data.quickAddId)
                  ? { ...node, status: 'error', error: data.data.error || 'Unknown error' }
                  : node,
              ),
            );
          }

          if (data.type === 'HELPER_UPDATED' || data.type === 'AGENT_UPDATED') {
            window.dispatchEvent(new CustomEvent('agents:updated', { detail: data.data }));
          }

          if (data.type === 'GUIDE_UPDATED') {
            window.dispatchEvent(new CustomEvent('guides:updated', { detail: data.data }));
            window.dispatchEvent(new CustomEvent('skills:updated', { detail: data.data }));
          }
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
      };
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
    }

    return () => {
      eventSource?.close();
    };
  }, []);

  useEffect(() => {
    if (pendingNodes.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setPendingNodes((prev) => prev.filter((node) => {
        const age = now - node.submittedAt;
        if (node.status === 'processing' && age > 90_000) return false;
        if (node.status === 'error' && age > 120_000) return false;
        return true;
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingNodes.length]);

  useEffect(() => {
    const handler = () => {
      setRefreshState((prev) => reduceShellEvent(prev, {
        type: 'GUIDE_UPDATED',
        data: {},
        timestamp: Date.now(),
      }, openTabsRef.current, { openLogEntry: true }));
    };

    window.addEventListener('open-log-entry', handler);
    return () => window.removeEventListener('open-log-entry', handler);
  }, []);

  const value = useMemo<AppShellContextValue>(() => ({
    refreshState,
    pendingNodes,
    setOpenTabs,
    refreshAll,
    submitQuickAdd,
    dismissPendingNode,
    openLogEntry: refreshState.openLogEntry,
    consumeOpenLogEntry,
  }), [consumeOpenLogEntry, dismissPendingNode, pendingNodes, refreshAll, refreshState, setOpenTabs, submitQuickAdd]);

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within AppShellProvider');
  }
  return context;
}
