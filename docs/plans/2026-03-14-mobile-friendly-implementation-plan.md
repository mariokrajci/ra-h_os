# Mobile-Friendly Design Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a phone-specific RA-OS shell optimized for capture and retrieval while preserving the existing desktop workspace.

**Architecture:** Extract shell-wide live-update and refresh coordination out of the desktop layout, add an explicit layout-mode boundary, then mount a dedicated mobile shell for phone breakpoints. Reuse the existing node APIs, quick-add APIs, and note rendering logic while keeping advanced panes desktop-only in the first pass.

**Tech Stack:** Next.js 15, React 19, TypeScript, existing app API routes, Vitest, ESLint, Tailwind/global CSS, local persistent state hooks

---

### Task 1: Add layout-mode and live-update infrastructure

**Files:**
- Create: `src/components/layout/__tests__/useLayoutMode.test.tsx`
- Create: `src/components/layout/useLayoutMode.ts`
- Create: `src/components/layout/AppShellProvider.tsx`
- Modify: `src/components/layout/ThreePanelLayout.tsx`
- Modify: `app/layout.tsx`

**Step 1: Write the failing tests**

Add tests for:
- `useLayoutMode` returning `phone`, `tablet`, `desktop` from window width
- shared app-shell provider incrementing refresh tokens when live events arrive

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/layout/__tests__/useLayoutMode.test.tsx`
Expected: FAIL because the hook/provider do not exist yet

**Step 3: Write minimal implementation**

Implement:
- a shared `useLayoutMode` hook using explicit phone/tablet/desktop breakpoints
- an `AppShellProvider` that owns SSE subscription, refresh tokens, and shared app actions
- minimal `ThreePanelLayout` changes to consume the provider instead of owning `/api/events`
- provider wiring in `app/layout.tsx`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/layout/__tests__/useLayoutMode.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/__tests__/useLayoutMode.test.tsx src/components/layout/useLayoutMode.ts src/components/layout/AppShellProvider.tsx src/components/layout/ThreePanelLayout.tsx app/layout.tsx
git commit -m "feat: extract shell layout and live update state"
```

### Task 2: Add shell boundary that chooses desktop or mobile UI

**Files:**
- Create: `src/components/layout/__tests__/AppShell.test.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Modify: `app/page.tsx`

**Step 1: Write the failing tests**

Add tests for:
- `AppShell` rendering mobile shell on phone layout mode
- `AppShell` rendering desktop shell on tablet/desktop layout mode

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/layout/__tests__/AppShell.test.tsx`
Expected: FAIL because `AppShell` does not exist yet

**Step 3: Write minimal implementation**

Implement:
- `AppShell` that reads layout mode and mounts `MobileShell` for `phone`
- keep `ThreePanelLayout` for tablet/desktop initially
- update `app/page.tsx` to render `AppShell`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/layout/__tests__/AppShell.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/__tests__/AppShell.test.tsx src/components/layout/AppShell.tsx app/page.tsx
git commit -m "feat: add responsive shell boundary"
```

### Task 3: Build phone notes list home screen

**Files:**
- Create: `src/components/mobile/__tests__/MobileNotesList.test.tsx`
- Create: `src/components/mobile/MobileShell.tsx`
- Create: `src/components/mobile/MobileNotesList.tsx`
- Modify: `src/components/views/ViewsOverlay.tsx`
- Modify: `src/services/database/nodes.ts` (only if API support needs a small addition)

**Step 1: Write the failing tests**

Add tests for:
- mobile notes list fetching notes sorted by updated time by default
- list rows opening note detail
- sort preference persisting when changed

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/mobile/__tests__/MobileNotesList.test.tsx`
Expected: FAIL because the mobile list components do not exist yet

**Step 3: Write minimal implementation**

