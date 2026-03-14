# Website Description Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure website imports use the normal description generation path instead of storing the low-value `Website source: ...` fallback.

**Architecture:** Remove the hardcoded description from the website extraction tool so `/api/nodes` can call the shared description service during creation. Verify the request payload in a focused tool test.

**Tech Stack:** TypeScript, Next.js API routes, Vitest

---

### Task 1: Add failing regression coverage

**Files:**
- Modify: `tests/unit/website-extract-create-node-response.test.ts`
- Test: `tests/unit/website-extract-create-node-response.test.ts`

**Step 1: Write the failing test**

Assert that website node creation omits a canned `description` field and still sends the expected title/link/metadata.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/website-extract-create-node-response.test.ts`
Expected: FAIL because the tool currently sends `Website source: ...`.

**Step 3: Write minimal implementation**

Remove the canned description builder from `src/tools/other/websiteExtract.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/website-extract-create-node-response.test.ts`
Expected: PASS

### Task 2: Verify related behavior

**Files:**
- Modify: `src/tools/other/websiteExtract.ts`
- Test: `tests/unit/website-extract-create-node-response.test.ts`

**Step 1: Run focused verification**

Run: `npm test -- tests/unit/website-extract-create-node-response.test.ts`

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS
