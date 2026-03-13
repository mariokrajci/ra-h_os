"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuditLogEntry, LogsResponse } from '@/types/logs';
import LogsRow from './LogsRow';

type AppliedFilters = {
  threadId?: string;
  traceId?: string;
  table?: string;
};

export default function LogsViewer() {
  const LIMIT = 100;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inputThreadId, setInputThreadId] = useState('');
  const [inputTraceId, setInputTraceId] = useState('');
  const [inputTable, setInputTable] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({});

  const filtersActive = useMemo(
    () => Boolean(appliedFilters.threadId || appliedFilters.traceId || appliedFilters.table),
    [appliedFilters]
  );

  const fetchLogs = useCallback(
    async (pageNum: number, filters: AppliedFilters) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('page', pageNum.toString());
        params.set('limit', LIMIT.toString());
        if (filters.threadId) params.set('threadId', filters.threadId);
        if (filters.traceId) params.set('traceId', filters.traceId);
        if (filters.table) params.set('table', filters.table);

        const response = await fetch(`/api/logs?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch logs');
        }
        const data: LogsResponse = await response.json();
        setLogs(data.logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [LIMIT]
  );

  useEffect(() => {
    fetchLogs(page, appliedFilters);
  }, [page, appliedFilters, fetchLogs]);

  const handleApplyFilters = () => {
    const nextFilters: AppliedFilters = {
      threadId: inputThreadId.trim() || undefined,
      traceId: inputTraceId.trim() || undefined,
      table: inputTable.trim() || undefined,
    };
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const handleClearFilters = () => {
    setInputThreadId('');
    setInputTraceId('');
    setInputTable('');
    setAppliedFilters({});
    setPage(1);
  };

  const handlePrevious = () => {
    setPage(prev => (prev > 1 ? prev - 1 : prev));
  };

  const handleNext = () => {
    if (logs.length === LIMIT) {
      setPage(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--app-text-muted)' }}>
        Loading logs...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--app-danger-text)' }}>
        Error: {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--app-text-muted)' }}>
        No logs found
      </div>
    );
  }

  const isFirstPage = page === 1;
  const isLastPage = logs.length < LIMIT;
  const filterStatus = appliedFilters.threadId
    ? `Thread: ${appliedFilters.threadId}`
    : appliedFilters.traceId
    ? `Trace: ${appliedFilters.traceId}`
    : appliedFilters.table
    ? `Table: ${appliedFilters.table}`
    : `Page ${page}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--app-hairline)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--app-text-subtle)', gap: '4px' }}>
            Thread ID
            <input
              className="app-input"
              value={inputThreadId}
              onChange={(e) => setInputThreadId(e.target.value)}
              placeholder="ra-h-node-..."
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                minWidth: '200px',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--app-text-subtle)', gap: '4px' }}>
            Trace ID
            <input
              className="app-input"
              value={inputTraceId}
              onChange={(e) => setInputTraceId(e.target.value)}
              placeholder="uuid"
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                minWidth: '160px',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', color: 'var(--app-text-subtle)', gap: '4px' }}>
            Table
            <input
              className="app-input"
              value={inputTable}
              onChange={(e) => setInputTable(e.target.value)}
              placeholder="nodes | edges"
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                minWidth: '120px',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button
              onClick={handleApplyFilters}
              className="app-button app-button--accent"
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="app-button app-button--secondary"
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--app-text-subtle)' }}>{filterStatus}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrevious}
              disabled={isFirstPage || filtersActive}
              className="app-button app-button--secondary"
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                color: isFirstPage || filtersActive ? 'var(--app-text-subtle)' : 'var(--app-text-muted)',
                cursor: isFirstPage || filtersActive ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: isFirstPage || filtersActive ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={isLastPage || filtersActive}
              className="app-button app-button--secondary"
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                color: isLastPage || filtersActive ? 'var(--app-text-subtle)' : 'var(--app-text-muted)',
                cursor: isLastPage || filtersActive ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: isLastPage || filtersActive ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--app-surface-strong)', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, borderBottom: '1px solid var(--app-hairline)', width: '60px' }}>
                ID
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, borderBottom: '1px solid var(--app-hairline)', width: '160px' }}>
                Timestamp
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, borderBottom: '1px solid var(--app-hairline)', width: '80px' }}>
                Table
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, borderBottom: '1px solid var(--app-hairline)', width: '70px' }}>
                Action
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, borderBottom: '1px solid var(--app-hairline)' }}>
                Summary
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, borderBottom: '1px solid var(--app-hairline)', width: '70px' }}>
                Row
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <LogsRow key={log.id} log={log} isEven={index % 2 === 0} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
