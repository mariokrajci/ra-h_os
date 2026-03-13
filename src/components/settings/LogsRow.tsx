"use client";

import { useState } from 'react';
import { AuditLogEntry } from '@/types/logs';

interface LogsRowProps {
  log: AuditLogEntry;
  isEven: boolean;
}

export default function LogsRow({ log, isEven }: LogsRowProps) {
  const [expanded, setExpanded] = useState(false);

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toISOString().replace('T', ' ').substring(0, 19);
  };

  const formatJson = (jsonStr: string | null) => {
    if (!jsonStr) return 'null';
    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonStr;
    }
  };

  const highlightJson = (jsonStr: string) => {
    return jsonStr
      .replace(/"([^"]+)":/g, '<span style="color: var(--app-info-text)">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span style="color: var(--toolbar-accent)">"$1"</span>')
      .replace(/: (\d+)/g, ': <span style="color: #d97706">$1</span>')
      .replace(/: (true|false|null)/g, ': <span style="color: #7c3aed">$1</span>');
  };

  const getMetricsFromSnapshot = () => {
    if (!log.snapshot_json || log.table_name !== 'chats') return null;
    try {
      const snapshot = JSON.parse(log.snapshot_json);
      return {
        thread: snapshot.thread,
        trace_id: snapshot.trace_id,
        input_tokens: snapshot.input_tokens,
        output_tokens: snapshot.output_tokens,
        cost_usd: snapshot.cost_usd,
        cache_hit: snapshot.cache_hit,
        model: snapshot.model,
        system_message: snapshot.system_message
      };
    } catch {
      return null;
    }
  };

  const metrics = getMetricsFromSnapshot();

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{
          background: isEven ? 'var(--app-panel)' : 'var(--app-table-stripe)',
          cursor: 'pointer',
          borderBottom: '1px solid var(--app-hairline)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--app-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isEven ? 'var(--app-panel)' : 'var(--app-table-stripe)';
        }}
      >
        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', width: '60px' }}>
          {log.id}
        </td>
        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', width: '180px' }}>
          {formatTimestamp(log.ts)}
        </td>
        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', width: '100px' }}>
          {log.table_name}
        </td>
        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', width: '80px' }}>
          {log.action}
        </td>
        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
          <div>{log.summary || '-'}</div>
          {metrics && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--app-text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {metrics.trace_id && (
                <span title={`Trace: ${metrics.trace_id}`}>
                  🔗 {metrics.trace_id.substring(0, 8)}
                </span>
              )}
              {metrics.thread && (
                <span title={`Thread: ${metrics.thread}`}>
                  🧵 {metrics.thread.substring(0, 16)}…
                </span>
              )}
              {metrics.input_tokens !== undefined && metrics.output_tokens !== undefined && (
                <span>
                  📊 {metrics.input_tokens}↓ {metrics.output_tokens}↑
                </span>
              )}
              {metrics.cache_hit !== undefined && metrics.cache_hit === 1 && (
                <span style={{ color: 'var(--app-info-text)' }}>
                  ⚡ Cache Hit
                </span>
              )}
            </div>
          )}
        </td>
        <td style={{ padding: '12px 16px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', width: '80px' }}>
          {log.row_id}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: 'var(--app-surface-strong)', borderTop: '1px solid var(--app-border)', borderBottom: '1px solid var(--app-border)' }}>
          <td colSpan={6} style={{ padding: '16px 24px' }}>
            {metrics?.system_message && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  System Message
                </div>
                <pre
                  style={{
                    fontSize: '10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    color: 'var(--app-info-text)',
                    background: 'var(--app-input)',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid var(--app-border)',
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}
                >
                  {metrics.system_message}
                </pre>
              </div>
            )}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Snapshot JSON
              </div>
              <pre
                style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0
                }}
                dangerouslySetInnerHTML={{ __html: highlightJson(formatJson(log.snapshot_json)) }}
              />
            </div>
            {log.enriched_summary && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Enriched Summary
              </div>
                <div style={{ fontSize: '12px', color: 'var(--app-text)', lineHeight: '1.6' }}>
                  {log.enriched_summary}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
