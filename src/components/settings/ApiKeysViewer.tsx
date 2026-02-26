"use client";

import { useState, useEffect, type CSSProperties } from 'react';

type UsageRange = '24h' | '7d' | '30d';

interface UsageKpis {
  range: UsageRange;
  totalCostUsd: number;
  totalTokens: number;
  actionCount: number;
  avgCostPerActionUsd: number;
  byModel: Array<{
    model: string;
    costUsd: number;
    tokens: number;
    actionCount: number;
  }>;
}

export default function ApiKeysViewer() {
  const [status, setStatus] = useState<'checking' | 'configured' | 'not-set'>('checking');
  const [usageRange, setUsageRange] = useState<UsageRange>('24h');
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageKpis | null>(null);

  useEffect(() => {
    // Check via health endpoint (server-side check of process.env)
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setStatus(data.aiFeatures?.startsWith('enabled') ? 'configured' : 'not-set');
      })
      .catch(() => setStatus('not-set'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setUsageLoading(true);
    setUsageError(null);

    fetch(`/api/usage/kpis?range=${usageRange}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load usage');
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setUsage(payload.data ?? null);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setUsageError(error?.message || 'Failed to load usage');
      })
      .finally(() => {
        if (cancelled) return;
        setUsageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usageRange]);

  return (
    <div style={containerStyle}>
      {/* Features explanation */}
      <div style={featuresBoxStyle}>
        <div style={featuresHeaderStyle}>OpenAI API Key enables:</div>
        <ul style={featuresListStyle}>
          <li>Auto-generated descriptions for new nodes</li>
          <li>Smart dimension assignment</li>
          <li>Semantic search via embeddings</li>
        </ul>
        <div style={noteStyle}>
          Without a key, you can still create and organise nodes manually.
        </div>
      </div>

      {/* Status */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <span style={cardTitleStyle}>OpenAI API Key</span>
          <span style={{
            fontSize: 12,
            color: status === 'configured' ? '#22c55e' :
                   status === 'checking' ? '#6b7280' : '#ef4444'
          }}>
            {status === 'configured' ? 'Configured' :
             status === 'checking' ? 'Checking...' : 'Not configured'}
          </span>
        </div>

        <div style={instructionsStyle}>
          <p style={{ margin: 0, marginBottom: 8 }}>
            Add your key to <code style={codeInlineStyle}>.env.local</code> in the project root:
          </p>
          <div style={codeBlockStyle}>
            <code>OPENAI_API_KEY=sk-your-key-here</code>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
            Restart the app after changing the key.
          </p>
        </div>
      </div>

      {/* Get key link */}
      <div style={helpStyle}>
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
          style={linkStyle}
        >
          Get your API key from OpenAI →
        </a>
      </div>

      <div style={usageCardStyle}>
        <div style={usageHeaderStyle}>
          <span style={cardTitleStyle}>Usage KPIs</span>
          <div style={rangeToggleStyle}>
            {(['24h', '7d', '30d'] as UsageRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setUsageRange(range)}
                style={{
                  ...rangeButtonStyle,
                  ...(usageRange === range ? activeRangeButtonStyle : null),
                }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {usageLoading ? (
          <div style={usageMetaStyle}>Loading usage…</div>
        ) : usageError ? (
          <div style={usageErrorStyle}>{usageError}</div>
        ) : usage ? (
          <>
            <div style={kpiGridStyle}>
              <div style={kpiTileStyle}>
                <div style={kpiLabelStyle}>Total Cost</div>
                <div style={kpiValueStyle}>${usage.totalCostUsd.toFixed(4)}</div>
              </div>
              <div style={kpiTileStyle}>
                <div style={kpiLabelStyle}>Total Tokens</div>
                <div style={kpiValueStyle}>{usage.totalTokens.toLocaleString()}</div>
              </div>
              <div style={kpiTileStyle}>
                <div style={kpiLabelStyle}>AI Actions</div>
                <div style={kpiValueStyle}>{usage.actionCount.toLocaleString()}</div>
              </div>
              <div style={kpiTileStyle}>
                <div style={kpiLabelStyle}>Avg Cost / Action</div>
                <div style={kpiValueStyle}>${usage.avgCostPerActionUsd.toFixed(5)}</div>
              </div>
            </div>

            {usage.byModel.length > 0 ? (
              <div style={modelTableWrapStyle}>
                <div style={kpiLabelStyle}>By Model</div>
                <table style={modelTableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>Cost</th>
                      <th style={thStyle}>Tokens</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.byModel.map((row) => (
                      <tr key={row.model}>
                        <td style={tdStyle}>{row.model}</td>
                        <td style={tdStyle}>${row.costUsd.toFixed(4)}</td>
                        <td style={tdStyle}>{row.tokens.toLocaleString()}</td>
                        <td style={tdStyle}>{row.actionCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={usageMetaStyle}>No usage data for this range yet.</div>
            )}
          </>
        ) : (
          <div style={usageMetaStyle}>No usage data available.</div>
        )}
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  padding: 24,
  height: '100%',
  overflow: 'auto',
};

const featuresBoxStyle: CSSProperties = {
  background: 'rgba(34, 197, 94, 0.08)',
  border: '1px solid rgba(34, 197, 94, 0.2)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 20,
};

const featuresHeaderStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#22c55e',
  marginBottom: 8,
};

const featuresListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  fontSize: 13,
  color: '#d1d5db',
  lineHeight: 1.6,
};

const noteStyle: CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  color: '#6b7280',
  fontStyle: 'italic',
};

const cardStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
};

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#e5e7eb',
};

const instructionsStyle: CSSProperties = {
  fontSize: 13,
  color: '#d1d5db',
  lineHeight: 1.5,
};

const codeInlineStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.08)',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'monospace',
  color: '#22c55e',
};

const codeBlockStyle: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.4)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: 'monospace',
  color: '#e5e7eb',
  marginBottom: 8,
};

const helpStyle: CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  marginBottom: 16,
};

const linkStyle: CSSProperties = {
  color: '#22c55e',
  textDecoration: 'none',
};

const usageCardStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 8,
  padding: 16,
};

const usageHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
};

const rangeToggleStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
};

const rangeButtonStyle: CSSProperties = {
  border: '1px solid #2a2a2a',
  background: '#101010',
  color: '#aaa',
  borderRadius: 6,
  fontSize: 12,
  padding: '4px 8px',
  cursor: 'pointer',
};

const activeRangeButtonStyle: CSSProperties = {
  background: '#16331f',
  color: '#22c55e',
  border: '1px solid #1f4f2d',
};

const kpiGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
  marginBottom: 12,
};

const kpiTileStyle: CSSProperties = {
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 8,
  padding: '10px 12px',
  background: 'rgba(0, 0, 0, 0.25)',
};

const kpiLabelStyle: CSSProperties = {
  fontSize: 11,
  color: '#8d8d8d',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
};

const kpiValueStyle: CSSProperties = {
  fontSize: 16,
  color: '#e5e7eb',
  fontWeight: 600,
};

const usageMetaStyle: CSSProperties = {
  fontSize: 12,
  color: '#8a8a8a',
};

const usageErrorStyle: CSSProperties = {
  fontSize: 12,
  color: '#ef4444',
};

const modelTableWrapStyle: CSSProperties = {
  marginTop: 12,
};

const modelTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  marginTop: 6,
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontWeight: 500,
  color: '#8a8a8a',
  borderBottom: '1px solid #2a2a2a',
  padding: '6px 4px',
};

const tdStyle: CSSProperties = {
  color: '#d4d4d4',
  borderBottom: '1px solid #1f1f1f',
  padding: '6px 4px',
};
