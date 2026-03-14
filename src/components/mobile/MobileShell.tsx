"use client";

import { useCallback, useEffect, useReducer, useState } from 'react';
import { Plus, Search } from 'lucide-react';

import { useAppShell } from '@/components/layout/AppShellProvider';
import type { MobileRoute, MobileRouteAction } from './mobileRoutes';
import { reduceMobileRoute } from './mobileRoutes';
import MobileNotesList from './MobileNotesList';
import MobileNoteDetail from './MobileNoteDetail';
import MobileSearchScreen from './MobileSearchScreen';
import MobileCaptureScreen from './MobileCaptureScreen';
import MobileNoteChildScreen from './MobileNoteChildScreen';
import { useMobileNodeDetail } from './useMobileNodeDetail';

export type NavDirection = 'forward' | 'backward' | 'none';

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
          height: '60px',
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
          Search notes…
        </span>
      </button>
      <button
        type="button"
        className="app-button"
        style={{
          pointerEvents: 'auto',
          width: '60px',
          height: '60px',
          borderRadius: '999px',
          background: 'color-mix(in srgb, var(--app-panel) 78%, transparent)',
          borderColor: 'color-mix(in srgb, var(--app-border) 72%, transparent)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.16)',
          color: 'var(--app-text)',
          fontSize: '28px',
          lineHeight: 1,
        }}
        onClick={onOpenAdd}
        aria-label="Add note"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

function screenAnimation(navDirection: NavDirection): string | undefined {
  if (navDirection === 'forward') return 'slideInFromRight 280ms ease-out';
  if (navDirection === 'backward') return 'slideInFromLeft 280ms ease-out';
  return undefined;
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
  const [navDirection, setNavDirection] = useState<NavDirection>('none');

  const navigate = useCallback((action: MobileRouteAction) => {
    const isForward = action.type !== 'back';
    setNavDirection(isForward ? 'forward' : 'backward');
    if (isForward) {
      history.pushState(null, '', window.location.href);
    }
    dispatch(action);
  }, []);

  // Native swipe-back via History API popstate
  useEffect(() => {
    const handlePopState = () => {
      setNavDirection('backward');
      dispatch({ type: 'back' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const childDetail = useMobileNodeDetail(route.screen === 'child' ? route.nodeId : -1, refreshState.focus);
  const animation = screenAnimation(navDirection);

  return (
    <>
      {route.screen === 'notes' && (
        <MobileNotesList
          navDirection={navDirection}
          refreshToken={refreshState.nodes}
          pendingNodes={pendingNodes}
          onDismissPending={dismissPendingNode}
          onOpenNode={(nodeId) => navigate({ type: 'open-note', nodeId })}
          onOpenAdd={() => navigate({ type: 'open-add' })}
        />
      )}
      {route.screen === 'detail' && (
        <MobileNoteDetail
          key={route.nodeId}
          nodeId={route.nodeId}
          refreshToken={refreshState.focus}
          navDirection={navDirection}
          onBack={() => navigate({ type: 'back' })}
          onOpenChild={(child) => navigate({ type: 'open-child', child })}
          onOpenNode={(nodeId) => navigate({ type: 'open-note', nodeId })}
          animation={animation}
        />
      )}
      {route.screen === 'child' && (
        <MobileNoteChildScreen
          child={route.child}
          node={childDetail.node}
          connections={childDetail.connections}
          onBack={() => navigate({ type: 'back' })}
          onOpenNode={(nodeId) => navigate({ type: 'open-note', nodeId })}
          animation={animation}
        />
      )}
      {route.screen === 'search' && (
        <MobileSearchScreen
          onBack={() => navigate({ type: 'back' })}
          onOpenNode={(nodeId) => navigate({ type: 'open-note', nodeId })}
          animation={animation}
        />
      )}
      {route.screen === 'add' && (
        <MobileCaptureScreen
          onBack={() => navigate({ type: 'back' })}
          onSubmit={async (payload) => {
            await submitQuickAdd(payload);
            navigate({ type: 'back' });
          }}
          animation={animation}
        />
      )}

      <MobileBottomBar
        onOpenSearch={() => navigate({ type: 'open-search' })}
        onOpenAdd={() => navigate({ type: 'open-add' })}
      />
    </>
  );
}
