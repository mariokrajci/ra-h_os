# Edge Proposals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add note-specific edge proposals that preload on note open and appear inside the `Edges` tab, where users can approve or dismiss suggested connections.

**Architecture:** Extract the existing local auto-edge heuristics into a reusable proposal service, expose it through note-scoped API routes, and render the results in the focus panel above the confirmed edge list. Approval reuses the existing edge-creation endpoint, while dismissal is persisted in SQLite so rejected suggestions do not return.

**Tech Stack:** Next.js route handlers, React/TypeScript, SQLite via the existing database layer, Vitest.

---

### Task 1: Add dismissal persistence schema

**Files:**
- Modify: `src/services/database/sqlite-client.ts`
- Test: `tests/unit/edgeProposalDismissalsSchema.test.ts`

**Step 1: Write the failing test**
```ts
it('creates edge proposal dismissals table with unique source-target index', () => {
  // initialize sqlite bootstrap
  // assert table exists
  // assert unique index on source_node_id + target_node_id
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/unit/edgeProposalDismissalsSchema.test.ts`
Expected: FAIL because the table and index do not exist yet.

**Step 3: Write minimal implementation**
- Add an idempotent table bootstrap for `edge_proposal_dismissals`.
- Add the unique composite index.

**Step 4: Run test to verify it passes**
Run: `npm test -- tests/unit/edgeProposalDismissalsSchema.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/services/database/sqlite-client.ts tests/unit/edgeProposalDismissalsSchema.test.ts
git commit -m "feat(db): add edge proposal dismissals table"
```

### Task 2: Extract reusable proposal generation service

**Files:**
- Modify: `src/services/agents/autoEdge.ts`
- Create: `src/services/edges/proposals.ts`
- Test: `tests/unit/edgeProposals.test.ts`

**Step 1: Write the failing tests**
- Returns proposals from note descriptions using the current local heuristics.
- Excludes self-links.
- Excludes already-existing edges.
- Excludes dismissed source-target pairs.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/unit/edgeProposals.test.ts`
Expected: FAIL because the reusable proposal service does not exist yet.

**Step 3: Write minimal implementation**
- Move candidate extraction and entity matching into `src/services/edges/proposals.ts`.
- Return proposal objects instead of creating edges.
- Keep `autoEdge.ts` as a consumer of the shared logic if it still needs automatic flows elsewhere.

**Step 4: Run tests to verify they pass**
Run: `npm test -- tests/unit/edgeProposals.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/services/agents/autoEdge.ts src/services/edges/proposals.ts tests/unit/edgeProposals.test.ts
git commit -m "feat(edges): add reusable edge proposal service"
```

### Task 3: Add dismissal data access helpers

**Files:**
- Create: `src/services/edges/proposalDismissals.ts`
- Test: `tests/unit/edgeProposalDismissals.test.ts`

**Step 1: Write the failing tests**
- Saves a dismissal for a source-target pair.
- Returns dismissed targets for a source note.
- Upserts instead of duplicating the same pair.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/unit/edgeProposalDismissals.test.ts`
Expected: FAIL because the dismissal service does not exist yet.

**Step 3: Write minimal implementation**
- Add helper methods to insert/upsert dismissals.
- Add a lookup method for dismissed target IDs by source note.

**Step 4: Run tests to verify they pass**
Run: `npm test -- tests/unit/edgeProposalDismissals.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/services/edges/proposalDismissals.ts tests/unit/edgeProposalDismissals.test.ts
git commit -m "feat(edges): add proposal dismissal service"
```

### Task 4: Add note-scoped proposals API

**Files:**
- Create: `app/api/nodes/[id]/edge-proposals/route.ts`
- Test: `tests/api/node-edge-proposals-route.test.ts`

**Step 1: Write the failing API tests**
- Returns proposals for a valid note.
- Excludes dismissed pairs.
- Excludes already-existing edges.
- Returns `404` when the note does not exist.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/api/node-edge-proposals-route.test.ts`
Expected: FAIL because the route does not exist yet.

**Step 3: Write minimal implementation**
- Resolve the note ID.
- Load dismissed targets for that note.
- Generate proposals and serialize them for the client.

**Step 4: Run tests to verify they pass**
Run: `npm test -- tests/api/node-edge-proposals-route.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add app/api/nodes/[id]/edge-proposals/route.ts tests/api/node-edge-proposals-route.test.ts
git commit -m "feat(api): add edge proposals endpoint"
```

### Task 5: Add dismissal API

**Files:**
- Create: `app/api/nodes/[id]/edge-proposals/dismiss/route.ts`
- Test: `tests/api/node-edge-proposals-dismiss-route.test.ts`

**Step 1: Write the failing API tests**
- Persists dismissal for a source-target pair.
- Rejects invalid target IDs.
- Returns `404` when the source note does not exist.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/api/node-edge-proposals-dismiss-route.test.ts`
Expected: FAIL because the route does not exist yet.

