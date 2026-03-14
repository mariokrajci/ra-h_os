# Source Description Generation Follow-up Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make YouTube and PDF imports use the shared node description generation path instead of canned placeholder descriptions.

**Architecture:** Add focused request-payload regressions for each extraction tool, then remove the hardcoded `description` field from their create-node requests so `/api/nodes` can generate descriptions consistently.

**Tech Stack:** TypeScript, Next.js API routes, Vitest

---

### Task 1: Add YouTube regression

**Files:**
- Create: `tests/unit/youtube-extract-create-node-response.test.ts`
- Modify: `src/tools/other/youtubeExtract.ts`

**Step 1: Write the failing test**

Assert that the YouTube tool omits `description` while still sending title/link/metadata.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/youtube-extract-create-node-response.test.ts`
Expected: FAIL because the tool currently sends `YouTube video by ...`.

**Step 3: Write minimal implementation**

Remove the canned description builder from `src/tools/other/youtubeExtract.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/youtube-extract-create-node-response.test.ts`
Expected: PASS

### Task 2: Add PDF regression

**Files:**
- Create: `tests/unit/paper-extract-create-node-response.test.ts`
- Modify: `src/tools/other/paperExtract.ts`

**Step 1: Write the failing test**

Assert that the PDF tool omits `description` while still sending title/link/metadata.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/paper-extract-create-node-response.test.ts`
Expected: FAIL because the tool currently sends `PDF from ...`.

**Step 3: Write minimal implementation**

Remove the canned description builder from `src/tools/other/paperExtract.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/paper-extract-create-node-response.test.ts`
Expected: PASS

### Task 3: Verify

**Files:**
- Modify: `src/tools/other/youtubeExtract.ts`
- Modify: `src/tools/other/paperExtract.ts`

**Step 1: Run focused tests**

Run: `npm test -- tests/unit/youtube-extract-create-node-response.test.ts tests/unit/paper-extract-create-node-response.test.ts`

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS
