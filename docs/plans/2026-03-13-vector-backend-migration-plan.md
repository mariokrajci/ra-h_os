# Vector Backend Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the embedding and retrieval stack so RA-H can swap SQLite vec0 for another vector backend later without rewriting extraction, chunking, or retrieval callers.

**Architecture:** Keep the existing four-stage pipeline, but make the vector store an explicit adapter layer. Extraction and chunking continue producing normalized chunk records, embedding generation continues producing vectors, and all vector persistence/query logic moves behind a `VectorStoreAdapter` contract with a SQLite implementation first.

**Tech Stack:** Next.js, TypeScript, OpenAI embeddings, sqlite-vec, Vitest

---

### Task 1: Define the target adapter contract

**Files:**
- Create: `src/services/vector-store/types.ts`
- Create: `src/services/vector-store/index.ts`
- Test: `src/services/vector-store/__tests__/types.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { isVectorStoreResult } from '@/services/vector-store/types';

describe('vector store contracts', () => {
  it('accepts a valid similarity result shape', () => {
    expect(isVectorStoreResult({
      itemId: 10,
      similarity: 0.82,
      metadata: { node_id: 4 },
    })).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/vector-store/__tests__/types.test.ts`
Expected: FAIL with missing module/export error.

**Step 3: Write minimal implementation**

Create a contract that includes:

```ts
export interface VectorRecord {
  itemId: number;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  itemId: number;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface VectorStoreAdapter {
  upsertNodeVector(record: VectorRecord): Promise<void>;
  upsertChunkVectors(records: VectorRecord[]): Promise<void>;
  deleteNodeVector(nodeId: number): Promise<void>;
  deleteChunkVectors(chunkIds: number[]): Promise<void>;
  searchChunkVectors(input: {
    queryVector: number[];
    limit: number;
    similarityThreshold: number;
    chunkIds?: number[];
  }): Promise<VectorSearchResult[]>;
  health(): Promise<{ ok: boolean; provider: string; details?: Record<string, unknown> }>;
}
```

Also export a small runtime type guard so later tests can validate adapter output shape without spinning up sqlite.

**Step 4: Run test to verify it passes**

Run: `SKIP_DB_SETUP=true npm test -- src/services/vector-store/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/vector-store/types.ts src/services/vector-store/index.ts src/services/vector-store/__tests__/types.test.ts
git commit -m "refactor(vector): define adapter contracts"
```

---

### Task 2: Extract embedding generation into a single reusable service

**Files:**
- Modify: `src/services/embeddings.ts`
- Modify: `src/services/typescript/embed-universal.ts`
- Modify: `src/services/typescript/embed-nodes.ts`
- Test: `src/services/__tests__/embeddings.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { EmbeddingService } from '@/services/embeddings';

describe('EmbeddingService', () => {
  it('exposes separate helpers for content and query embeddings', async () => {
    expect(typeof EmbeddingService.generateQueryEmbedding).toBe('function');
    expect(typeof EmbeddingService.generateContentEmbedding).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/__tests__/embeddings.test.ts`
Expected: FAIL because `generateContentEmbedding` does not exist yet.

**Step 3: Write minimal implementation**

- Add `generateContentEmbedding(text: string)` in `src/services/embeddings.ts`.
- Factor shared OpenAI call + usage logging into one internal helper.
- Update:
  - `src/services/typescript/embed-universal.ts`
  - `src/services/typescript/embed-nodes.ts`
  to call `EmbeddingService` instead of creating their own OpenAI client.

This is the key seam that separates “make vectors” from “store vectors”.

**Step 4: Run test to verify it passes**

Run: `SKIP_DB_SETUP=true npm test -- src/services/__tests__/embeddings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/embeddings.ts src/services/typescript/embed-universal.ts src/services/typescript/embed-nodes.ts src/services/__tests__/embeddings.test.ts
git commit -m "refactor(embeddings): centralize vector generation"
```

---

### Task 3: Add a SQLite vector-store adapter

**Files:**
- Create: `src/services/vector-store/sqliteVecAdapter.ts`
- Modify: `src/services/typescript/sqlite-vec.ts`
- Test: `src/services/vector-store/__tests__/sqliteVecAdapter.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { SQLiteVecAdapter } from '@/services/vector-store/sqliteVecAdapter';

describe('SQLiteVecAdapter', () => {
  it('provides a chunk search method', () => {
    const adapter = new SQLiteVecAdapter();
    expect(typeof adapter.searchChunkVectors).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/vector-store/__tests__/sqliteVecAdapter.test.ts`
