"use client";

import type { Node, NodeConnection } from '@/types/database';

type ChildScreen = 'source' | 'metadata' | 'connections';

function ChildCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-panel" style={{ borderRadius: '18px', padding: '16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ marginTop: '12px' }}>{children}</div>
    </div>
  );
}

export default function MobileNoteChildScreen({
  child,
  node,
  connections,
  onBack,
}: {
  child: ChildScreen;
  node: Node | null;
  connections: NodeConnection[];
  onBack: () => void;
}) {
  const title = child === 'source' ? 'Source' : child === 'metadata' ? 'Metadata' : 'Connections';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)', paddingBottom: '92px' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'color-mix(in srgb, var(--app-bg) 92%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--app-border)', padding: '14px 16px' }}>
        <button type="button" className="app-button app-button--ghost app-button--compact" onClick={onBack}>Back</button>
        <div style={{ marginTop: '12px', fontSize: '26px', fontWeight: 650 }}>{title}</div>
        <div style={{ marginTop: '4px', color: 'var(--app-text-muted)', fontSize: '13px' }}>{node?.title || 'Note detail'}</div>
      </div>

      <div style={{ padding: '18px 16px 0', display: 'grid', gap: '14px' }}>
        {child === 'source' && (
          <ChildCard title="Source excerpt">
            <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {node?.chunk?.trim() || 'No source content attached to this note.'}
            </div>
          </ChildCard>
        )}

        {child === 'metadata' && (
          <>
            <ChildCard title="Basics">
              <div style={{ display: 'grid', gap: '10px', fontSize: '14px' }}>
                <div><strong style={{ color: 'var(--app-text)' }}>Updated:</strong> <span style={{ color: 'var(--app-text-muted)' }}>{node ? new Date(node.updated_at).toLocaleString() : '—'}</span></div>
                <div><strong style={{ color: 'var(--app-text)' }}>Created:</strong> <span style={{ color: 'var(--app-text-muted)' }}>{node ? new Date(node.created_at).toLocaleString() : '—'}</span></div>
                <div><strong style={{ color: 'var(--app-text)' }}>Link:</strong> <span style={{ color: 'var(--app-text-muted)' }}>{node?.link || 'None'}</span></div>
              </div>
            </ChildCard>
            <ChildCard title="Dimensions">
              <div style={{ fontSize: '14px', color: 'var(--app-text-muted)' }}>
                {node?.dimensions?.length ? node.dimensions.join(', ') : 'No tags assigned.'}
              </div>
            </ChildCard>
          </>
        )}

        {child === 'connections' && (
          <ChildCard title="Related notes">
            {connections.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--app-text-muted)' }}>No related notes yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {connections.map((connection) => (
                  <div key={connection.edge.id} className="app-panel-elevated" style={{ borderRadius: '14px', padding: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{connection.connected_node.title}</div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--app-text-muted)' }}>
                      {typeof connection.edge.context?.type === 'string'
                        ? connection.edge.context.type.replaceAll('_', ' ')
                        : 'related note'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChildCard>
        )}
      </div>
    </div>
  );
}
