# Source HTML Markdown Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Source tab render GitHub-style markdown with embedded HTML tables and inline HTML tags correctly.

**Architecture:** Add a narrow preprocessing step in the Source markdown renderer that rewrites HTML table fragments and a few inline HTML tags into plain markdown before parsing. Verify the change with a regression test that reproduces the broken GitHub README pattern.

**Tech Stack:** React, unified/remark, Vitest

---

### Task 1: Add the failing regression

**Files:**
- Modify: `tests/unit/markdownSourceMapping.test.ts`
- Test: `tests/unit/markdownSourceMapping.test.ts`

**Step 1: Write the failing test**

Add a test with a GitHub-style HTML table fragment containing `<td>` and `<code>` content.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/markdownSourceMapping.test.ts`
Expected: FAIL because the Source renderer currently leaks HTML tags or code-block-like output instead of rendering a link and inline code.

**Step 3: Write minimal implementation**

Normalize the supported HTML subset in `src/components/focus/source/MappedMarkdownRenderer.tsx`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/markdownSourceMapping.test.ts`
Expected: PASS

### Task 2: Verify the renderer path

**Files:**
- Modify: `src/components/focus/source/MappedMarkdownRenderer.tsx`
- Test: `tests/unit/markdownSourceMapping.test.ts`

**Step 1: Run focused verification**

Run: `npx vitest run tests/unit/markdownSourceMapping.test.ts`

**Step 2: Run broader verification**

Run: `npx vitest run tests/unit/focusTheme.test.ts tests/unit/markdownSourceMapping.test.ts`

**Step 3: Run type check**

Run: `npm run type-check`
