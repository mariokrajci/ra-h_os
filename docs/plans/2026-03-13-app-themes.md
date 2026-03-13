# App Themes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add system-default light and dark app themes with a manual Settings override, while improving navigation contrast in dark mode.

**Architecture:** Introduce a small app theme provider that resolves `system | light | dark` into an effective theme and applies it to the root element. Move shell styling to semantic CSS variables, then update the left toolbar and Settings modal to use those variables and expose the theme control.

**Tech Stack:** Next.js App Router, React, TypeScript, inline styles with global CSS variables, Vitest

---

### Task 1: Add theme model and tests

**Files:**
- Create: `src/components/theme/themeState.ts`
- Create: `tests/unit/themeState.test.ts`

**Step 1: Write the failing test**

Cover:
- default resolution for `light` and `dark`
- `system` resolution based on a boolean system-dark flag
- helper behavior stays deterministic without DOM access

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/themeState.test.ts`
Expected: FAIL because the theme state helper does not exist yet.

**Step 3: Write minimal implementation**

Add small helpers and types for:
- `ThemeMode`
- `ResolvedTheme`
- `resolveTheme(mode, prefersDark)`

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/themeState.test.ts`
Expected: PASS.

### Task 2: Add app theme provider

**Files:**
- Create: `src/components/theme/AppThemeProvider.tsx`
- Modify: `app/layout.tsx`

**Step 1: Write the failing test**

Add provider-focused assertions in the component test task below instead of over-testing internals.

**Step 2: Write minimal implementation**

Create a client provider that:
- uses `usePersistentState('ui.theme.mode', 'system')`
- listens to `matchMedia('(prefers-color-scheme: dark)')`
- resolves the effective theme
- writes `data-theme` and `color-scheme` to `document.documentElement`
- exposes context for Settings

Wrap the app in the provider in `app/layout.tsx`.

**Step 3: Verify behavior through component tests**

Use the Settings modal test to confirm updates flow through context.

### Task 3: Add shell theme tokens

**Files:**
- Modify: `app/globals.css`

**Step 1: Write the failing test**

No isolated CSS unit test needed; cover behavior via UI tests and build checks.

**Step 2: Write minimal implementation**

Define semantic variables for both themes, including:
- app background
- panel background
- elevated surface
- border colors
- primary and muted text
- hover and pressed states
- toolbar idle, hover, and active colors
- accent colors

Set the default root token set to dark-compatible values, then override via `[data-theme='light']` and `[data-theme='dark']`.

### Task 4: Update Settings modal and toolbar

**Files:**
- Modify: `src/components/settings/SettingsModal.tsx`
- Modify: `src/components/layout/LeftToolbar.tsx`
- Create: `tests/unit/settingsThemeSelector.test.tsx`

**Step 1: Write the failing test**

Cover:
- Settings renders `System`, `Light`, and `Dark`
- selecting an option updates the active state
- the selector can operate with provider context

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/settingsThemeSelector.test.tsx`
Expected: FAIL because no theme context/control exists yet.

**Step 3: Write minimal implementation**

Update:
- Settings sidebar/content surfaces to use CSS variables
- add a theme preferences section
- left toolbar colors, hover states, and active states to use semantic tokens with stronger contrast in dark mode

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/settingsThemeSelector.test.tsx`
Expected: PASS.

### Task 5: Verify shell integration

**Files:**
- Modify as needed from previous tasks

**Step 1: Run focused tests**

Run:
- `npx vitest run tests/unit/themeState.test.ts`
- `npx vitest run tests/unit/settingsThemeSelector.test.tsx`

Expected: PASS.

**Step 2: Run required repository checks**

Run:
- `npm run type-check`
- `npm run lint`
- `npm run build`

Expected: PASS.
