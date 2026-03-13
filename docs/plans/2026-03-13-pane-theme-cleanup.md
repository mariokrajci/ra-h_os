# Pane Theme Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the app theme system into high-traffic inner panes so light mode stays visually consistent across shared pane chrome, focus surfaces, settings tables, and map shells.

**Architecture:** Expand the existing CSS variable palette, then swap hard-coded pane colors for semantic tokens in shared components first and pane interiors second. Keep the work styling-focused and avoid refactoring pane behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, inline styles, CSS variables, Vitest

---

### Task 1: Add pane-surface token coverage and tests

**Files:**
- Modify: `app/globals.css`
- Create: `tests/unit/paneThemeTokens.test.ts`

**Step 1: Write the failing test**

Cover the presence of the new pane-oriented semantic variables in the global stylesheet.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/paneThemeTokens.test.ts`
Expected: FAIL because the new tokens are not present yet.

**Step 3: Write minimal implementation**

Add the new semantic variables for pane interiors and controls.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/paneThemeTokens.test.ts`
Expected: PASS.

### Task 2: Theme shared pane chrome

**Files:**
- Modify: `src/components/panes/PaneHeader.tsx`
- Modify: `src/components/layout/SplitHandle.tsx`
- Modify: `src/components/panes/NodePane.tsx`

**Step 1: Write the failing test**

Add a focused render test for pane chrome using tokenized surfaces.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/paneChromeTheme.test.ts`
Expected: FAIL because shared pane chrome still uses hard-coded dark values.

**Step 3: Write minimal implementation**

Replace shared pane chrome colors and hover states with semantic variables.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/paneChromeTheme.test.ts`
Expected: PASS.

### Task 3: Theme focus and source shells

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx`
- Modify: `src/components/focus/focusPanelStyles.ts`
- Modify: `src/components/focus/source/SourceReader.tsx`

**Step 1: Write the failing test**

Cover shared focus styles or tokenized values that should now be theme-aware.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/focusShellTheme.test.ts`
Expected: FAIL because focus shell styles are still dark-specific.

**Step 3: Write minimal implementation**

Swap the shared focus surfaces and control styling to pane tokens.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/focusShellTheme.test.ts`
Expected: PASS.

### Task 4: Theme logs, database, library, and map shells

**Files:**
- Modify: `src/components/settings/LogsViewer.tsx`
- Modify: `src/components/settings/LogsRow.tsx`
- Modify: `src/components/settings/DatabaseViewer.tsx`
- Modify: `src/components/panes/library/LibraryFilters.tsx`
- Modify: `src/components/panes/MapPane.tsx`
- Modify: `src/components/panes/map/map-styles.css`

**Step 1: Write the failing test**

Add a small token-usage test for at least one shared settings/table surface and one map CSS surface.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/paneThemeTokens.test.ts tests/unit/focusShellTheme.test.ts`
Expected: FAIL where tokenized pane surfaces are not yet reflected.

**Step 3: Write minimal implementation**

Replace the most visible hard-coded dark surfaces with pane tokens.

**Step 4: Run test to verify it passes**

Run the focused test set again.
Expected: PASS.

### Task 5: Verify broader pane cleanup

**Files:**
- Modify as needed from previous tasks

**Step 1: Run focused tests**

Run:
- `npx vitest run tests/unit/themeState.test.ts`
- `npx vitest run tests/unit/settingsThemeSelector.test.ts`
- `npx vitest run tests/unit/paneThemeTokens.test.ts`
- `npx vitest run tests/unit/paneChromeTheme.test.ts`
- `npx vitest run tests/unit/focusShellTheme.test.ts`

Expected: PASS.

**Step 2: Run required checks**

Run:
- `npm run type-check`
- `npm run lint`
- `npm run build`

Expected:
- `type-check` should pass if the styling changes are correct
- `lint` and `build` may still fail on known unrelated repository issues; report exact evidence
