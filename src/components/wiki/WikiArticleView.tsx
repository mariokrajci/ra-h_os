'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  title: string;
  article: string;
  breadcrumb?: string;
  generatedAt?: string | null;
  onBack: () => void;
}

export default function WikiArticleView({ title, article, breadcrumb, generatedAt, onBack }: Props) {
  return (
    <div style={{ padding: '24px 30px', overflowY: 'auto', height: '100%' }}>
      {breadcrumb ? (
        <div style={{ color: 'var(--app-text-subtle)', fontSize: 12, marginBottom: 10 }}>{breadcrumb}</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, color: 'var(--app-text)' }}>{title}</h1>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--app-text-muted)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Back to summary
        </button>
      </div>
      {generatedAt ? (
        <div style={{ color: 'var(--app-text-subtle)', fontSize: 12, marginBottom: 18 }}>
          Generated {new Date(generatedAt).toLocaleString()}
        </div>
      ) : null}
      <div className="guide-content" style={{ color: 'var(--app-text-muted)', fontSize: 14, lineHeight: 1.75, maxWidth: 760 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {article}
        </ReactMarkdown>
      </div>
    </div>
  );
}