Implement:
- a dedicated `MobileShell` with notes-list home state
- `MobileNotesList` that fetches from `/api/nodes?sortBy=updated`
- optional lightweight sort control persisted through the existing persistent state pattern
- keep the phone home screen intentionally sparse

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/mobile/__tests__/MobileNotesList.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/mobile/__tests__/MobileNotesList.test.tsx src/components/mobile/MobileShell.tsx src/components/mobile/MobileNotesList.tsx src/components/views/ViewsOverlay.tsx src/services/database/nodes.ts
git commit -m "feat: add mobile notes list home"
```

### Task 4: Build phone note detail screen

**Files:**
- Create: `src/components/mobile/__tests__/MobileNoteDetail.test.tsx`
- Create: `src/components/mobile/MobileNoteDetail.tsx`
- Modify: `src/components/focus/FocusPanel.tsx`
- Modify: `src/components/panes/NodePane.tsx` (only if extracting reusable helpers is needed)

**Step 1: Write the failing tests**

Add tests for:
- loading a selected node into full-screen mobile detail
- back navigation returning to notes list
- mobile detail showing primary content and compact secondary actions

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/mobile/__tests__/MobileNoteDetail.test.tsx`
Expected: FAIL because the mobile detail screen does not exist yet

**Step 3: Write minimal implementation**

Implement:
- `MobileNoteDetail` that reuses fetching and rendering patterns from `FocusPanel`
- a minimal header with back and edit affordances
- compact summary actions for source/metadata/connections without exposing full desktop chrome

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/mobile/__tests__/MobileNoteDetail.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/mobile/__tests__/MobileNoteDetail.test.tsx src/components/mobile/MobileNoteDetail.tsx src/components/focus/FocusPanel.tsx src/components/panes/NodePane.tsx
git commit -m "feat: add mobile note detail screen"
```

### Task 5: Build mobile search and add flows

**Files:**
- Create: `src/components/mobile/__tests__/MobileSearchAndAdd.test.tsx`
- Create: `src/components/mobile/MobileSearchScreen.tsx`
- Create: `src/components/mobile/MobileCaptureScreen.tsx`
- Modify: `src/components/nodes/SearchModal.tsx`
- Modify: `src/components/agents/QuickAddInput.tsx`
- Modify: `src/components/mobile/MobileShell.tsx`

**Step 1: Write the failing tests**

Add tests for:
- persistent phone actions opening full-screen search and add flows
- search result selection opening note detail
- add flow submitting note/link input and returning to list

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/mobile/__tests__/MobileSearchAndAdd.test.tsx`
Expected: FAIL because the mobile search/add screens do not exist yet

**Step 3: Write minimal implementation**

Implement:
- a phone bottom action bar with only `Search` and `Add`
- dedicated full-screen mobile search and capture screens
- extracted shared logic from `SearchModal` and `QuickAddInput` where reuse is straightforward

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/mobile/__tests__/MobileSearchAndAdd.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/mobile/__tests__/MobileSearchAndAdd.test.tsx src/components/mobile/MobileSearchScreen.tsx src/components/mobile/MobileCaptureScreen.tsx src/components/nodes/SearchModal.tsx src/components/agents/QuickAddInput.tsx src/components/mobile/MobileShell.tsx
git commit -m "feat: add mobile search and capture flows"
```

### Task 6: Update docs and verify the whole feature

**Files:**
- Modify: `docs/6_ui.md`
- Modify: `docs/0_overview.md`
- Modify: `docs/README.md` (if the docs index should link the new design/behavior)

**Step 1: Write the failing test**

No code test required. Verification is behavioral and project-level.

**Step 2: Run focused verification**

Run:
- `npm test -- src/components/layout/__tests__/useLayoutMode.test.tsx src/components/layout/__tests__/AppShell.test.tsx src/components/mobile/__tests__/MobileNotesList.test.tsx src/components/mobile/__tests__/MobileNoteDetail.test.tsx src/components/mobile/__tests__/MobileSearchAndAdd.test.tsx`
- `npm run type-check`
- `npm run lint`
- `npm run build`

Expected:
- tests PASS
- type-check PASS
- lint completes without introducing new errors
- build PASS

**Step 3: Update docs**

Document:
- phone mode behavior
- tablet/desktop distinction
- mobile capture/retrieval scope

**Step 4: Commit**

```bash
git add docs/6_ui.md docs/0_overview.md docs/README.md
git commit -m "docs: document mobile-friendly app behavior"
```