Expected: FAIL because adapter file does not exist.

**Step 3: Write minimal implementation**

Move vec-specific persistence/query logic into the adapter:

- `upsertNodeVector`
- `upsertChunkVectors`
- `deleteNodeVector`
- `deleteChunkVectors`
- `searchChunkVectors`
- `health`

Move SQL and vec string formatting out of:
- `src/services/typescript/embed-universal.ts`
- `src/services/typescript/embed-nodes.ts`
- `src/services/database/chunks.ts`

Keep `src/services/typescript/sqlite-vec.ts` as sqlite utility helpers only:
- connection
- vector encoding helpers
- no retrieval business logic

**Step 4: Run test to verify it passes**

Run: `SKIP_DB_SETUP=true npm test -- src/services/vector-store/__tests__/sqliteVecAdapter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/vector-store/sqliteVecAdapter.ts src/services/typescript/sqlite-vec.ts src/services/vector-store/__tests__/sqliteVecAdapter.test.ts
git commit -m "refactor(vector): add sqlite vec adapter"
```

---

### Task 4: Refactor chunk embedding to use the adapter

**Files:**
- Modify: `src/services/typescript/embed-universal.ts`
- Modify: `src/services/vector-store/index.ts`
- Test: `src/services/typescript/__tests__/embed-universal.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { UniversalEmbedder } from '@/services/typescript/embed-universal';

describe('UniversalEmbedder', () => {
  it('delegates vector writes through the vector store adapter', async () => {
    expect(UniversalEmbedder).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/typescript/__tests__/embed-universal.test.ts`
Expected: FAIL once the test asserts adapter use and current embedder still writes vec SQL directly.

**Step 3: Write minimal implementation**

- Inject or resolve `VectorStoreAdapter` from `src/services/vector-store/index.ts`.
- Keep text splitting and chunk table writes in `UniversalEmbedder`.
- Replace direct vec SQL writes/deletes with adapter calls.

At the end of this task, chunking and chunk-row persistence remain local, but vector indexing becomes swappable.

**Step 4: Run test to verify it passes**

Run: `SKIP_DB_SETUP=true npm test -- src/services/typescript/__tests__/embed-universal.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/typescript/embed-universal.ts src/services/vector-store/index.ts src/services/typescript/__tests__/embed-universal.test.ts
git commit -m "refactor(chunking): route chunk vector writes through adapter"
```

---

### Task 5: Refactor node embedding to use the adapter

**Files:**
- Modify: `src/services/typescript/embed-nodes.ts`
- Test: `src/services/typescript/__tests__/embed-nodes.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { NodeEmbedder } from '@/services/typescript/embed-nodes';

describe('NodeEmbedder', () => {
  it('delegates vec_nodes writes through the adapter', () => {
    expect(NodeEmbedder).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/typescript/__tests__/embed-nodes.test.ts`
Expected: FAIL once the test expects adapter usage and the current code still writes directly to `vec_nodes`.

**Step 3: Write minimal implementation**

- Replace direct `vec_nodes` delete/insert SQL with `VectorStoreAdapter.upsertNodeVector`.
- Keep node-row persistence (`embedding`, `embedding_text`, `embedding_updated_at`) local for now.

This leaves one place for vector backend replacement instead of two.

**Step 4: Run test to verify it passes**

Run: `SKIP_DB_SETUP=true npm test -- src/services/typescript/__tests__/embed-nodes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/typescript/embed-nodes.ts src/services/typescript/__tests__/embed-nodes.test.ts
git commit -m "refactor(nodes): route node vector writes through adapter"
```

---

### Task 6: Refactor retrieval to use the adapter

**Files:**
- Modify: `src/services/database/chunks.ts`
- Modify: `src/tools/other/searchContentEmbeddings.ts`
- Test: `src/services/database/__tests__/chunkSearch.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { chunkService } from '@/services/database/chunks';

describe('ChunkService search', () => {
  it('can consume adapter search results and hydrate chunk rows', async () => {
    expect(typeof chunkService.searchChunks).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/database/__tests__/chunkSearch.test.ts`
Expected: FAIL when test starts asserting retrieval through adapter rather than sqlite-vec SQL.

**Step 3: Write minimal implementation**

