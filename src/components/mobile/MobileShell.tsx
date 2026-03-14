"use client";

import { useReducer } from 'react';
import { PenSquare, Search } from 'lucide-react';

import { useAppShell } from '@/components/layout/AppShellProvider';
import type { MobileRoute } from './mobileRoutes';
import { reduceMobileRoute } from './mobileRoutes';
import MobileNotesList from './MobileNotesList';
import MobileNoteDetail from './MobileNoteDetail';
import MobileSearchScreen from './MobileSearchScreen';
import MobileCaptureScreen from './MobileCaptureScreen';
import MobileNoteChildScreen from './MobileNoteChildScreen';
import { useMobileNodeDetail } from './useMobileNodeDetail';

function MobileBottomBar({
  onOpenSearch,
  onOpenAdd,
}: {
  onOpenSearch: () => void;
  onOpenAdd: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '0 16px calc(18px + env(safe-area-inset-bottom))',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <button
        type="button"
        className="app-button"
        style={{
          pointerEvents: 'auto',
          height: '56px',
          minWidth: '0',
          width: 'min(72vw, 280px)',
          borderRadius: '999px',
          padding: '0 20px',
          background: 'color-mix(in srgb, var(--app-panel) 72%, transparent)',
          borderColor: 'color-mix(in srgb, var(--app-border) 72%, transparent)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.14)',
        }}
        onClick={onOpenSearch}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: 'var(--app-text-muted)', fontSize: '17px' }}>
          <Search size={18} />
          Search
        </span>
      </button>
      <button
        type="button"
        className="app-button"
        style={{
          pointerEvents: 'auto',
          width: '56px',
          height: '56px',
          borderRadius: '999px',
          background: 'color-mix(in srgb, var(--app-panel) 78%, transparent)',
          borderColor: 'color-mix(in srgb, var(--app-border) 72%, transparent)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.16)',
          color: 'var(--app-text)',
        }}
        onClick={onOpenAdd}
        aria-label="Add note"
      >
        <PenSquare size={20} />
      </button>
    </div>
  );
}

export default function MobileShell() {
  const {
    refreshState,
    pendingNodes,
    dismissPendingNode,
    submitQuickAdd,
  } = useAppShell();

  const [route, dispatch] = useReducer(
    reduceMobileRoute,
    { screen: 'notes' } as MobileRoute,
  );
  const childDetail = useMobileNodeDetail(route.screen === 'child' ? route.nodeId : -1, refreshState.focus);

  return (
    <>
      {route.screen === 'notes' && (
        <MobileNotesList
          refreshToken={refreshState.nodes}
          pendingNodes={pendingNodes}
          onDismissPending={dismissPendingNode}
          onOpenNode={(nodeId) => dispatch({ type: 'open-note', nodeId })}
        />
      )}
      {route.screen === 'detail' && (
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
      {route.screen === 'search' && (
        <MobileSearchScreen
          onBack={() => dispatch({ type: 'back' })}
          onOpenNode={(nodeId) => dispatch({ type: 'open-note', nodeId })}
        />
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

      <MobileBottomBar
        onOpenSearch={() => dispatch({ type: 'open-search' })}
        onOpenAdd={() => dispatch({ type: 'open-add' })}
      />
    </>
  );
}
