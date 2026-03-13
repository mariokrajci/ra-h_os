# FocusPanel Theme Sweep Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the remaining Edges and top tab-strip surfaces in `FocusPanel` onto the shared theme primitives.

**Architecture:** Keep all existing `FocusPanel` behavior but replace hard-coded dark styling in the Edges management cluster and the local tab chrome with semantic button, panel, input, and token-based styles. Use one focused regression in `focusTheme.test.ts` to pin this area to the shared theming contract.

**Tech Stack:** Next.js, React, TypeScript, Vitest, CSS variables in `app/globals.css`

---

### Task 1: Lock the FocusPanel theme contract

**Files:**
- Modify: `tests/unit/focusTheme.test.ts`
- Test: `tests/unit/focusTheme.test.ts`

**Step 1: Write the failing test**

Add expectations that `src/components/focus/FocusPanel.tsx` contains shared primitive usage for the Edges and tab-strip surfaces such as `app-panel-elevated`, `app-button`, `app-input`, and shared theme tokens for muted text and borders.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/focusTheme.test.ts`
Expected: FAIL because `FocusPanel.tsx` still contains hard-coded dark styling in the Edges and tab-strip sections.

**Step 3: Write minimal implementation**

Update `FocusPanel.tsx` so the Edges suggestion cards, search UI, connection list rows, inline editor controls, and local tab strip use shared primitives and theme tokens instead of hard-coded dark values.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/focusTheme.test.ts`
Expected: PASS

### Task 2: Verify the sweep against the focused suite

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx`
- Test: `tests/unit/themePrimitives.test.ts`
- Test: `tests/unit/focusTheme.test.ts`
- Test: `tests/unit/docsAndViewsTheme.test.ts`
- Test: `tests/unit/settingsViewTheme.test.ts`
- Test: `tests/unit/markdownSourceMapping.test.ts`

**Step 1: Run the focused suite**

Run: `npx vitest run tests/unit/themePrimitives.test.ts tests/unit/focusTheme.test.ts tests/unit/docsAndViewsTheme.test.ts tests/unit/settingsViewTheme.test.ts tests/unit/markdownSourceMapping.test.ts`
Expected: PASS

**Step 2: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Record remaining gaps**

Summarize any still-unmigrated `FocusPanel` or pane surfaces that remain dark-first after this sweep.
