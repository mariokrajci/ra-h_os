"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

interface McpStatus {
  enabled: boolean;
  url: string | null;
  port: number | null;
  last_updated?: string | null;
  target_base_url?: string | null;
  last_error?: string | null;
  error?: string | null;
}

const initialStatus: McpStatus = {
  enabled: false,
  url: null,
  port: null
};

export default function ExternalAgentsPanel() {
  const [status, setStatus] = useState<McpStatus>(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/system/mcp-status');
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load MCP status', err);
        setError('MCP server not running. See docs/8_mcp.md for setup instructions.');
        setStatus(initialStatus);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, []);

  const connectorUrl = useMemo(() => {
    if (status?.url) return status.url;
    if (status?.port) return `http://127.0.0.1:${status.port}/mcp`;
    return null;
  }, [status]);

  const handleCopy = useCallback(async () => {
    if (!connectorUrl) return;
    try {
      await navigator.clipboard.writeText(connectorUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  }, [connectorUrl]);

  return (
    <div style={{ padding: '32px', color: 'var(--app-text)', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--app-text)' }}>External Agents</h2>
      <p style={{ color: 'var(--app-text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
        Connect Claude, ChatGPT, Gemini, or any MCP-compatible assistant to your local RA-H database.
        Everything stays on device—tools simply call this connector to add or search nodes.
      </p>

      <div
        style={{
          border: '1px solid var(--app-border)',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '24px',
          background: 'var(--app-panel-elevated)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', color: 'var(--app-text-muted)' }}>Connector URL</div>
            <div style={{ fontSize: '18px', color: connectorUrl ? 'var(--app-text)' : 'var(--app-text-subtle)', marginTop: '4px' }}>
              {loading ? 'Loading…' : connectorUrl ?? 'Unavailable (MCP server not running)'}
            </div>
            {status.last_updated && (
              <div style={{ fontSize: '12px', color: 'var(--app-text-subtle)', marginTop: '6px' }}>
                Updated {new Date(status.last_updated).toLocaleTimeString()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!connectorUrl}
            style={{
              background: connectorUrl ? 'var(--toolbar-accent)' : 'var(--app-surface-subtle)',
              color: connectorUrl ? 'var(--app-accent-contrast)' : 'var(--app-text-subtle)',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 16px',
              cursor: connectorUrl ? 'pointer' : 'not-allowed',
              fontWeight: 600
            }}
          >
            {copyState === 'copied' ? 'Copied ✓' : 'Copy URL'}
          </button>
        </div>
        {status.last_error && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--app-danger-text)' }}>
            ⚠️ {status.last_error}
          </div>
        )}
      </div>

      <div
        style={{
          border: '1px solid var(--app-info-border)',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '24px',
          background: 'var(--app-info-bg)'
        }}
      >
        <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600, color: 'var(--app-text)' }}>How to use in Claude or ChatGPT</h3>
        <ol style={{ paddingLeft: '20px', lineHeight: 1.6, color: 'var(--app-text)' }}>
          <li>Open the MCP / connectors settings in your assistant.</li>
          <li>Select “Add connector” → choose HTTP → paste the URL above.</li>
          <li>Give the connector a friendly name (e.g., “RA-H”).</li>
          <li>Ask naturally: “Add this summary to RA-H” or “Search RA-H for my Apollo notes”.</li>
        </ol>
      </div>

      <div
        style={{
          border: '1px solid var(--app-danger-border)',
          borderRadius: '10px',
          padding: '16px',
          background: 'var(--app-danger-bg)',
          color: 'var(--app-danger-text)',
          marginBottom: '24px',
          lineHeight: 1.5
        }}
      >
        External agents can edit your local graph. Only enable trusted connectors and monitor their output.
        Disconnect the connector or close RA-H if anything unexpected happens.
      </div>

      {error && (
        <div style={{ color: 'var(--app-danger-text)', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gap: '16px' }}>
        <HelperCard
          title="Add to RA-H"
          body={`"Summarize our meeting and add it to RA-H under dimensions Strategy, Q1 Execution."`}
        />
        <HelperCard
          title="Search RA-H"
          body={`"Search RA-H for what I previously wrote about the Apollo launch delays."`}
        />
        <HelperCard
          title="Check nodes before writing"
          body={`"Before adding anything new, call rah.search_nodes to see if the note already exists."`}
        />
      </div>
    </div>
  );
}

function HelperCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--app-border)',
        borderRadius: '8px',
        padding: '14px',
        background: 'var(--app-panel-elevated)'
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--app-text)' }}>{title}</div>
      <div style={{ color: 'var(--app-text-muted)', fontSize: '14px', lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