**Step 3: Write minimal implementation**
- Validate source note and target ID.
- Upsert the dismissal row.
- Return a simple success payload.

**Step 4: Run tests to verify they pass**
Run: `npm test -- tests/api/node-edge-proposals-dismiss-route.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add app/api/nodes/[id]/edge-proposals/dismiss/route.ts tests/api/node-edge-proposals-dismiss-route.test.ts
git commit -m "feat(api): add edge proposal dismissal endpoint"
```

### Task 6: Add focus panel proposal state and prefetching

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx`
- Test: `tests/unit/focusPanelEdgeProposals.test.tsx`

**Step 1: Write the failing UI tests**
- Fetches proposals when the active note changes.
- Stores proposals per note.
- Does not block normal edge rendering when proposal fetch fails.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/unit/focusPanelEdgeProposals.test.tsx`
Expected: FAIL because the proposal state and fetch flow do not exist yet.

**Step 3: Write minimal implementation**
- Add note-scoped proposal loading state.
- Trigger proposal fetch when `activeNodeId` changes.
- Cache results in component state keyed by note ID.

**Step 4: Run tests to verify they pass**
Run: `npm test -- tests/unit/focusPanelEdgeProposals.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/focus/FocusPanel.tsx tests/unit/focusPanelEdgeProposals.test.tsx
git commit -m "feat(ui): preload edge proposals per note"
```

### Task 7: Render `Suggested connections` in the `Edges` tab

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx`
- Test: `tests/unit/focusPanelEdgeProposals.test.tsx`

**Step 1: Extend the failing UI tests**
- Renders `Suggested connections` at the top of the `Edges` tab.
- Shows target title and explanation.
- Falls back to the existing edge list when there are no proposals.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/unit/focusPanelEdgeProposals.test.tsx`
Expected: FAIL on the new rendering assertions.

**Step 3: Write minimal implementation**
- Add a suggestions section above the confirmed edges list.
- Keep manual create/search visible but secondary.

**Step 4: Run tests to verify they pass**
Run: `npm test -- tests/unit/focusPanelEdgeProposals.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/focus/FocusPanel.tsx tests/unit/focusPanelEdgeProposals.test.tsx
git commit -m "feat(ui): show suggested connections in edges tab"
```

### Task 8: Wire approve and dismiss actions

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx`
- Test: `tests/unit/focusPanelEdgeProposals.test.tsx`

**Step 1: Extend the failing UI tests**
- `Approve` creates the edge and removes the proposal.
- `Dismiss` persists dismissal and removes the proposal.
- Failed approve or dismiss restores the proposal.

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/unit/focusPanelEdgeProposals.test.tsx`
Expected: FAIL on action behavior.

**Step 3: Write minimal implementation**
- Add optimistic approve and dismiss handlers.
- Reuse `/api/edges` for approval.
- Use the dismissal API for rejection.
- Refresh confirmed edges after approval succeeds.

**Step 4: Run tests to verify they pass**
Run: `npm test -- tests/unit/focusPanelEdgeProposals.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/focus/FocusPanel.tsx tests/unit/focusPanelEdgeProposals.test.tsx
git commit -m "feat(ui): add approve and dismiss edge proposal actions"
```

### Task 9: Update docs for the new workflow

**Files:**
- Modify: `USER_GUIDE.md`
- Modify: `docs/6_ui.md`

**Step 1: Write the doc changes**
- Explain that suggested connections now appear in the `Edges` tab.
- Explain approve vs dismiss behavior.
- Keep manual creation documented as fallback behavior.

**Step 2: Run a quick doc sanity pass**
Run: `rg -n "Edges tab|Suggested connections|Approve|Dismiss" USER_GUIDE.md docs/6_ui.md`
Expected: the new workflow is described in both docs.

**Step 3: Commit**
```bash
git add USER_GUIDE.md docs/6_ui.md
git commit -m "docs: document edges tab suggestions workflow"
```

### Task 10: Run required verification

**Files:**
- No code changes.

**Step 1: Run targeted tests**
Run:
- `npm test -- tests/unit/edgeProposals.test.ts`
- `npm test -- tests/unit/edgeProposalDismissals.test.ts`
- `npm test -- tests/api/node-edge-proposals-route.test.ts`
- `npm test -- tests/api/node-edge-proposals-dismiss-route.test.ts`
- `npm test -- tests/unit/focusPanelEdgeProposals.test.tsx`
Expected: PASS.

**Step 2: Run repo checks**
Run:
- `npm run type-check`
- `npm run lint`
- `npm run build`
Expected: PASS.

**Step 3: Commit**
```bash
git add .
git commit -m "feat: add edge proposals in edges tab"
```
