"use client";

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

import type { PendingNode } from '@/components/layout/AppShellProvider';
import { NOTES_SORT_OPTIONS, useNotesFeed } from './useNotesFeed';
import { getMobileNotePreview } from './mobileNotesPresentation';

export default function MobileNotesList({
  refreshToken,
  pendingNodes,
  onDismissPending,
  onOpenNode,
}: {
  refreshToken: number;
  pendingNodes: PendingNode[];
  onDismissPending: (id: string) => void;
  onOpenNode: (nodeId: number) => void;
}) {
  const { sortOrder, setSortOrder, nodes, loading } = useNotesFeed(refreshToken);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSortMenu) return;

    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSortMenu]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 15, padding: '12px 14px 6px', display: 'flex', justifyContent: 'flex-end' }}>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="app-button app-button--ghost"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--app-panel) 70%, transparent)',
              borderColor: 'color-mix(in srgb, var(--app-border) 80%, transparent)',
              backdropFilter: 'blur(14px)',
            }}
            onClick={() => setShowSortMenu((value) => !value)}
            aria-label="Sort notes"
          >
            <MoreHorizontal size={18} />
          </button>

          {showSortMenu && (
            <div
              className="app-panel-elevated"
              style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                minWidth: '180px',
                borderRadius: '18px',
                padding: '8px',
                boxShadow: '0 18px 48px rgba(0, 0, 0, 0.22)',
              }}
            >
              {NOTES_SORT_OPTIONS.map((option) => {
                const active = option.value === sortOrder;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`app-button app-button--ghost${active ? ' is-active' : ''}`}
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      setSortOrder(option.value);
                      setShowSortMenu(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {active ? <span style={{ color: 'var(--toolbar-accent)' }}>✓</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 108px' }}>
        {pendingNodes.length > 0 && (
          <div style={{ padding: '4px 4px 8px' }}>
            {pendingNodes.map((pending) => (
              <div
                key={pending.id}
                className="app-panel-elevated"
                style={{ padding: '12px', borderRadius: '18px', marginBottom: '10px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: pending.status === 'error' ? 'var(--app-danger-text)' : 'var(--toolbar-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {pending.status === 'error' ? 'Capture failed' : 'Capture in progress'}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--app-text-muted)' }}>{pending.input}</div>
                  </div>
                  {pending.status === 'error' && (
                    <button type="button" className="app-button app-button--ghost app-button--compact" onClick={() => onDismissPending(pending.id)}>
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '24px 10px', color: 'var(--app-text-muted)' }}>Loading notes...</div>
        ) : (
          <div style={{ paddingTop: '2px' }}>
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onOpenNode(node.id)}
                className="app-button app-button--ghost"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 16px 15px',
                  marginBottom: '10px',
                  borderRadius: '24px',
                  borderColor: 'color-mix(in srgb, var(--app-border) 72%, transparent)',
                  background: 'color-mix(in srgb, var(--app-panel) 94%, transparent)',
                  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.06)',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--app-text)', lineHeight: 1.3 }}>
                  {node.title || `Untitled #${node.id}`}
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    color: 'var(--app-text-muted)',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {getMobileNotePreview(node)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
