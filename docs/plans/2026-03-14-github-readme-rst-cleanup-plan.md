# GitHub README RST Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make GitHub README source extraction store cleaned Markdown-like content for `.rst` READMEs, without badges and image boilerplate.

**Architecture:** Keep the existing GitHub README API extraction path, but add a narrow reStructuredText normalization step in the website extractor. The normalization strips badge/image substitution blocks and converts the most common readable RST structures into Markdown-like text before the source is stored.

**Tech Stack:** TypeScript, Next.js services, Vitest

---

### Task 1: Add failing regression coverage for GitHub README RST cleanup

**Files:**
- Modify: `tests/unit/websiteExtractorClean.test.ts`
- Test: `tests/unit/websiteExtractorClean.test.ts`

**Step 1: Write the failing test**

Add a test fixture with a GitHub-style `README.rst` snippet containing substitution badges, `.. image::` directives, RST links, headings, and `.. code:: bash`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/websiteExtractorClean.test.ts`
Expected: FAIL because the current extractor preserves badge/image directive noise and does not convert the RST structures into Markdown-like content.

**Step 3: Write minimal implementation**

Add an exported RST cleanup helper in `src/services/typescript/extractors/website.ts` and keep the implementation limited to the patterns covered by GitHub README ingestion.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/websiteExtractorClean.test.ts`
Expected: PASS

### Task 2: Apply RST cleanup in GitHub README extraction

**Files:**
- Modify: `src/services/typescript/extractors/website.ts`
- Test: `tests/unit/websiteExtractorClean.test.ts`

**Step 1: Wire the helper into GitHub README extraction**

Detect `.rst` README payloads from the GitHub API metadata and normalize them before assigning `chunk`.

**Step 2: Preserve markdown behavior**

Leave existing Markdown README handling unchanged except for shared cleanup behavior that remains safe for `.md`.

**Step 3: Run focused verification**

Run: `npm test -- tests/unit/websiteExtractorClean.test.ts`
Expected: PASS

### Task 3: Verify ingestion-facing behavior

**Files:**
- Modify: `src/services/typescript/extractors/website.ts`
- Test: `src/services/ingestion/__tests__/finalizeSourceNode.test.ts`

**Step 1: Run related tests**

Run: `npm test -- src/services/ingestion/__tests__/finalizeSourceNode.test.ts`
Expected: PASS

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS with existing repo warnings only
