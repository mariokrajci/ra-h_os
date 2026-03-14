# Mobile UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevate the RA-OS mobile experience with screen transitions, swipe-back, a full visual redesign (editorial flat list, strong type hierarchy, consistent headers), and functional gap fixes (timestamps, tappable connections, recent search, native capture form).

**Architecture:** `MobileShell` gains a `navDirection` state and a `navigate` wrapper around `dispatch`; child screens receive `navDirection` as a prop and apply CSS keyframe slide animations. The History API is used for native swipe-back on iOS. Visual changes are scoped to the 6 mobile components plus `globals.css`.

**Tech Stack:** Next.js 15, React, TypeScript, Vitest (unit tests at `tests/unit/`), CSS custom properties (no Tailwind in mobile components)

---

## Task 1: `formatRelativeTime` utility

**Files:**
- Create: `src/components/mobile/formatRelativeTime.ts`
- Create: `tests/unit/formatRelativeTime.test.ts`

**Step 1: Write the failing test**

```ts
// tests/unit/formatRelativeTime.test.ts
import { describe, expect, test } from 'vitest';
import { formatRelativeTime } from '@/components/mobile/formatRelativeTime';

describe('formatRelativeTime', () => {
  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }
  function hoursAgo(n: number) {
    return new Date(Date.now() - n * 3600_000).toISOString();
  }
  function minutesAgo(n: number) {
    return new Date(Date.now() - n * 60_000).toISOString();
  }
  function secondsAgo(n: number) {
    return new Date(Date.now() - n * 1000).toISOString();
  }

  test('just now for < 60s', () => {
    expect(formatRelativeTime(secondsAgo(30))).toBe('just now');
  });
  test('minutes for < 60min', () => {
    expect(formatRelativeTime(minutesAgo(5))).toBe('5m ago');
  });
  test('hours for < 24h', () => {
    expect(formatRelativeTime(hoursAgo(3))).toBe('3h ago');
  });
  test('Yesterday for ~1 day ago', () => {
    expect(formatRelativeTime(daysAgo(1))).toBe('Yesterday');
  });
  test('short month+day for older dates', () => {
    const old = new Date('2025-03-01T10:00:00Z').toISOString();
    const result = formatRelativeTime(old);
    // Should be a formatted date string like "Mar 1"
    expect(result).toMatch(/^[A-Z][a-z]+ \d+/);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/formatRelativeTime.test.ts
```
Expected: FAIL — module not found.

**Step 3: Write implementation**

```ts
// src/components/mobile/formatRelativeTime.ts
export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = now - then;

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  const thenDate = new Date(isoDate);
  const todayDate = new Date();
  const yesterday = new Date(todayDate);
  yesterday.setDate(todayDate.getDate() - 1);

  if (thenDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const opts: Intl.DateTimeFormatOptions =
    thenDate.getFullYear() === todayDate.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };

  return thenDate.toLocaleDateString(undefined, opts);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/formatRelativeTime.test.ts
```
Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add src/components/mobile/formatRelativeTime.ts tests/unit/formatRelativeTime.test.ts
git commit -m "feat(mobile): add formatRelativeTime utility"
```

---

## Task 2: Markdown stripping in note previews

**Files:**
- Modify: `src/components/mobile/mobileNotesPresentation.ts`
- Modify: `tests/unit/` — add a new test file `tests/unit/mobileNotesPresentation.test.ts`

**Step 1: Write the failing test**

```ts
// tests/unit/mobileNotesPresentation.test.ts
import { describe, expect, test } from 'vitest';
import { getMobileNotePreview } from '@/components/mobile/mobileNotesPresentation';