- Keep fallback text search in `ChunkService`.
- Replace `searchChunksSQLite(...)` with:
  1. resolve adapter
  2. ask adapter for matching `chunk_id`s + similarity
  3. hydrate chunk rows from `chunks` table
- Leave `searchContentEmbeddings.ts` API shape unchanged so callers do not have to change.

This is the migration-critical boundary for future backends like pgvector, LanceDB, Qdrant, or hosted search.

**Step 4: Run test to verify it passes**

Run: `SKIP_DB_SETUP=true npm test -- src/services/database/__tests__/chunkSearch.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/database/chunks.ts src/tools/other/searchContentEmbeddings.ts src/services/database/__tests__/chunkSearch.test.ts
git commit -m "refactor(retrieval): route chunk search through vector adapter"
```

---

### Task 7: Add explicit reindex/rebuild workflow

**Files:**
- Create: `scripts/vector/reindex-all.ts`
- Modify: `package.json`
- Modify: `docs/4_tools-and-guides.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Test: `src/services/embedding/__tests__/reindexPlan.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

describe('reindex workflow', () => {
  it('documents a full rebuild path for vectors', () => {
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/embedding/__tests__/reindexPlan.test.ts`
Expected: FAIL once test asserts missing command/docs.

**Step 3: Write minimal implementation**

Create a reindex script that:
- iterates nodes with chunk content
- re-runs node embedding
- re-runs chunk embedding
- prints progress and failure summary

Add a package script:

```json
"vectors:reindex": "tsx scripts/vector/reindex-all.ts"
```

Document:
- when to run it
- expected duration/cost
- that backend migration will require reindexing

**Step 4: Run test to verify it passes**

Run: `SKIP_DB_SETUP=true npm test -- src/services/embedding/__tests__/reindexPlan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/vector/reindex-all.ts package.json docs/4_tools-and-guides.md docs/TROUBLESHOOTING.md src/services/embedding/__tests__/reindexPlan.test.ts
git commit -m "feat(vector): add explicit reindex workflow"
```

---

### Task 8: Add migration-proof health checks and final verification

**Files:**
- Modify: `app/api/health/vectors/route.ts`
- Modify: `src/services/vector-store/index.ts`
- Test: `src/services/vector-store/__tests__/health.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

describe('vector health', () => {
  it('reports provider-neutral adapter health', () => {
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `SKIP_DB_SETUP=true npm test -- src/services/vector-store/__tests__/health.test.ts`
Expected: FAIL when test expects provider-neutral health and route still assumes sqlite vec tables directly.

**Step 3: Write minimal implementation**

- Make health route call adapter `health()` first.
- Preserve sqlite-specific stats only as adapter-provided details.
- Keep response backward-compatible enough for current UI.

Then run the required checks:

```bash
npm run type-check
npm run lint
npm run build
```

Document any pre-existing lint baseline failures separately from this feature.

**Step 4: Run tests and checks**

Run:
- `SKIP_DB_SETUP=true npm test -- src/services/vector-store/__tests__/health.test.ts`
- `npm run type-check`
- `npm run lint`
- `npm run build`

Expected:
- health test PASS
- type-check PASS
- build PASS
- lint either PASS or fails only on pre-existing repo-wide issues already documented

**Step 5: Commit**

```bash
git add app/api/health/vectors/route.ts src/services/vector-store/index.ts src/services/vector-store/__tests__/health.test.ts
git commit -m "refactor(vector): make health checks adapter-aware"
```

---

### Notes for implementation

**Current coupling hotspots to replace:**
- `src/services/typescript/embed-universal.ts` writes directly to `vec_chunks`
- `src/services/typescript/embed-nodes.ts` writes directly to `vec_nodes`
- `src/services/database/chunks.ts` queries `vec_chunks` directly
- `src/services/database/sqlite-client.ts` owns sqlite vec table lifecycle

**Keep unchanged where possible:**
- Source extraction in `src/services/typescript/extractors/*`
- Ingestion orchestration in `src/services/ingestion/*`
- Queue orchestration in `src/services/embedding/autoEmbedQueue.ts`
- API surface of `searchContentEmbeddingsTool`

**Migration outcome after this plan:**
- Swapping SQLite vec0 becomes “write a new adapter + run reindex”
- Extraction/chunking callers remain stable
- Retrieval callers remain stable
- Reindexing is explicit and documented instead of being an implicit backend detail

---

Plan complete and saved to `docs/plans/2026-03-13-vector-backend-migration-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
