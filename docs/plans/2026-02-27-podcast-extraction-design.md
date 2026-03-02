# Podcast Extraction Design

**Date:** 2026-02-27
**Status:** Updated

---

## Problem

Podcast ingestion currently creates a node from partial metadata, may later replace `chunk` with a transcript, and can leave the node in an inconsistent state:

- `chunk` changes after creation but embeddings may not rerun
- `notes` are empty for podcasts and inconsistently used across other source types
- AI is sometimes called on fragments before the full source is available

This makes the field semantics unclear and creates avoidable pipeline churn.

---

## Clarified Field Semantics

The design standardizes the three main node content fields:

- `description`
  - short identity/grounding text
  - answers: "what is this and why does it matter?"
  - can be generated from metadata

- `notes`
  - AI-seeded editable synthesis
  - must be generated from the full available source, not metadata fragments
  - user can freely revise and extend it later

- `chunk`
  - raw extracted source content
  - transcript, webpage body, README, PDF text, etc.
  - remains the evidence layer and the input for chunk embeddings

This is a deliberate product change from the earlier docs that described `notes` as purely user-authored.

---

## Approach

Use a source-first, notes-second, embeddings-last pipeline:

1. Resolve URL and extract metadata
2. Extract the best full source content available
3. Generate `notes` from that full source
4. Run embeddings once final content exists

This removes the normal-path need for re-embedding.

---

## Architecture

### Existing files retained

- `src/services/typescript/extractors/podcast.ts`
  - sync URL resolution and metadata extraction
- `src/services/typescript/extractors/podcast-transcript.ts`
  - transcript discovery
- `src/tools/other/podcastExtract.ts`
  - tool wrapper for Quick Add / agents

### New shared responsibility

Add a shared notes synthesis step, reusable across podcasts, websites, YouTube, and PDFs:

- `src/services/ingestion/generateSourceNotes.ts`
  - input: title, metadata, full `chunk`
  - output: AI-seeded `notes`

This becomes the single source-grounded synthesis step.

---

## Normalized Ingestion Flow

### Podcast target flow

1. User pastes a Spotify / Apple / Pocket Casts / RSS / episode URL
2. `podcast.ts` resolves metadata:
   - `podcast_name`
   - `episode_title`
   - `rss_feed_url`
   - `audio_url`
   - `published_at`
   - `description` candidate
3. Node is created with:
   - `title`
   - short `description`
   - `link`
   - `metadata`
   - no final `notes` yet
   - `chunk` only if a reliable source is already available
4. `podcast-transcript.ts` discovers transcript text
5. When transcript is found:
   - write transcript to `chunk`
   - generate AI-seeded `notes` from transcript
   - mark source as available
   - enqueue embeddings once
6. If transcript discovery fails:
   - mark source unavailable
   - node remains metadata-only until retried or manually enriched

### Embedding order

Embeddings must begin only after the node has its final ingestion-stage content:

- `chunk` populated with final source
- `notes` generated from full source

Then run:

1. node embedding
2. chunk embeddings

No normal-path re-embedding is expected after this.

---

## Embedding Model

The existing two-layer embedding architecture remains valid:

1. **Node-level embedding**
   - one embedding per node
   - built from:
     - `title`
     - `description`
     - `notes`
     - `dimensions`

2. **Chunk-level embeddings**
   - many embeddings per node
   - built from `chunk`

The key change is timing:

- do not start embeddings when only metadata fragments exist
- wait until `notes` and `chunk` are in their final ingestion state

---

## AI Usage Model

### Keep

- one lightweight metadata AI call, if needed, for:
  - concise `description`
  - optional tags/dimensions

- one source-grounded synthesis call for:
  - `notes`

### Remove

- generic AI analysis during embedding
- fragment-based note generation before full source exists

This keeps the roles distinct:

- metadata AI = identification
- source AI = synthesis
- embeddings = retrieval

---

## State Model

The current `chunk_status` alone is not enough to describe the ingestion lifecycle.

Introduce explicit conceptual states:

- `source_status`
  - `pending | available | failed`

- `notes_status`
  - `pending | available | failed`

- `chunk_status`
  - remains embedding-focused
  - `not_chunked | chunking | chunked | error`

If schema/UI changes are deferred, these can live in `metadata` first.

---

## Re-embedding Rules

### Should not happen in the normal ingestion path

If source extraction succeeds and notes generation succeeds, embeddings should run once only.

### Should happen only for true follow-up changes

- user edits `notes`
- user edits `chunk`
- transcript/source extraction failed earlier and later succeeds
- notes are intentionally regenerated

---

## Migration Implications

This design is not podcast-only. It defines a consistent model for all source-backed nodes:

- website
- YouTube
- podcast
- PDF
- GitHub README / other extracted documents

All should converge toward:

1. extract source
2. synthesize notes from source
3. embed once

---

## Acceptance Criteria

1. Podcast nodes never finish transcript discovery with `chunk_status = not_chunked` unless an embed job is actually queued.
2. Podcast `notes` are synthesized from transcript text, not from episode metadata alone.
3. Node embedding no longer depends on a second AI analysis step at embedding time.
4. The documented field semantics are clear:
   - `description` = short grounding
   - `notes` = AI-seeded editable synthesis
   - `chunk` = raw source
5. The same conceptual model can be applied to website / YouTube / PDF flows next.

---

## Out of Scope

- Feed subscriptions and recurring podcast sync
- Speaker diarization
- Chapter-aware transcript structuring
- Audio transcription fallback reintroduction
- Full UI copy update in this design pass
