# Dark Inline Code Prominence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make markdown inline code chips more prominent in dark mode across the Source reader and Docs modal.

**Architecture:** Add semantic inline-code tokens to the global theme layer, then consume them in the shared markdown renderer. Verify the change with a focused source-theme regression test.

**Tech Stack:** Next.js, React, CSS variables, Vitest

---

### Task 1: Add regression coverage

**Files:**
- Modify: `tests/unit/focusTheme.test.ts`
- Test: `tests/unit/focusTheme.test.ts`

**Step 1: Write the failing test**

Assert that the markdown renderer references dedicated inline-code theme tokens.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/focusTheme.test.ts`
Expected: FAIL because the inline-code token names are not present yet.

**Step 3: Write minimal implementation**

Add the inline-code theme tokens to `app/globals.css` and use them in `src/components/helpers/MarkdownWithNodeTokens.tsx`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/focusTheme.test.ts`
Expected: PASS

### Task 2: Verify the shared theme path

**Files:**
- Modify: `app/globals.css`
- Modify: `src/components/helpers/MarkdownWithNodeTokens.tsx`
- Test: `tests/unit/focusTheme.test.ts`

**Step 1: Run focused verification**

Run: `npx vitest run tests/unit/focusTheme.test.ts`

**Step 2: Run broader verification**

Run: `npx vitest run tests/unit/docsAndViewsTheme.test.ts tests/unit/focusTheme.test.ts`

**Step 3: Run type check**

Run: `npm run type-check`

**Step 4: Commit**

```bash
git add app/globals.css src/components/helpers/MarkdownWithNodeTokens.tsx tests/unit/focusTheme.test.ts docs/plans/2026-03-13-dark-inline-code-prominence-design.md docs/plans/2026-03-13-dark-inline-code-prominence.md
git commit -m "fix: improve dark theme inline code contrast"
```
