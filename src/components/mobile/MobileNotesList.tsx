"use client";

import { Fragment, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import type { PendingNode } from '@/components/layout/AppShellProvider';
import { NOTES_SORT_OPTIONS, useNotesFeed } from './useNotesFeed';
import { getMobileNotePreview } from './mobileNotesPresentation';
import { formatRelativeTime } from './formatRelativeTime';
import type { NavDirection } from './MobileShell';

export default function MobileNotesList({
  navDirection,
  refreshToken,
  pendingNodes,
  onDismissPending,
  onOpenNode,
  onOpenAdd,
}: {
  navDirection: NavDirection;
  refreshToken: number;
  pendingNodes: PendingNode[];
  onDismissPending: (id: string) => void;
  onOpenNode: (nodeId: number) => void;
  onOpenAdd: () => void;
}) {
  const { sortOrder, setSortOrder, nodes, loading, sortLabel } = useNotesFeed(refreshToken);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const animation =
    navDirection === 'forward' ? 'slideInFromRight 280ms ease-out'
    : navDirection === 'backward' ? 'slideInFromLeft 280ms ease-out'
    : undefined;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    setShowHeaderTitle(e.currentTarget.scrollTop > 56);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Sticky nav header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 15,
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: showHeaderTitle ? '0.5px solid var(--app-border)' : '0.5px solid transparent',
        transition: 'border-color 0.15s',
        padding: '14px 16px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '52px',
      }}>
        <span style={{
          fontSize: '17px',
          fontWeight: 600,
          opacity: showHeaderTitle ? 1 : 0,
          transition: 'opacity 0.18s ease',
          fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
        }}>
          Notes
        </span>

        {/* Sort control */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="app-button app-button--ghost"
            style={{
              padding: '6px 10px 6px 12px',
              borderRadius: '999px',
              fontSize: '13px',
              color: 'var(--app-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '32px',
            }}
            onClick={() => setShowSortMenu((v) => !v)}
          >
            {sortLabel}
            <ChevronDown size={13} />
          </button>

          {showSortMenu && (
            <div
              className="app-panel-elevated"
              style={{
                position: 'absolute',
                top: '38px',
                right: 0,
                minWidth: '180px',
                borderRadius: '16px',
                padding: '6px',
                boxShadow: '0 18px 48px rgba(0, 0, 0, 0.22)',
                zIndex: 30,
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
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '14px',
                    }}
                    onClick={() => {
                      setSortOrder(option.value);
                      setShowSortMenu(false);
                    }}
                  >
                    <span>{option.label}</span>
                    {active && <span style={{ color: 'var(--toolbar-accent)', fontSize: '16px' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}
      >
        {/* Large collapsing title */}
        <div style={{ padding: '4px 16px 16px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            lineHeight: 1.1,
            fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
            letterSpacing: '-0.5px',
          }}>
            Notes
          </h1>
        </div>

        {/* Pending nodes */}
        {pendingNodes.length > 0 && (
          <div style={{ padding: '0 16px 12px' }}>
            {pendingNodes.map((pending) => (
              <div
                key={pending.id}
                className="app-panel-elevated"
                style={{ padding: '12px 14px', borderRadius: '14px', marginBottom: '8px' }}
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

        {/* List */}
        {loading ? (
          <div style={{ padding: '24px 16px', color: 'var(--app-text-muted)', fontSize: '15px' }}>Loading…</div>
        ) : nodes.length === 0 ? (
          // Empty state
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', opacity: 0.25 }}>📝</div>
            <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--app-text)' }}>No notes yet</div>
            <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', lineHeight: 1.5 }}>
              Capture your first note, link, or source material.
            </div>
            <button
              type="button"
              className="app-button"
              style={{
                marginTop: '8px',
                padding: '12px 24px',
                borderRadius: '999px',
                background: 'var(--toolbar-accent)',
                color: '#fff',
                border: 'none',
                fontSize: '15px',
                fontWeight: 600,
              }}
              onClick={onOpenAdd}
            >
              Capture your first note
            </button>
          </div>
        ) : (
          <div>
            {nodes.map((node, index) => (
              <Fragment key={node.id}>
                <button
                  type="button"
                  onClick={() => onOpenNode(node.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    minHeight: '64px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '3px',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 650,
                      color: 'var(--app-text)',
                      lineHeight: 1.25,
                      fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {node.title || `Untitled #${node.id}`}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--app-text-subtle)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {formatRelativeTime(node.updated_at)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--app-text-muted)',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {getMobileNotePreview(node)}
                  </div>
                </button>
                {index < nodes.length - 1 && (
                  <div style={{ height: '0.5px', background: 'var(--app-border)', margin: '0 16px' }} />
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
