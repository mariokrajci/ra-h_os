# Theme Primitives Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace repeated inline theme styling with shared semantic CSS primitives for app surfaces and content rendering.

**Architecture:** Extend the global token layer with reusable semantic classes for buttons, inputs, panels, tabs, badges, and prose. Migrate key shell and markdown-rendering components to those classes while keeping inline styles focused on layout and dynamic sizing.

**Tech Stack:** Next.js, React, CSS variables, Vitest

---

### Task 1: Add failing regression coverage

**Files:**
- Create: `tests/unit/themePrimitives.test.ts`
- Test: `tests/unit/themePrimitives.test.ts`

**Step 1: Write the failing test**

Assert that global CSS defines shared primitive classes and that key components use those classes instead of only inline token styling.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/themePrimitives.test.ts`
Expected: FAIL because the new primitive classes and usages do not exist yet.

**Step 3: Write minimal implementation**

Add the primitive classes to `app/globals.css` and migrate the chosen components to use them.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/themePrimitives.test.ts`
Expected: PASS

### Task 2: Migrate shared component surfaces

**Files:**
- Modify: `app/globals.css`
- Modify: `src/components/settings/SettingsModal.tsx`
- Modify: `src/components/focus/source/SourceReader.tsx`
- Modify: `src/components/focus/source/SourceSearchBar.tsx`
- Modify: `src/components/views/ViewsOverlay.tsx`
- Modify: `src/components/helpers/MarkdownWithNodeTokens.tsx`
- Modify: `src/components/focus/source/MappedMarkdownRenderer.tsx`

**Step 1: Add semantic classes**

Introduce primitives for panels, elevated panels, buttons, button variants, inputs, tabs, badges, and prose/content defaults.

**Step 2: Migrate component usage**

Replace repeated inline visual tokens with class names, keeping inline styles only for layout or state that cannot be expressed cleanly by class composition.

**Step 3: Run focused verification**

Run: `npx vitest run tests/unit/themePrimitives.test.ts tests/unit/focusTheme.test.ts tests/unit/docsAndViewsTheme.test.ts tests/unit/markdownSourceMapping.test.ts`

**Step 4: Run type check**

Run: `npm run type-check`
