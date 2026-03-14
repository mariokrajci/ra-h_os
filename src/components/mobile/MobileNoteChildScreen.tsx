"use client";

import { ChevronLeft } from 'lucide-react';
import type { Node, NodeConnection } from '@/types/database';

type ChildScreen = 'source' | 'metadata' | 'connections';

export default function MobileNoteChildScreen({
  child,
  node,
  connections,
  onBack,
  onOpenNode,
  animation,
}: {
  child: ChildScreen;
  node: Node | null;
  connections: NodeConnection[];
  onBack: () => void;
  onOpenNode: (nodeId: number) => void;
  animation: string | undefined;
}) {
  const title = child === 'source' ? 'Source' : child === 'metadata' ? 'Metadata' : 'Connections';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Consistent header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid var(--app-border)',
        padding: '14px 16px',
        minHeight: '52px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          type="button"
          className="app-button app-button--ghost app-button--compact"
          style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 6px 4px' }}
          onClick={onBack}
        >
          <ChevronLeft size={18} />
          {node?.title ? node.title.slice(0, 24) + (node.title.length > 24 ? '…' : '') : 'Note'}
        </button>

        <div style={{
          fontSize: '15px',
          fontWeight: 600,
          flex: 1,
          textAlign: 'center',
          fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
        }}>
          {title}
        </div>

        {/* Spacer to balance the back button */}
        <div style={{ width: '72px' }} />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 100px' }}>

        {child === 'source' && (
          <div>
            <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
              Source excerpt
            </div>
            <div style={{ fontSize: '15px', color: 'var(--app-text)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {node?.chunk?.trim() || 'No source content attached to this note.'}
            </div>
          </div>
        )}

        {child === 'metadata' && (
          <div style={{ display: 'grid', gap: '0' }}>
            <div style={{ borderTop: '0.5px solid var(--app-border)' }}>
              {[
                { label: 'Updated', value: node ? new Date(node.updated_at).toLocaleString() : '—' },
                { label: 'Created', value: node ? new Date(node.created_at).toLocaleString() : '—' },
                { label: 'Link', value: node?.link || 'None' },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{ padding: '14px 0', borderBottom: '0.5px solid var(--app-border)', display: 'flex', justifyContent: 'space-between', gap: '16px' }}
                >
                  <span style={{ fontSize: '14px', color: 'var(--app-text-subtle)', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: '14px', color: 'var(--app-text-muted)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '28px' }}>
              <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Dimensions
              </div>
              {node?.dimensions?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {node.dimensions.map((dim) => (
                    <span
                      key={dim}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        background: 'var(--app-panel)',
                        border: '0.5px solid var(--app-border)',
                        color: 'var(--app-text-muted)',
                      }}
                    >
                      {dim}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '14px', color: 'var(--app-text-muted)' }}>No tags assigned.</div>
              )}
            </div>
          </div>
        )}

        {child === 'connections' && (
          <div>
            <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              {connections.length} related {connections.length === 1 ? 'note' : 'notes'}
            </div>
            {connections.length === 0 ? (
              <div style={{ padding: '16px 0', fontSize: '14px', color: 'var(--app-text-muted)' }}>No related notes yet.</div>
            ) : (
              <div style={{ borderTop: '0.5px solid var(--app-border)', marginTop: '12px' }}>
                {connections.map((connection) => (
                  <button
                    key={connection.edge.id}
                    type="button"
                    onClick={() => onOpenNode(connection.connected_node.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 0',
                      borderBottom: '0.5px solid var(--app-border)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--app-text)' }}>
                        {connection.connected_node.title}
                      </div>
                      <div style={{ marginTop: '3px', fontSize: '12px', color: 'var(--app-text-muted)' }}>
                        {typeof connection.edge.context?.type === 'string'
                          ? connection.edge.context.type.replaceAll('_', ' ')
                          : 'related note'}
                      </div>
                    </div>
                    <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.4, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
