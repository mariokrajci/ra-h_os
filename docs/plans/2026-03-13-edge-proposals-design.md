# Edge Proposals Design

## Goal
Make edge creation feel frictionless by turning manual connection creation into an approval workflow inside the existing `Edges` tab.

## Scope
- In scope: edge proposal generation, `Edges` tab suggestion UI, approve/dismiss actions, dismissal persistence, proposal fetching on note open.
- Out of scope: redesigning the overall panel layout, removing manual edge creation entirely, speculative auto-creation without user approval.

## Product Decision
- Every note should preload proposed connections.
- Proposals must only appear inside the existing `Edges` tab.
- The default user action should be `Approve` or `Dismiss`, not manual search/create.

## Current State
- The chain button and `Edges` tab both open the edges view in [src/components/focus/FocusPanel.tsx](/home/mario/srv/apps/ra-h_os/src/components/focus/FocusPanel.tsx), but users still need to manually create edges.
- [src/services/agents/autoEdge.ts](/home/mario/srv/apps/ra-h_os/src/services/agents/autoEdge.ts) already contains conservative local matching logic:
  - extract candidate entities from note descriptions
  - exact-match those candidates against existing node titles
  - skip self-links and existing edges
- [src/services/database/edges.ts](/home/mario/srv/apps/ra-h_os/src/services/database/edges.ts) already handles explanation generation and edge-type inference when an edge is actually created.

## Architecture
- Reuse the existing local heuristic matching from `autoEdge`, but change it to return proposal objects instead of creating edges directly.
- Add a small proposals API for fetching note-specific suggestions and another API action for dismissing suggestions.
- Preload proposals whenever a note becomes active, cache them per note in the focus panel, and render them at the top of the `Edges` tab.
- Keep actual edge creation on the existing `/api/edges` path so approved suggestions still use the current inference pipeline.

## Suggestion Logic
- Proposal generation should be local and deterministic, not an AI API call.
- The proposal engine should:
  - inspect the active note description
  - extract candidate entities using the existing regex/heuristic rules
  - resolve exact title matches against existing nodes
  - filter out the active node itself
  - filter out already-existing edges
  - filter out previously dismissed source-target pairs
- AI should only be involved after approval, when the edge is created and the backend infers explanation/type/direction as it already does today.

## Data Flow

### Proposal fetch
1. User opens a note.
2. The focus panel triggers a background request for edge proposals for that note.
3. The backend returns a short ordered list of proposals that are not already edges and have not been dismissed.
4. The UI stores those proposals in note-scoped state.

### Approve
1. User opens the `Edges` tab.
2. The top section shows `Suggested connections`.
3. User clicks `Approve` on a proposal.
4. The UI calls the existing `/api/edges` POST endpoint with the source and target IDs.
5. The proposal disappears from the suggestions list and confirmed edges refresh.

### Dismiss
1. User clicks `Dismiss`.
2. The UI removes the proposal immediately.
3. The backend persists the dismissal for that source-target pair so it does not keep reappearing.

## UI Behavior
- Add a `Suggested connections` section at the top of the `Edges` tab in [src/components/focus/FocusPanel.tsx](/home/mario/srv/apps/ra-h_os/src/components/focus/FocusPanel.tsx).
- Each suggestion card should include:
  - target node title
  - short reason/explanation
  - `Approve` button
  - `Dismiss` button
- Below suggestions, keep the current confirmed edges list unchanged.
- If there are no suggestions, the tab should render as it does today.
- Manual create/search should remain available as a fallback, but visually secondary to suggestions.

## State Rules
- Suggestions are per active note.
- Switching tabs should not refetch proposals for the same note unless the cache is stale.
- Switching to a different note should trigger a new fetch.
- Approve and dismiss should optimistically remove the proposal from the visible list.
- On request failure, the proposal should be restored and a lightweight error shown.

## Persistence
- Persist dismissals in SQLite using a lightweight table keyed by source and target note IDs.
- Proposed schema:
  - `source_node_id` INTEGER NOT NULL
  - `target_node_id` INTEGER NOT NULL
  - `dismissed_at` TEXT NOT NULL
- Unique index on `(source_node_id, target_node_id)`.

## API Shape
- `GET /api/nodes/[id]/edge-proposals`
  - Returns proposals for a single note.
- `POST /api/nodes/[id]/edge-proposals/dismiss`
  - Persists dismissal of a source-target proposal pair.

## Error Handling
- Proposal fetch failures should not block note rendering.
- If proposal loading fails, the `Edges` tab should still show confirmed edges.
- If approval fails, restore the proposal and show an inline or lightweight error.
- If dismissal fails, restore the proposal and show an inline or lightweight error.

## Testing Strategy
- Unit tests for proposal extraction/filtering logic.
- API tests for proposal fetch and dismissal persistence.
- UI tests for `Suggested connections` rendering, approve, dismiss, optimistic updates, and edge refresh behavior.

## Risks And Guardrails
- Over-eager suggestions can erode trust, so the matcher should stay conservative and local.
- Large node counts could make exact-match scans expensive; for now this is acceptable if reused from existing behavior, but the service should be isolated so it can be optimized later.
- Suggestions should not create edges automatically; approval remains the trust boundary.
