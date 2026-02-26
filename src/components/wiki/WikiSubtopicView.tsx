'use client';

import { useMemo, useState } from 'react';

interface NodeStub {
  id: number;
  title: string;
  description?: string;
  role?: 'derived' | 'source' | 'unknown';
}

interface CitationStub {
  id: number;
  title: string;
  description?: string;
  connection_count_to_subtopic: number;
  last_edge_created_at: string | null;
}

interface Props {
  id: number;
  title: string;
  summary: string | null;
  articleStatus: string;
  nodes: NodeStub[];
  citations: CitationStub[];
  breadcrumb?: string;
  generatedAt?: string | null;
  onNodeClick: (id: number) => void;
  onArticleReady: (article: string, generatedAt: string) => void;
}

export default function WikiSubtopicView({
  id,
  title,
  summary,
  articleStatus,
  nodes,
  citations,
  breadcrumb,
  generatedAt,
  onNodeClick,
  onArticleReady,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const guideNodes = useMemo(() => nodes.filter((node) => node.role === 'derived'), [nodes]);
  const sourceNodes = useMemo(() => nodes.filter((node) => node.role !== 'derived'), [nodes]);

  const generateArticle = async () => {
    setGenerating(true);
    setError('');

    try {
      const res = await fetch(`/api/wiki/${id}/article`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to generate article');
      } else {
        onArticleReady(json.data.article, json.data.article_generated_at);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate article');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ padding: '24px 30px', overflowY: 'auto', height: '100%' }}>
      {breadcrumb ? (
        <div style={{ color: '#7f7f7f', fontSize: 12, marginBottom: 10 }}>{breadcrumb}</div>
      ) : null}
      <h1 style={{ color: '#f2f2f2', fontSize: 22, marginBottom: 4 }}>{title}</h1>
      {generatedAt ? (
        <div style={{ color: '#7f7f7f', fontSize: 12, marginBottom: 18 }}>
          Updated {new Date(generatedAt).toLocaleString()}
        </div>
      ) : null}

      {summary ? (
        <p style={{ color: '#d5d5d5', fontSize: 14, lineHeight: 1.75, maxWidth: 760, marginBottom: 18 }}>{summary}</p>
      ) : null}

      <button
        onClick={generateArticle}
        disabled={generating}
        style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: '1px solid #2b2b2b',
          background: '#111111',
          color: '#d5d5d5',
          cursor: generating ? 'not-allowed' : 'pointer',
          fontSize: 12,
          marginBottom: 14,
        }}
      >
        {generating
          ? 'Generating article...'
          : articleStatus === 'ready'
            ? 'Regenerate article'
            : articleStatus === 'error'
              ? 'Retry article generation'
              : 'Generate full article'}
      </button>

      {error ? (
        <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 14 }}>{error}</div>
      ) : null}

      {guideNodes.length > 0 ? (
        <section style={{ borderTop: '1px solid #222', paddingTop: 14, marginBottom: 14 }}>
          <div style={{ color: '#8a8a8a', fontSize: 12, marginBottom: 8 }}>Guide nodes ({guideNodes.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {guideNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => onNodeClick(node.id)}
                style={{
                  textAlign: 'left',
                  border: '1px solid #2a2a2a',
                  borderRadius: 6,
                  background: 'none',
                  color: '#d7d7d7',
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{node.title}</div>
                {node.description ? <div style={{ color: '#8a8a8a', fontSize: 12 }}>{node.description}</div> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ borderTop: '1px solid #222', paddingTop: 14 }}>
        <div style={{ color: '#8a8a8a', fontSize: 12, marginBottom: 8 }}>Subtopic nodes ({sourceNodes.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sourceNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => onNodeClick(node.id)}
              style={{
                textAlign: 'left',
                border: '1px solid #2a2a2a',
                borderRadius: 6,
                background: 'none',
                color: '#d7d7d7',
                padding: '8px 10px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{node.title}</div>
              {node.description ? <div style={{ color: '#8a8a8a', fontSize: 12 }}>{node.description}</div> : null}
            </button>
          ))}
        </div>
      </section>

      {citations.length > 0 ? (
        <section style={{ borderTop: '1px solid #222', paddingTop: 14, marginTop: 14 }}>
          <div style={{ color: '#8a8a8a', fontSize: 12, marginBottom: 8 }}>Related citations ({citations.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {citations.map((citation) => (
              <button
                key={citation.id}
                onClick={() => onNodeClick(citation.id)}
                style={{
                  textAlign: 'left',
                  border: '1px solid #2a2a2a',
                  borderRadius: 6,
                  background: 'none',
                  color: '#d7d7d7',
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {citation.title}
                  <span style={{ color: '#8a8a8a', fontSize: 11, marginLeft: 8 }}>
                    linked {citation.connection_count_to_subtopic}x
                  </span>
                </div>
                {citation.description ? (
                  <div style={{ color: '#8a8a8a', fontSize: 12 }}>{citation.description}</div>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
