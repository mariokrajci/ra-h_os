# Node Flags & Privacy — Design

**Date:** 2026-03-14
**Status:** Approved

## Problem

No lightweight way to track workflow state per node (e.g. "to read", "active") or to prevent sensitive nodes from being exposed to MCP agents.

## Solution

Two orthogonal features built together:

1. **User-defined flags** — free-form, unordered workflow tags per node, filterable in the feed
2. **Node privacy** — `is_private` column, enforced via a `public_nodes` SQLite view across all MCP access paths

---

## Schema

```sql
-- User-defined flag vocabulary (managed in Settings)
CREATE TABLE flags (
  name       TEXT PRIMARY KEY,
  color      TEXT NOT NULL DEFAULT '#6b7280',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Node ↔ flag assignments (many-to-many)
CREATE TABLE node_flags (
  node_id    INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  flag       TEXT    NOT NULL REFERENCES flags(name) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (node_id, flag)
);

-- Privacy column on nodes
ALTER TABLE nodes ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;

-- MCP enforcement: all agent-facing queries use this view
CREATE VIEW public_nodes AS SELECT * FROM nodes WHERE is_private = 0;
```

Runtime migration in `sqlite-client.ts` handles existing databases:
- `ADD COLUMN is_private` if missing
- `CREATE TABLE IF NOT EXISTS flags`
- `CREATE TABLE IF NOT EXISTS node_flags`
- `CREATE VIEW IF NOT EXISTS public_nodes`

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/flags` | List all user-defined flags |
| POST | `/api/flags` | Create flag `{ name, color }` |
| DELETE | `/api/flags/[name]` | Delete flag (cascades to node_flags) |
| GET | `/api/nodes/[id]/flags` | Get flags assigned to a node |
| POST | `/api/nodes/[id]/flags` | Assign flag `{ flag }` to node |
| DELETE | `/api/nodes/[id]/flags/[flag]` | Remove flag from node |
| PATCH | `/api/nodes/[id]` | Already exists — extend to accept `is_private` |

---

## MCP Enforcement

All MCP access paths replace `FROM nodes` with `FROM public_nodes`:

**`src/tools/database/`:**
- `queryNodes.ts`
- `getNodesById.ts`
- `queryDimensionNodes.ts`
- `updateNode.ts` (read check before update)
- `queryEdge.ts` (node title joins)

**`apps/mcp-server-standalone/services/nodeService.js`:**
- All `FROM nodes` queries → `FROM public_nodes`

**Additional exclusions:**
- Semantic/embedding search results (`src/services/database/`)
- Auto-context injection (`src/services/context/autoContext.ts`)

---

## Filter Bar (ViewFilters.tsx)

**Bug fix:** Move the Filter button to the left (before chips) so it stays pinned as filters are added. Chips grow rightward.

```
[ ▽ Filter ]  [ + projects × ]  [ + research × ]  [ 🔖 urgent × ]   AND
```

**Flag filter support:**
- Extend `ViewFilter` type: add `type: 'dimension' | 'flag'`
- Filter picker dropdown gains two sections: **Dimensions** and **Flags**
- Flag chips styled with user-defined flag color (not the green accent used for dimensions)
- Node list queries join `node_flags` when flag filters are active

---

## Per-Node UI (FocusPanel)

- Flag chips rendered in the same row as dimension chips, visually distinct (user-defined color + small bookmark icon)
- `+` dropdown next to chips to assign an available flag (same pattern as existing dimension `+`)
- Click chip to remove assignment
- **Privacy toggle:** lock icon in node header — `Lock` (filled) = private, `LockOpen` = public. Tooltip: "Private — hidden from MCP agents" / "Public"

---

## Settings UI

New **Flags** tab in Settings modal:
- List of defined flags: color swatch · name · delete button
- Delete confirmation: "This will remove the flag from X nodes"
- "New flag" inline form at bottom: text input + color palette (~8 presets) + Add button

---

## Files to Touch

| File | Change |
|------|--------|
| `src/services/database/sqlite-client.ts` | Runtime migration: is_private column, flags/node_flags tables, public_nodes view |
| `src/types/database.ts` | Add `is_private` to Node type, add Flag/NodeFlag types |
| `src/types/views.ts` | Extend ViewFilter with `type` discriminator |
| `app/api/flags/route.ts` | GET + POST |
| `app/api/flags/[name]/route.ts` | DELETE |
| `app/api/nodes/[id]/flags/route.ts` | GET + POST |
| `app/api/nodes/[id]/flags/[flag]/route.ts` | DELETE |
| `app/api/nodes/[id]/route.ts` | Accept `is_private` in PATCH |
| `src/services/database/nodes.ts` | Flag query helpers, filter join logic |
| `src/tools/database/queryNodes.ts` | Use public_nodes |
| `src/tools/database/getNodesById.ts` | Use public_nodes |
| `src/tools/database/queryDimensionNodes.ts` | Use public_nodes |
| `src/tools/database/updateNode.ts` | Use public_nodes for read check |
| `src/tools/database/queryEdge.ts` | Use public_nodes for joins |
| `apps/mcp-server-standalone/services/nodeService.js` | Use public_nodes |
| `src/services/context/autoContext.ts` | Exclude private nodes |
| `src/components/views/ViewFilters.tsx` | Pin Filter button left, flag filter support |
| `src/components/focus/FocusPanel.tsx` | Flag chips + privacy lock toggle |
| `src/components/settings/SettingsModal.tsx` | Add Flags tab |
| `src/components/settings/FlagsViewer.tsx` | New: flag management UI |