describe('getMobileNotePreview', () => {
  test('strips heading markers', () => {
    expect(getMobileNotePreview({ notes: '## Introduction\n\nHello' })).toBe('Introduction Hello');
  });
  test('strips bold markers', () => {
    expect(getMobileNotePreview({ notes: '**important** text' })).toBe('important text');
  });
  test('strips italic markers', () => {
    expect(getMobileNotePreview({ notes: '_emphasized_ word' })).toBe('emphasized word');
  });
  test('strips inline code', () => {
    expect(getMobileNotePreview({ notes: 'use `npm install` to install' })).toBe('use npm install to install');
  });
  test('strips link syntax, keeps text', () => {
    expect(getMobileNotePreview({ notes: 'see [this article](https://example.com) for more' }))
      .toBe('see this article for more');
  });
  test('strips list markers', () => {
    expect(getMobileNotePreview({ notes: '- first item\n- second item' })).toBe('first item second item');
  });
  test('truncates at 140 chars', () => {
    const long = 'a'.repeat(200);
    const result = getMobileNotePreview({ notes: long });
    expect(result.length).toBe(140);
    expect(result.endsWith('...')).toBe(true);
  });
  test('prefers description over notes', () => {
    expect(getMobileNotePreview({ description: 'desc', notes: 'notes' })).toBe('desc');
  });
  test('falls back to placeholder', () => {
    expect(getMobileNotePreview({})).toBe('No preview yet.');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/mobileNotesPresentation.test.ts
```
Expected: several FAIL — heading/bold/etc stripping not implemented.

**Step 3: Write implementation**

Replace the entire `src/components/mobile/mobileNotesPresentation.ts`:

```ts
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')           // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → keep text
    .replace(/`([^`]+)`/g, '$1')             // inline code
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold / italic
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')   // underscore bold/italic
    .replace(/^\s*[-*+]\s+/gm, '')           // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')           // ordered list markers
    .replace(/\s+/g, ' ')
    .trim();
}

export function getMobileNotePreview(input: {
  description?: string | null;
  notes?: string | null;
}): string {
  const raw = stripMarkdown(
    input.description?.trim() || input.notes?.trim() || ''
  );

  if (!raw) return 'No preview yet.';
  if (raw.length <= 137) return raw;
  return `${raw.slice(0, 137).trimEnd()}...`;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/mobileNotesPresentation.test.ts
```
Expected: PASS (9 tests).

**Step 5: Commit**

```bash
git add src/components/mobile/mobileNotesPresentation.ts tests/unit/mobileNotesPresentation.test.ts
git commit -m "feat(mobile): strip markdown from note previews"
```

---

## Task 3: CSS slide animations

**Files:**
- Modify: `app/globals.css`

**Step 1: Add keyframes at the end of `app/globals.css`**

```css
/* Mobile screen slide transitions */
@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0.85;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-100%);
    opacity: 0.85;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

**Step 2: Verify no existing `slideInFromRight` conflicts**

```bash
grep -r 'slideInFromRight\|slideInFromLeft' app/ src/
```
Expected: no results (these names are new).

**Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(mobile): add slide transition keyframes"
```

---

## Task 4: `MobileShell` — navigation architecture

**Files:**
- Modify: `src/components/mobile/MobileShell.tsx`

This task adds `navDirection` state, wraps `dispatch` in a `navigate` function, integrates the History API for swipe-back, and wires the two new props needed by downstream tasks (`onOpenAdd` for the empty state, `onOpenNode` for tappable connections).

**Step 1: Replace `MobileShell.tsx` with the updated version**

```tsx
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
```

**Step 2: Verify the file compiles**

```bash
npx tsc --noEmit 2>&1 | grep 'mobile/MobileShell'
```
Expected: no errors for this file (downstream components will show prop errors — those are fixed in subsequent tasks).

**Step 3: Commit**

```bash
git add src/components/mobile/MobileShell.tsx
git commit -m "feat(mobile): add navDirection, navigate wrapper, History API swipe-back"
```

---

## Task 5: `MobileNotesList` — editorial list redesign

**Files:**
- Modify: `src/components/mobile/MobileNotesList.tsx`

Replace the card-based list with a flat editorial list, large collapsing "Notes" title, timestamps, and an empty state.

**Step 1: Replace `MobileNotesList.tsx`**

```tsx
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
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep 'MobileNotesList'
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/mobile/MobileNotesList.tsx
git commit -m "feat(mobile): editorial flat list with timestamps, collapsing title, empty state"
```

---

## Task 6: `MobileNoteDetail` — visual redesign + scrolling title + auto-focus

**Files:**
- Modify: `src/components/mobile/MobileNoteDetail.tsx`

**Step 1: Replace `MobileNoteDetail.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

import MarkdownWithNodeTokens from '@/components/helpers/MarkdownWithNodeTokens';
import { useMobileNodeDetail } from './useMobileNodeDetail';

export default function MobileNoteDetail({
  nodeId,
  refreshToken,
  navDirection,
  onBack,
  onOpenChild,
  onOpenNode,
  animation,
}: {
  nodeId: number;
  refreshToken: number;
  navDirection: 'forward' | 'backward' | 'none';
  onBack: () => void;
  onOpenChild: (child: 'source' | 'metadata' | 'connections') => void;
  onOpenNode: (nodeId: number) => void;
  animation: string | undefined;
}) {
  const { node, connections, loading, setNode } = useMobileNodeDetail(nodeId, refreshToken);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNotesDraft(node?.notes ?? '');
  }, [node?.notes]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editingNotes) {
      textareaRef.current?.focus();
    }
  }, [editingNotes]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    setShowHeaderTitle(e.currentTarget.scrollTop > 52);
  }

  async function saveNotes() {
    setSaving(true);
    try {
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft }),
      });
      const result = await response.json();
      if (result.success) {
        setNode(result.node);
        setEditingNotes(false);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: showHeaderTitle ? '0.5px solid var(--app-border)' : '0.5px solid transparent',
        transition: 'border-color 0.15s',
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
          Notes
        </button>

        <div style={{
          fontSize: '15px',
          fontWeight: 600,
          opacity: showHeaderTitle ? 1 : 0,
          transition: 'opacity 0.18s ease',
          flex: 1,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
        }}>
          {node?.title || ''}
        </div>

        <button
          type="button"
          className={`app-button app-button--compact${editingNotes ? ' app-button--accent' : ''}`}
          onClick={() => editingNotes ? void saveNotes() : setEditingNotes(true)}
          disabled={saving}
        >
          {editingNotes ? (saving ? 'Saving…' : 'Save') : 'Edit'}
        </button>
      </div>

      {/* Scrollable content */}
      <div
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}
      >
        {loading || !node ? (
          <div style={{ padding: '24px 16px', color: 'var(--app-text-muted)' }}>
            {loading ? 'Loading…' : 'Note not found.'}
          </div>
        ) : (
          <div style={{ padding: '20px 16px 0' }}>
            {/* Hero title */}
            <h1 style={{
              fontSize: '30px',
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: '-0.3px',
              fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
            }}>
              {node.title || `Untitled #${node.id}`}
            </h1>

            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--app-text-subtle)' }}>
              Edited {new Date(node.updated_at).toLocaleString()}
            </div>

            {/* Description */}
            {node.description && (
              <div style={{
                marginTop: '18px',
                fontSize: '15px',
                color: 'var(--app-text-muted)',
                lineHeight: 1.6,
                padding: '14px 16px',
                background: 'var(--app-panel)',
                borderRadius: '14px',
                border: '0.5px solid var(--app-border)',
              }}>
                {node.description}
              </div>
            )}

            {/* Notes content */}
            <div style={{
              marginTop: '20px',
              fontSize: '16px',
              lineHeight: 1.75,
              color: 'var(--app-text)',
            }}>
              {editingNotes ? (
                <textarea
                  ref={textareaRef}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="app-input"
                  style={{
                    minHeight: '240px',
                    padding: '14px',
                    fontSize: '16px',
                    lineHeight: 1.75,
                    width: '100%',
                  }}
                />
              ) : node.notes?.trim() ? (
                <MarkdownWithNodeTokens content={node.notes} />
              ) : (
                <div style={{ color: 'var(--app-text-muted)', fontStyle: 'italic' }}>
                  No notes yet. Tap Edit to add notes.
                </div>
              )}
            </div>

            {/* Flush child sections */}
            <div style={{ marginTop: '32px', borderTop: '0.5px solid var(--app-border)' }}>
              <button
                type="button"
                onClick={() => onOpenChild('connections')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 0',
                  borderBottom: '0.5px solid var(--app-border)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '0.5px solid var(--app-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Connections
                </div>
                <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{connections.length > 0 ? `${connections.length} related notes` : 'No related notes yet'}</span>
                  <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.4 }} />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onOpenChild('metadata')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 0',
                  borderBottom: node.chunk ? '0.5px solid var(--app-border)' : 'none',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: node.chunk ? '0.5px solid var(--app-border)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Metadata
                </div>
                <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{node.dimensions?.length ? `${node.dimensions.length} tags` : 'No tags assigned'}</span>
                  <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.4 }} />
                </div>
              </button>

              {node.chunk && (
                <button
                  type="button"
                  onClick={() => onOpenChild('source')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '16px 0',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Source
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                      {node.chunk.slice(0, 60)}…
                    </span>
                    <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.4 }} />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep 'MobileNoteDetail'
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/mobile/MobileNoteDetail.tsx
git commit -m "feat(mobile): redesign note detail with hero title, scrolling header, flush sections, auto-focus"
```

---

## Task 7: `MobileNoteChildScreen` — tappable connections + consistent header

**Files:**
- Modify: `src/components/mobile/MobileNoteChildScreen.tsx`

**Step 1: Replace `MobileNoteChildScreen.tsx`**

```tsx
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
                      borderBottom: '0.5px solid var(--app-border)',
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
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep 'MobileNoteChildScreen'
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/mobile/MobileNoteChildScreen.tsx
git commit -m "feat(mobile): tappable connections, dimension chips, consistent header in child screen"
```

---

## Task 8: `MobileSearchScreen` — recent notes + loading state

**Files:**
- Modify: `src/components/mobile/MobileSearchScreen.tsx`

**Step 1: Replace `MobileSearchScreen.tsx`**

```tsx
"use client";

import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

import { useNotesFeed } from './useNotesFeed';
import { getMobileNotePreview } from './mobileNotesPresentation';
import { formatRelativeTime } from './formatRelativeTime';

interface SearchResult {
  id: number;
  title: string;
  notes?: string | null;
  description?: string | null;
  updated_at: string;
}

export default function MobileSearchScreen({
  onBack,
  onOpenNode,
  animation,
}: {
  onBack: () => void;
  onOpenNode: (nodeId: number) => void;
  animation: string | undefined;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recent notes for empty state
  const { nodes: recentNodes } = useNotesFeed(0, 'ui.mobile.search.recent');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/nodes/search?q=${encodeURIComponent(query)}&limit=20`);
        const result = await response.json();
        if (result.success) {
          setResults(result.data || []);
        }
      } catch (error) {
        console.error('Failed to search:', error);
      } finally {
        setSearching(false);
      }
    }, 160);

    return () => clearTimeout(timeout);
  }, [query]);

  const showEmpty = !query.trim();
  const showSearching = !showEmpty && searching;
  const showNoResults = !showEmpty && !searching && results.length === 0;
  const showResults = !showEmpty && !searching && results.length > 0;

  function renderRow(item: { id: number; title: string; notes?: string | null; description?: string | null; updated_at: string }, index: number, total: number) {
    return (
      <Fragment key={item.id}>
        <button
          type="button"
          onClick={() => onOpenNode(item.id)}
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
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.title || `Untitled #${item.id}`}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--app-text-subtle)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {formatRelativeTime(item.updated_at)}
            </div>
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--app-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getMobileNotePreview(item)}
          </div>
        </button>
        {index < total - 1 && (
          <div style={{ height: '0.5px', background: 'var(--app-border)', margin: '0 16px' }} />
        )}
      </Fragment>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Header with search input */}
      <div style={{
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid var(--app-border)',
        padding: '14px 16px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="app-button app-button--ghost app-button--compact"
            style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 6px 4px', flexShrink: 0 }}
            onClick={onBack}
          >
            <ChevronLeft size={18} />
            Notes
          </button>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="app-input"
            style={{ flex: 1, padding: '10px 14px', fontSize: '16px' }}
          />
        </div>
      </div>

      {/* Results / empty state */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}>
        {showEmpty && (
          <>
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--app-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent
              </div>
            </div>
            {recentNodes.slice(0, 8).map((node, i) => renderRow(node, i, Math.min(recentNodes.length, 8)))}
          </>
        )}

        {showSearching && (
          <div style={{ padding: '20px 16px', color: 'var(--app-text-muted)', fontSize: '14px' }}>Searching…</div>
        )}

        {showNoResults && (
          <div style={{ padding: '20px 16px', color: 'var(--app-text-muted)', fontSize: '14px' }}>
            No results for "{query}"
          </div>
        )}

        {showResults && results.map((result, i) => renderRow(result, i, results.length))}
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep 'MobileSearchScreen'
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/mobile/MobileSearchScreen.tsx
git commit -m "feat(mobile): recent notes on empty search, loading state, consistent row design"
```

---

## Task 9: `MobileCaptureScreen` — native mobile form

**Files:**
- Modify: `src/components/mobile/MobileCaptureScreen.tsx`

**Step 1: Replace `MobileCaptureScreen.tsx`**

```tsx
"use client";

import { useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

type CaptureMode = 'note' | 'link';

export default function MobileCaptureScreen({
  onBack,
  onSubmit,
  animation,
}: {
  onBack: () => void;
  onSubmit: (payload: {
    input: string;
    mode: 'link' | 'note' | 'chat';
    description?: string;
  }) => Promise<void>;
  animation: string | undefined;
}) {
  const [mode, setMode] = useState<CaptureMode>('note');
  const [noteText, setNoteText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = mode === 'note' ? noteText.trim().length > 0 : linkUrl.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(
        mode === 'note'
          ? { input: noteText.trim(), mode: 'note' }
          : { input: linkUrl.trim(), mode: 'link', description: linkDesc.trim() || undefined }
      );
    } finally {
      setSubmitting(false);
    }
  }

  function growTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', color: 'var(--app-text)', animation }}>
      {/* Header */}
      <div style={{
        background: 'color-mix(in srgb, var(--app-bg) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid var(--app-border)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '52px',
      }}>
        <button
          type="button"
          className="app-button app-button--ghost app-button--compact"
          style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 6px 4px', flexShrink: 0 }}
          onClick={onBack}
        >
          <ChevronLeft size={18} />
          Notes
        </button>

        {/* Mode toggle tabs */}
        <div style={{ display: 'flex', gap: '20px', flex: 1, justifyContent: 'center' }}>
          {(['note', 'link'] as CaptureMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                fontSize: '15px',
                fontWeight: mode === m ? 600 : 400,
                color: mode === m ? 'var(--app-text)' : 'var(--app-text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: mode === m ? '2px solid var(--toolbar-accent)' : '2px solid transparent',
                padding: '4px 0',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ width: '72px' }} />
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', paddingBottom: '120px' }}>
        {mode === 'note' ? (
          <textarea
            ref={textareaRef}
            autoFocus
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value);
              growTextarea(e.target);
            }}
            placeholder="Write a note…"
            style={{
              width: '100%',
              minHeight: '200px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'var(--app-text)',
              resize: 'none',
              fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Paste a link…"
              className="app-input"
              style={{ padding: '14px 16px', fontSize: '16px' }}
            />
            <textarea
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="Description (optional)"
              className="app-input"
              style={{ padding: '14px 16px', fontSize: '15px', minHeight: '100px', resize: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Submit button — fixed above safe area */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px calc(24px + env(safe-area-inset-bottom))',
        background: 'color-mix(in srgb, var(--app-bg) 92%, transparent)',
        backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid var(--app-border)',
      }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '999px',
            background: canSubmit ? 'var(--toolbar-accent)' : 'var(--app-panel)',
            color: canSubmit ? '#fff' : 'var(--app-text-muted)',
            border: 'none',
            fontSize: '16px',
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s',
            fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
          }}
        >
          {submitting ? 'Saving…' : mode === 'note' ? 'Save note' : 'Save link'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep 'MobileCaptureScreen'
```
Expected: no errors.

**Step 3: Run all unit tests to confirm nothing regressed**

```bash
npm test
```
Expected: PASS (all tests including the new ones from Tasks 1 and 2).

**Step 4: Commit**

```bash
git add src/components/mobile/MobileCaptureScreen.tsx
git commit -m "feat(mobile): native capture form with mode toggle, bare composer, auto-growing textarea"
```

---

## Task 10: Final type check and cleanup

**Step 1: Full TypeScript compile check**

```bash
npx tsc --noEmit 2>&1
```
Expected: zero errors. If any remain, fix them before proceeding.

**Step 2: Run all tests**

```bash
npm test
```
Expected: all PASS.

**Step 3: Final commit if any fixups were needed**

```bash
git add -p
git commit -m "fix(mobile): address remaining type errors from UI polish pass"
```
