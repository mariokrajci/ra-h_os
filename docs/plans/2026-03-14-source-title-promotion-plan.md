# Source Title Promotion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote placeholder source titles like `Website: arcinstitute.org`, `volcengine/OpenViking`, and `PDF: 1234.5678` to stronger extracted titles after source ingestion completes.

**Architecture:** Keep fast placeholder titles at create time, then upgrade titles during finalization when extracted metadata is clearly better. For GitHub README imports, derive a human-facing title from the README heading instead of defaulting to `owner/repo`.

**Tech Stack:** TypeScript, Next.js services, Vitest

---

### Task 1: Add failing regressions for title promotion

**Files:**
- Modify: `src/services/ingestion/__tests__/finalizeSourceNode.test.ts`
- Create: `tests/unit/websiteExtractorClean.test.ts` (extend existing coverage)

**Step 1: Write the failing tests**

Add tests that prove:
- website finalization upgrades `Website: arcinstitute.org` to extracted page title
- PDF finalization upgrades `PDF: 1234.5678` to extracted document title
- GitHub README extraction derives a README title like `OpenViking: The Context Database for AI Agents`

**Step 2: Run tests to verify they fail**

Run:
- `npm test -- src/services/ingestion/__tests__/finalizeSourceNode.test.ts`
- `npm test -- tests/unit/websiteExtractorClean.test.ts`

Expected: FAIL because titles are not currently promoted and GitHub README titles still use `owner/repo`.

**Step 3: Write minimal implementation**

Add title-promotion helpers in:
- `src/services/ingestion/finalizeSourceNode.ts`
- `src/services/typescript/extractors/website.ts`

**Step 4: Run tests to verify they pass**

Run the same focused commands and expect PASS.

### Task 2: Verify

**Files:**
- Modify: `src/services/ingestion/finalizeSourceNode.ts`
- Modify: `src/services/typescript/extractors/website.ts`

**Step 1: Run focused tests**

Run:
- `npm test -- src/services/ingestion/__tests__/finalizeSourceNode.test.ts`
- `npm test -- tests/unit/websiteExtractorClean.test.ts`

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS
