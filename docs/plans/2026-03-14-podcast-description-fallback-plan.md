# Podcast Description Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep podcast imports on their custom AI-first description path, but route fallback description generation through `/api/nodes` instead of using `${podcast_name} — ${episodeTitle}`.

**Architecture:** Add a focused tool test that covers both branches: AI description present vs absent. When absent, the podcast tool should omit `description` from the create-node request and let the shared API description generator handle fallback.

**Tech Stack:** TypeScript, Vitest, Next.js API routes

---

### Task 1: Add failing regression coverage

**Files:**
- Create: `tests/unit/podcast-extract-create-node-response.test.ts`
- Modify: `src/tools/other/podcastExtract.ts`

**Step 1: Write the failing test**

Cover:
- AI success branch still sends `description`
- AI fallback branch omits `description`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/podcast-extract-create-node-response.test.ts`
Expected: FAIL because the fallback branch currently sends `${meta.podcast_name} — ${episodeTitle}`.

**Step 3: Write minimal implementation**

Conditionally include `description` in the create payload only when `ai.nodeDescription` exists.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/podcast-extract-create-node-response.test.ts`
Expected: PASS

### Task 2: Verify

**Files:**
- Modify: `src/tools/other/podcastExtract.ts`

**Step 1: Run focused test**

Run: `npm test -- tests/unit/podcast-extract-create-node-response.test.ts`

**Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS
