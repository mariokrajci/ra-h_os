# Podcast Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `writing-plans` before implementation, then `executing-plans` if implementation is approved.

**Goal:** Align podcast ingestion with the clarified field model:

- `description` = short grounding
- `notes` = AI-seeded editable synthesis from full source
- `chunk` = raw source transcript/evidence

Embeddings should run only after final source-backed notes exist. No normal-path re-embedding.

---

## Scope

This plan updates the current lightweight podcast workflow only:

- keep podcast URL resolution
- keep transcript discovery via RSS / Podscripts / publisher page / Podcast Index
- remove ingestion-stage redundancy
- fix the missing embedding trigger after transcript discovery
- introduce source-grounded notes generation

This plan does **not** reintroduce:

- transformers.js
- OpenAI transcription
- ASR UI
- audio transcription fallback

---

## Desired End State

For a successful podcast import:

1. Node is created from resolved metadata
2. Transcript is discovered and written to `chunk`
3. `notes` are generated from the transcript
4. Embeddings run once using final content
5. `chunk_status` ends at `chunked`

For a failed transcript import:

1. Node still exists with metadata
2. `source_status = failed` in metadata
3. no transcript-backed notes are generated
4. embeddings do not run on incomplete source state

---

## Task 1: Document and encode ingestion-stage state

**Files:**
- Modify: `src/services/typescript/extractors/podcast.ts`
- Modify: `src/services/typescript/extractors/podcast-transcript.ts`
- Modify: `src/types/database.ts` if needed

**Changes:**
- Add conceptual state fields into `metadata`:
  - `source_status: 'pending' | 'available' | 'failed'`
  - `notes_status: 'pending' | 'available' | 'failed'`
- Keep `transcript_status` only for transcript discovery state if still useful
- Keep `chunk_status` strictly for embedding/chunking state

**Acceptance criteria:**
- A new podcast node clearly distinguishes:
  - source availability
  - notes generation
  - chunk embedding state

---

## Task 2: Stop treating metadata descriptions as final content

**Files:**
- Modify: `src/tools/other/podcastExtract.ts`
- Modify: `src/services/typescript/extractors/podcast.ts`

**Changes:**
- Keep short `description` generation from metadata
- Do not treat metadata description as final `notes`
- Create the node with:
  - `description`
  - `link`
  - `metadata`
  - `chunk` only when a real source is already available
- Ensure node creation does not prematurely imply transcript-backed readiness

**Acceptance criteria:**
- Podcast nodes are not considered content-ready just because episode metadata exists

---

## Task 3: Add shared source-grounded notes synthesis

**Files:**
- Create: `src/services/ingestion/generateSourceNotes.ts`
- Add tests for this service

**Changes:**
- Implement one shared AI call that generates editable synthesis notes from:
  - node title
  - source type / metadata
  - full `chunk`
- Keep the prompt focused on:
  - what this source says
  - main claims / themes / takeaways
  - useful structure for later human editing

**Acceptance criteria:**
- Notes are generated only when full source text is available
- Notes are source-grounded, not metadata-fragment summaries

---

## Task 4: Complete the podcast transcript pipeline

**Files:**
- Modify: `src/services/typescript/extractors/podcast-transcript.ts`

**Changes:**
- After transcript discovery succeeds:
  1. write transcript to `chunk`
  2. mark `source_status = 'available'`
  3. call `generateSourceNotes(...)`
  4. write generated notes
  5. mark `notes_status = 'available'`
  6. enqueue embeddings once
- On failure:
  - mark `source_status = 'failed'`
  - mark `notes_status = 'failed'`
  - do not enqueue embeddings

**Acceptance criteria:**
- Successful transcript discovery produces:
  - final `chunk`
  - synthesized `notes`
  - one queued embedding pass
- Failed transcript discovery does not leave the node in a misleading partially-ready state

---

## Task 5: Defer embeddings until final ingestion content exists

**Files:**
- Modify: `app/api/nodes/route.ts`
- Modify: `app/api/nodes/[id]/route.ts`
- Modify: `src/services/embedding/autoEmbedQueue.ts`

**Changes:**
- For podcast nodes, auto-embedding should wait until:
  - `source_status = 'available'`
  - `notes_status = 'available'`
  - `chunk` exists
  - `chunk_status = 'not_chunked'`
- Avoid auto-embedding on early metadata-only creation
- Allow explicit user-triggered embedding for exceptional cases if needed

**Acceptance criteria:**
- The normal successful import path runs embeddings once only
- Nodes do not bounce through unnecessary `not_chunked -> chunked -> not_chunked` cycles

---

## Task 6: Remove embedding-time AI analysis

**Files:**
- Modify: `src/services/typescript/embed-nodes.ts`
- Update any tests affected

**Changes:**
- Remove `analyzeNodeWithAI(...)`
- Node embeddings should use only stored node fields:
  - `title`
  - `description`
  - `notes`
  - `dimensions`

**Acceptance criteria:**
- Embedding no longer performs an additional semantic interpretation pass
- AI usage becomes easier to reason about:
  - metadata AI
  - notes synthesis AI
  - embedding model

---

## Task 7: Verify resulting workflow end-to-end

**Files / areas:**
- podcast import path
- database table view
- focus panel
- usage logging

**Checks:**
1. Add a podcast URL
2. Confirm node is created
3. Confirm transcript lands in `chunk`
4. Confirm notes are generated from transcript
5. Confirm `chunk_status` becomes `chunked`
6. Confirm embeddings run once after notes are ready
7. Confirm usage reflects:
   - metadata AI call
   - notes synthesis AI call
   - node embedding
   - chunk embeddings

**Acceptance criteria:**
- No residual “stuck at `not_chunked`” state after successful transcript import
- Notes are populated consistently
- AI usage stages are understandable and non-duplicative

---

## Task 8: Prepare follow-on normalization for other source types

**Files:**
- none required in this task unless explicitly continued

**Deliverable:**
- A short follow-up plan for applying the same model to:
  - website
  - YouTube
  - PDF

**Rationale:**
- Podcasts are the pilot
- the same field semantics should later become system-wide

---

## Open Questions

1. Should metadata-only podcast nodes still receive a minimal node embedding before source exists?
   - Recommendation: no

2. Should notes synthesis failures block embeddings entirely?
   - Recommendation: yes in the normalized ingestion path, because notes are part of the final node representation

3. Should the UI copy for Notes be updated in the same implementation pass?
   - Recommendation: yes if low effort, otherwise immediately after

---

## Success Criteria Summary

1. Podcast nodes use:
   - `description` for identity
   - `notes` for AI-seeded editable synthesis
   - `chunk` for raw transcript evidence
2. Transcript success results in one final embedding pass, not a later corrective re-embed
3. Podcast notes are grounded in transcript text, not metadata fragments
4. Embedding-time AI analysis is removed
5. The workflow becomes understandable end-to-end
