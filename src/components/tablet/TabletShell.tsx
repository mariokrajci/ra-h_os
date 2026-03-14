"use client";

import { Plus, Search } from 'lucide-react';
import { useReducer, useState } from 'react';

import { useAppShell } from '@/components/layout/AppShellProvider';
import type { MobileRoute } from '@/components/mobile/mobileRoutes';
import { reduceMobileRoute } from '@/components/mobile/mobileRoutes';
import MobileNoteDetail from '@/components/mobile/MobileNoteDetail';
import MobileSearchScreen from '@/components/mobile/MobileSearchScreen';
import MobileCaptureScreen from '@/components/mobile/MobileCaptureScreen';
import MobileNoteChildScreen from '@/components/mobile/MobileNoteChildScreen';
import { useMobileNodeDetail } from '@/components/mobile/useMobileNodeDetail';
import { NOTES_SORT_OPTIONS, useNotesFeed } from '@/components/mobile/useNotesFeed';

export default function TabletShell() {
  const {
    refreshState,
    pendingNodes,
    dismissPendingNode,
    submitQuickAdd,
  } = useAppShell();
  const { sortOrder, setSortOrder, nodes, loading, sortLabel } = useNotesFeed(refreshState.nodes, 'ui.tablet.notes.sort');
  const [route, dispatch] = useReducer(
    reduceMobileRoute,
    { screen: 'notes' } as MobileRoute,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const childDetail = useMobileNodeDetail(route.screen === 'child' ? route.nodeId : -1, refreshState.focus);

  function openNode(nodeId: number) {
    setSelectedNodeId(nodeId);
    dispatch({ type: 'open-note', nodeId });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', height: '100vh', background: 'var(--app-bg)', color: 'var(--app-text)' }}>
      <aside style={{ borderRight: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '20px 18px 12px', borderBottom: '1px solid var(--app-border)' }}>
          <div style={{ fontSize: '26px', fontWeight: 650 }}>Notes</div>
          <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--app-text-muted)' }}>Sorted by {sortLabel.toLowerCase()}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button type="button" className="app-button app-button--secondary" style={{ flex: 1, padding: '10px 12px' }} onClick={() => dispatch({ type: 'open-search' })}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Search size={16} /> Search</span>
            </button>
            <button type="button" className="app-button app-button--accent" style={{ flex: 1, padding: '10px 12px' }} onClick={() => dispatch({ type: 'open-add' })}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Plus size={16} /> Add</span>
            </button>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {NOTES_SORT_OPTIONS.map((option) => {
              const active = option.value === sortOrder;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`app-button app-button--compact${active ? ' app-button--accent' : ''}`}
                  onClick={() => setSortOrder(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {pendingNodes.map((pending) => (
            <div key={pending.id} className="app-panel-elevated" style={{ borderRadius: '14px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: pending.status === 'error' ? 'var(--app-danger-text)' : 'var(--toolbar-accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {pending.status === 'error' ? 'Capture failed' : 'Capture in progress'}
              </div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--app-text-muted)' }}>{pending.input}</div>
              {pending.status === 'error' ? (
                <button type="button" className="app-button app-button--ghost app-button--compact" style={{ marginTop: '10px' }} onClick={() => dismissPendingNode(pending.id)}>
                  Dismiss
                </button>
              ) : null}
            </div>
          ))}

          {loading ? (
            <div style={{ padding: '12px 4px', color: 'var(--app-text-muted)' }}>Loading notes...</div>
          ) : (
            nodes.map((node) => {
              const active = selectedNodeId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  className="app-button app-button--ghost"
                  onClick={() => openNode(node.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 12px',
                    marginBottom: '8px',
                    borderRadius: '14px',
                    borderColor: active ? 'var(--app-accent-border)' : 'var(--app-border)',
                    background: active ? 'var(--app-selected)' : 'var(--app-panel)',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{node.title || `Untitled #${node.id}`}</div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--app-text-muted)' }}>
                    {node.description || node.notes?.slice(0, 120) || 'No preview yet.'}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main style={{ minWidth: 0, overflow: 'auto' }}>
        {route.screen === 'search' && (
          <MobileSearchScreen onBack={() => dispatch({ type: 'back' })} onOpenNode={openNode} />
        )}
        {route.screen === 'add' && (
          <MobileCaptureScreen
            onBack={() => dispatch({ type: 'back' })}
            onSubmit={async (payload) => {
              await submitQuickAdd(payload);
              dispatch({ type: 'back' });
            }}
          />
        )}
        {route.screen === 'detail' && selectedNodeId !== null && (
          <MobileNoteDetail
            nodeId={route.nodeId}
            refreshToken={refreshState.focus}
            onBack={() => dispatch({ type: 'back' })}
            onOpenChild={(child) => dispatch({ type: 'open-child', child })}
          />
        )}
        {route.screen === 'child' && (
          <MobileNoteChildScreen
            child={route.child}
            node={childDetail.node}
            connections={childDetail.connections}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {route.screen === 'notes' && selectedNodeId !== null && (
          <MobileNoteDetail
            nodeId={selectedNodeId}
            refreshToken={refreshState.focus}
            onBack={() => dispatch({ type: 'back' })}
            onOpenChild={(child) => dispatch({ type: 'open-child', child })}
          />
        )}
        {route.screen === 'notes' && selectedNodeId === null && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '100vh', color: 'var(--app-text-muted)' }}>
            Select a note to open it here.
          </div>
        )}
      </main>
    </div>
  );
}
