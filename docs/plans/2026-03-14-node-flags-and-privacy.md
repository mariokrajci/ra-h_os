# Node Flags & Privacy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user-defined workflow flags per node and a privacy toggle that completely hides marked nodes from all MCP agent access paths.

**Architecture:** Schema migration adds `flags` table, `node_flags` junction table, `is_private` column on `nodes`, and a `public_nodes` SQLite view. MCP TS tools filter via `excludePrivate: true` in `NodeFilters`. Standalone MCP server uses `public_nodes` view. UI adds flag chips alongside dimension chips and a lock icon in node header. Flags are filterable in the existing `ViewFilters` bar via an extended `ViewFilter` type.

**Tech Stack:** Next.js 15, TypeScript, SQLite (better-sqlite3), React, lucide-react, Tailwind-compatible inline styles

---

### Task 1: Schema migration + types

**Files:**
- Modify: `src/services/database/sqlite-client.ts` (after line ~922, before `ensureCoreTables`)
- Modify: `src/types/database.ts`
- Modify: `src/types/views.ts`

**Step 1: Add migration block to sqlite-client.ts**

Find the end of the `ensureLoggingMemorySchema` method (around line 922, just before the closing `} catch` of the outer try). Add a new migration section after the final schema pass block. Look for `console.log('Final schema pass migrations complete');` — add after that entire try/catch block but still inside `ensureLoggingMemorySchema`:

```ts
// 11) Flags + privacy migration
try {
  const nodeColNames = (this.db.pragma('table_info(nodes)') as Array<{ name: string }>).map(c => c.name);
  if (!nodeColNames.includes('is_private')) {
    this.db.exec('ALTER TABLE nodes ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;');
    console.log('Added nodes.is_private column');
  }

  this.db.exec(`
    CREATE TABLE IF NOT EXISTS flags (
      name       TEXT PRIMARY KEY,
      color      TEXT NOT NULL DEFAULT '#6b7280',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  this.db.exec(`
    CREATE TABLE IF NOT EXISTS node_flags (
      node_id    INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      flag       TEXT    NOT NULL REFERENCES flags(name) ON DELETE CASCADE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (node_id, flag)
    );
  `);

  this.db.exec(`
    DROP VIEW IF EXISTS public_nodes;
    CREATE VIEW public_nodes AS SELECT * FROM nodes WHERE is_private = 0;
  `);

  console.log('Flags + privacy migration complete');
} catch (flagsErr) {
  console.warn('Flags + privacy migration error:', flagsErr);
}
```

**Step 2: Add types to database.ts**

Add after the `Dimension` interface:

```ts
export interface Flag {
  name: string;
  color: string;
  created_at: string;
}

export interface NodeFlag {
  node_id: number;
  flag: string;
  created_at: string;
}
```

Add `is_private` to the `Node` interface (after `edge_count`):

```ts
is_private?: number;  // 0 = public, 1 = private (hidden from MCP)
flags?: string[];     // assigned flag names, included in some queries
```

Add to `NodeFilters` interface:

```ts
flags?: string[];           // filter by flag names
flagsMatch?: 'any' | 'all'; // 'any' = OR (default), 'all' = AND
excludePrivate?: boolean;   // when true, exclude nodes where is_private = 1
```

**Step 3: Update ViewFilter in views.ts**

```ts
export interface ViewFilter {
  dimension: string;           // value: dimension name OR flag name
  operator: 'includes' | 'excludes';
  type?: 'dimension' | 'flag'; // omit = 'dimension' for backwards compat
}
```

**Step 4: Verify no TS errors**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```bash
git add src/services/database/sqlite-client.ts src/types/database.ts src/types/views.ts
git commit -m "feat: schema migration for node flags and privacy (is_private, flags table, public_nodes view)"
```

---

### Task 2: Flag service + flag API routes

**Files:**
- Create: `src/services/database/flagService.ts`
- Create: `app/api/flags/route.ts`
- Create: `app/api/flags/[name]/route.ts`

**Step 1: Create flagService.ts**

```ts
import { getSQLiteClient } from './sqlite-client';
import { Flag, NodeFlag } from '@/types/database';

export const flagService = {
  getAllFlags(): Flag[] {
    const sqlite = getSQLiteClient();
    return sqlite.query<Flag>('SELECT name, color, created_at FROM flags ORDER BY name', []).rows;
  },

  createFlag(name: string, color: string): Flag {
    const sqlite = getSQLiteClient();
    sqlite.query(
      `INSERT INTO flags (name, color) VALUES (?, ?) ON CONFLICT(name) DO NOTHING`,
      [name.trim(), color]
    );
    return { name: name.trim(), color, created_at: new Date().toISOString() };
  },

  deleteFlag(name: string): boolean {
    const sqlite = getSQLiteClient();
    const result = sqlite.query('DELETE FROM flags WHERE name = ?', [name]);
    return (result as any).changes > 0;
  },

  getNodeFlags(nodeId: number): string[] {
    const sqlite = getSQLiteClient();
    const rows = sqlite.query<{ flag: string }>(
      'SELECT flag FROM node_flags WHERE node_id = ? ORDER BY created_at',
      [nodeId]
    ).rows;
    return rows.map(r => r.flag);
  },

  assignFlag(nodeId: number, flag: string): void {
    const sqlite = getSQLiteClient();
    sqlite.query(
      `INSERT INTO node_flags (node_id, flag) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [nodeId, flag]
    );
  },

  removeFlag(nodeId: number, flag: string): boolean {
    const sqlite = getSQLiteClient();
    const result = sqlite.query(
      'DELETE FROM node_flags WHERE node_id = ? AND flag = ?',
      [nodeId, flag]
    );
    return (result as any).changes > 0;
  },

  countNodesWithFlag(flag: string): number {
    const sqlite = getSQLiteClient();
    return sqlite.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM node_flags WHERE flag = ?',
      [flag]
    ).rows[0]?.count ?? 0;
  },
};
```

**Step 2: Create app/api/flags/route.ts**

```ts
import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function GET() {
  try {
    const flags = flagService.getAllFlags();
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch flags' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, color = '#6b7280' } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    const flag = flagService.createFlag(name.trim(), color);
    return NextResponse.json({ success: true, flag }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create flag' }, { status: 500 });
  }
}
```

**Step 3: Create app/api/flags/[name]/route.ts**

```ts
import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
  try {
    const name = decodeURIComponent(params.name);
    flagService.deleteFlag(name);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete flag' }, { status: 500 });
  }
}
```

**Step 4: Write API tests**

Create `tests/api/flags-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/database/flagService', () => ({
  flagService: {
    getAllFlags: vi.fn(() => [{ name: 'to-read', color: '#6b7280', created_at: '2026-01-01' }]),
    createFlag: vi.fn((name, color) => ({ name, color, created_at: '2026-01-01' })),
    deleteFlag: vi.fn(() => true),
  },
}));

const { GET, POST } = await import('@/app/api/flags/route');

describe('GET /api/flags', () => {
  it('returns flag list', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.flags).toHaveLength(1);
    expect(data.flags[0].name).toBe('to-read');
  });
});

describe('POST /api/flags', () => {
  it('creates a flag', async () => {
    const req = new Request('http://localhost/api/flags', {
      method: 'POST',
      body: JSON.stringify({ name: 'urgent', color: '#ef4444' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.flag.name).toBe('urgent');
  });

  it('rejects missing name', async () => {
    const req = new Request('http://localhost/api/flags', {
      method: 'POST',
      body: JSON.stringify({ color: '#ef4444' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

**Step 5: Run tests**

Run: `npx vitest run tests/api/flags-route.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/services/database/flagService.ts app/api/flags/ tests/api/flags-route.test.ts
git commit -m "feat: flag service and CRUD API routes"
```

---

### Task 3: Node flags API routes

**Files:**
- Create: `app/api/nodes/[id]/flags/route.ts`
- Create: `app/api/nodes/[id]/flags/[flag]/route.ts`

**Step 1: Create app/api/nodes/[id]/flags/route.ts**

```ts
import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = parseInt(params.id, 10);
    if (isNaN(nodeId)) return NextResponse.json({ success: false, error: 'Invalid node id' }, { status: 400 });
    const flags = flagService.getNodeFlags(nodeId);
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch node flags' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = parseInt(params.id, 10);
    if (isNaN(nodeId)) return NextResponse.json({ success: false, error: 'Invalid node id' }, { status: 400 });
    const { flag } = await request.json();
    if (!flag || typeof flag !== 'string') {
      return NextResponse.json({ success: false, error: 'flag is required' }, { status: 400 });
    }
    flagService.assignFlag(nodeId, flag);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to assign flag' }, { status: 500 });
  }
}
```

**Step 2: Create app/api/nodes/[id]/flags/[flag]/route.ts**

```ts
import { NextResponse } from 'next/server';
import { flagService } from '@/services/database/flagService';

export async function DELETE(_req: Request, { params }: { params: { id: string; flag: string } }) {
  try {
    const nodeId = parseInt(params.id, 10);
    if (isNaN(nodeId)) return NextResponse.json({ success: false, error: 'Invalid node id' }, { status: 400 });
    const flag = decodeURIComponent(params.flag);
    flagService.removeFlag(nodeId, flag);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to remove flag' }, { status: 500 });
  }
}
```

**Step 3: Verify TS**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add app/api/nodes/[id]/flags/
git commit -m "feat: node flag assignment API routes"
```

---

### Task 4: Privacy field on nodes API + nodeService flag queries

**Files:**
- Modify: `app/api/nodes/[id]/route.ts` (PATCH handler)
- Modify: `src/services/database/nodes.ts` (getNodes, getNodeById, countNodes — privacy + flag filtering)

**Step 1: Find the PATCH handler in app/api/nodes/[id]/route.ts**

Search for `PATCH` in the file. Find where `updateData` is built from the request body. Add `is_private` to the allowed fields:

```ts
// Add alongside other optional fields:
if (typeof body.is_private === 'number') {
  updateData.is_private = body.is_private;
}
```

Then ensure the UPDATE SQL includes `is_private` when present (it likely uses a dynamic field builder — verify and add `is_private` to the allowed update fields list).

**Step 2: Add privacy + flag filtering to getNodesSQLite in nodes.ts**

In `getNodesSQLite`, destructure `excludePrivate` and `flags`/`flagsMatch` from filters:

```ts
const { dimensions, search, limit = 100, offset = 0, sortBy, dimensionsMatch = 'any',
        createdAfter, createdBefore, eventAfter, eventBefore,
        excludePrivate, flags, flagsMatch = 'any' } = filters;
```

After `WHERE 1=1`, add privacy filter:

```ts
if (excludePrivate) {
  query += ` AND n.is_private = 0`;
}
```

After dimension filtering, add flag filtering (same pattern as dimensions):

```ts
if (flags && flags.length > 0) {
  if (flagsMatch === 'all' && flags.length > 1) {
    query += ` AND (
      SELECT COUNT(DISTINCT nf.flag) FROM node_flags nf
      WHERE nf.node_id = n.id
      AND nf.flag IN (${flags.map(() => '?').join(',')})
    ) = ?`;
    params.push(...flags, flags.length);
  } else {
    query += ` AND EXISTS (
      SELECT 1 FROM node_flags nf
      WHERE nf.node_id = n.id
      AND nf.flag IN (${flags.map(() => '?').join(',')})
    )`;
    params.push(...flags);
  }
}
```

Do the same for `countNodes` (same pattern, same location).

**Step 3: Add privacy filter to getNodeByIdSQLite**

In `getNodeByIdSQLite`, add optional `excludePrivate` param:

```ts
async getNodeById(id: number, opts: { excludePrivate?: boolean } = {}): Promise<Node | null> {
  return this.getNodeByIdSQLite(id, opts);
}

private async getNodeByIdSQLite(id: number, opts: { excludePrivate?: boolean } = {}): Promise<Node | null> {
  const sqlite = getSQLiteClient();
  const privacyClause = opts.excludePrivate ? ' AND n.is_private = 0' : '';
  const query = `
    SELECT n.id, n.title, n.description, n.notes, n.link, n.event_date, n.metadata, n.chunk,
           n.chunk_status, n.embedding_updated_at, n.embedding_text, n.is_private,
           n.created_at, n.updated_at,
           COALESCE((SELECT JSON_GROUP_ARRAY(d.dimension)
                     FROM node_dimensions d WHERE d.node_id = n.id), '[]') as dimensions_json,
           COALESCE((SELECT JSON_GROUP_ARRAY(nf.flag)
                     FROM node_flags nf WHERE nf.node_id = n.id), '[]') as flags_json
    FROM nodes n
    WHERE n.id = ?${privacyClause}
  `;
  // ... rest unchanged, but also parse flags_json:
  return {
    ...row,
    dimensions: JSON.parse(row.dimensions_json || '[]'),
    flags: JSON.parse((row as any).flags_json || '[]'),
    metadata: ...,
  };
}
```

Also update `getNodesSQLite` SELECT to include `n.is_private` and `flags_json` subquery, parse both in the return map.

**Step 4: Verify TS**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```bash
git add app/api/nodes/[id]/route.ts src/services/database/nodes.ts
git commit -m "feat: privacy and flag filtering in nodeService, is_private in nodes API"
```

---

### Task 5: MCP enforcement — TS tools + autoContext

**Files:**
- Modify: `src/tools/database/queryNodes.ts`
- Modify: `src/tools/database/queryDimensionNodes.ts`
- Modify: `src/tools/database/getNodesById.ts`
- Modify: `src/services/context/autoContext.ts`

**Step 1: queryNodes.ts — add excludePrivate to getNodes call**

Find the `nodeService.getNodes({...})` call (line ~72). Add `excludePrivate: true`:

```ts
const nodesPromise = nodeService.getNodes({
  limit,
  dimensions: filters.dimensions,
  search: filters.search,
  createdAfter: filters.createdAfter,
  createdBefore: filters.createdBefore,
  eventAfter: filters.eventAfter,
  eventBefore: filters.eventBefore,
  excludePrivate: true,  // ← add this
});
```

Also add to the `nodeService.getNodeById(nodeId)` call (line ~28): replace with `nodeService.getNodeById(nodeId, { excludePrivate: true })`.

**Step 2: queryDimensionNodes.ts — add excludePrivate**

Find `nodeService.getNodes({...})` call and add `excludePrivate: true`.

**Step 3: getNodesById.ts — add excludePrivate**

Find `nodeService.getNodeById(id)` call and replace with `nodeService.getNodeById(id, { excludePrivate: true })`.

**Step 4: autoContext.ts — exclude private nodes**

In `fetchAutoContextRows`, change:
```ts
FROM nodes n
LEFT JOIN edges e
```
to:
```ts
FROM nodes n
LEFT JOIN edges e
```
and add after `WHERE 1=1`:
```ts
AND n.is_private = 0
```

Full query becomes:
```sql
SELECT n.id, n.title, n.updated_at, COUNT(DISTINCT e.id) AS edge_count
FROM nodes n
LEFT JOIN edges e ON (e.from_node_id = n.id OR e.to_node_id = n.id)
WHERE n.is_private = 0
GROUP BY n.id
ORDER BY edge_count DESC, n.updated_at DESC
LIMIT ?
```

**Step 5: Verify TS**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 6: Commit**

```bash
git add src/tools/database/queryNodes.ts src/tools/database/queryDimensionNodes.ts src/tools/database/getNodesById.ts src/services/context/autoContext.ts
git commit -m "feat: enforce privacy exclusion in all MCP TS tools and autoContext"
```

---

### Task 6: MCP enforcement — standalone server

**Files:**
- Modify: `apps/mcp-server-standalone/services/nodeService.js`

**Step 1: Replace all `FROM nodes n` with `FROM public_nodes n`**

In `nodeService.js`, there are two main query functions: `getNodes` (line ~11) and `getNodeById` (line ~72). Also check lines ~272-305 for any other raw node queries.

For each occurrence of `FROM nodes n`, replace with `FROM public_nodes n`.

Also check for bare `FROM nodes` (without alias) — replace those too.

Run: `grep -n "FROM nodes" apps/mcp-server-standalone/services/nodeService.js` to find all occurrences first.

**Step 2: Manual verification**

Run: `grep -n "FROM nodes" apps/mcp-server-standalone/services/nodeService.js`
Expected: no output (all replaced)

**Step 3: Commit**

```bash
git add apps/mcp-server-standalone/services/nodeService.js
git commit -m "feat: standalone MCP server uses public_nodes view to exclude private nodes"
```

---

### Task 7: ViewFilters.tsx — pin Filter button + flag filter support

**Files:**
- Modify: `src/components/views/ViewFilters.tsx`

The current component props include `dimensions: string[]`. We need to also pass available flags.

**Step 1: Update ViewFiltersProps**

```ts
interface ViewFiltersProps {
  filters: ViewFilter[];
  filterLogic: 'and' | 'or';
  dimensions: string[];
  flags: Array<{ name: string; color: string }>; // ← add
  onFilterChange: (filters: ViewFilter[]) => void;
  onFilterLogicChange: (logic: 'and' | 'or') => void;
}
```

**Step 2: Update handleAddFilter to support type**

```ts
const handleAddFilter = (value: string, type: 'dimension' | 'flag' = 'dimension') => {
  if (!filters.some(f => f.dimension === value && (f.type ?? 'dimension') === type)) {
    onFilterChange([...filters, { dimension: value, operator: 'includes', type }]);
  }
  setShowDimensionPicker(false);
  setSearchQuery('');
};
```

**Step 3: Reorder JSX — Filter button FIRST, then chips**

Move the "Add Filter Button" `<div>` to render BEFORE the filter chips map. The order in the flex container should be:

1. `<span>Filters:</span>` label
2. Add/Filter button (with dropdown)
3. Active filter chips
4. AND/OR logic toggle

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', ... flexWrap: 'wrap' }}>
  <span>Filters:</span>

  {/* Add Filter Button — FIRST so it stays pinned left */}
  <div style={{ position: 'relative' }}>
    <button onClick={() => setShowDimensionPicker(!showDimensionPicker)} ...>
      <Filter size={12} />
      Filter
    </button>
    {showDimensionPicker && (
      <div ...>  {/* dropdown */}
        <input ... placeholder="Search..." />
        {/* Dimensions section */}
        {filteredDimensions.length > 0 && (
          <>
            <div style={{ padding: '4px 12px 2px', fontSize: '10px', color: 'var(--app-text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Dimensions
            </div>
            {filteredDimensions.map(dim => (
              <button key={dim} onClick={() => handleAddFilter(dim, 'dimension')} ...>{dim}</button>
            ))}
          </>
        )}
        {/* Flags section */}
        {filteredFlags.length > 0 && (
          <>
            <div style={{ padding: '4px 12px 2px', fontSize: '10px', color: 'var(--app-text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Flags
            </div>
            {filteredFlags.map(flag => (
              <button key={flag.name} onClick={() => handleAddFilter(flag.name, 'flag')} ...>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: flag.color, display: 'inline-block' }} />
                {flag.name}
              </button>
            ))}
          </>
        )}
      </div>
    )}
  </div>

  {/* Filter chips */}
  {filters.map(filter => {
    const isFlag = filter.type === 'flag';
    const flagColor = isFlag ? flags.find(f => f.name === filter.dimension)?.color : undefined;
    return (
      <div key={`${filter.type ?? 'dimension'}-${filter.dimension}`}
        style={{
          ...,
          background: filter.operator === 'includes'
            ? (isFlag ? `${flagColor}22` : 'var(--app-accent-soft)')
            : 'var(--app-danger-bg)',
          border: `1px solid ${filter.operator === 'includes'
            ? (isFlag ? flagColor ?? 'var(--app-accent-border)' : 'var(--app-accent-border)')
            : 'var(--app-danger-border)'}`,
          color: filter.operator === 'includes'
            ? (isFlag ? flagColor ?? 'var(--toolbar-accent)' : 'var(--toolbar-accent)')
            : 'var(--app-danger-text)',
        }}
      >
        ...existing operator toggle and remove button...
      </div>
    );
  })}

  {/* AND/OR toggle */}
  {filters.length > 1 && ...}
</div>
```

Also compute `filteredFlags`:
```ts
const filteredFlags = flags.filter(f =>
  f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
  !filters.some(fi => fi.dimension === f.name && fi.type === 'flag')
);
```

**Step 4: Update import — add Filter icon**

```ts
import { X, Filter, ChevronDown } from 'lucide-react';
```

(Remove `Plus` if no longer used, add `Filter`)

**Step 5: Find callers of ViewFilters and pass `flags` prop**

Run: `grep -rn "ViewFilters" src/` to find all usages. Each caller needs to fetch flags and pass them. For now pass `flags={[]}` as a placeholder — flag fetching will be wired in Task 9 alongside the node UI.

**Step 6: Verify TS**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 7: Commit**

```bash
git add src/components/views/ViewFilters.tsx
git commit -m "fix: pin Filter button left in ViewFilters, add flag filter support"
```

---

### Task 8: Node query layer — flag filter support + flag data in node queries

**Files:**
- Modify: `src/services/database/nodes.ts` (ensure flags_json is in getNodesSQLite SELECT and parsed)

**Step 1: Add flags_json subquery to getNodesSQLite SELECT**

Find the SELECT in `getNodesSQLite` (line ~58). Add flags subquery alongside dimensions_json:

```sql
COALESCE((SELECT JSON_GROUP_ARRAY(nf.flag)
          FROM node_flags nf WHERE nf.node_id = n.id), '[]') as flags_json
```

**Step 2: Parse flags_json in the return map**

In the `.map(row => ...)` at the end of `getNodesSQLite`:

```ts
return result.rows.map(row => ({
  ...row,
  dimensions: JSON.parse(row.dimensions_json || '[]'),
  flags: JSON.parse((row as any).flags_json || '[]'),
  metadata: ...,
}));
```

**Step 3: Verify TS**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add src/services/database/nodes.ts
git commit -m "feat: include flags in node query results"
```

---

### Task 9: FocusPanel — flag chips + privacy lock

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx`

This is the largest UI task. The node detail view needs:
1. Flag chips alongside dimension chips
2. `+` dropdown to assign a flag from the user's defined flags
3. Privacy lock toggle in the header

**Step 1: Find where dimensions are rendered in FocusPanel**

Search for `DimensionTags` or `dimension chips` rendering near the node title/header area. Also search for `nodesData[activeTab]?.dimensions`.

**Step 2: Add flag state**

Near other state declarations at the top of FocusPanel, add:

```ts
const [availableFlags, setAvailableFlags] = useState<Array<{ name: string; color: string }>>([]);
const [showFlagPicker, setShowFlagPicker] = useState(false);
```

**Step 3: Fetch available flags when component mounts**

```ts
useEffect(() => {
  fetch('/api/flags')
    .then(r => r.json())
    .then(data => { if (data.success) setAvailableFlags(data.flags); })
    .catch(() => {});
}, []);
```

**Step 4: Add helper functions**

```ts
const assignFlag = async (nodeId: number, flag: string) => {
  await fetch(`/api/nodes/${nodeId}/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flag }),
  });
  // Refresh node data
  refreshNode(nodeId);
};

const removeNodeFlag = async (nodeId: number, flag: string) => {
  await fetch(`/api/nodes/${nodeId}/flags/${encodeURIComponent(flag)}`, { method: 'DELETE' });
  refreshNode(nodeId);
};

const togglePrivacy = async (nodeId: number, currentValue: number) => {
  await fetch(`/api/nodes/${nodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_private: currentValue === 1 ? 0 : 1 }),
  });
  refreshNode(nodeId);
};
```

(Where `refreshNode` triggers a re-fetch of the node — search for how other mutations refresh node data in the existing code.)

**Step 5: Add privacy lock icon to node header**

Find where the node title and Edit button are rendered. Add a lock button next to the Edit button:

```tsx
import { Lock, LockOpen } from 'lucide-react';  // add to lucide import

// In header area:
<button
  onClick={() => togglePrivacy(activeNodeId, nodesData[activeTab]?.is_private ?? 0)}
  className="app-button app-button--ghost app-button--compact"
  title={nodesData[activeTab]?.is_private ? 'Private — hidden from MCP agents' : 'Public'}
  style={{ padding: '4px' }}
>
  {nodesData[activeTab]?.is_private
    ? <Lock size={13} style={{ color: 'var(--app-danger-text)' }} />
    : <LockOpen size={13} style={{ color: 'var(--app-text-subtle)' }} />
  }
</button>
```

**Step 6: Add flag chips after dimension chips**

Find where dimension chips are rendered (search for `DimensionTags` or the chip row). After the last dimension chip, add:

```tsx
{/* Flag chips */}
{(nodesData[activeTab]?.flags ?? []).map(flagName => {
  const flagDef = availableFlags.find(f => f.name === flagName);
  return (
    <span
      key={flagName}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
        background: `${flagDef?.color ?? '#6b7280'}22`,
        border: `1px solid ${flagDef?.color ?? '#6b7280'}`,
        color: flagDef?.color ?? '#6b7280',
        cursor: 'pointer',
      }}
      onClick={() => removeNodeFlag(activeNodeId!, flagName)}
      title="Click to remove flag"
    >
      <Bookmark size={10} />
      {flagName}
    </span>
  );
})}

{/* Add flag button */}
{availableFlags.length > 0 && (
  <div style={{ position: 'relative' }}>
    <button
      onClick={() => setShowFlagPicker(!showFlagPicker)}
      className="app-button app-button--ghost app-button--compact"
      style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', borderStyle: 'dashed' }}
      title="Add flag"
    >
      <Bookmark size={10} />
    </button>
    {showFlagPicker && (
      <div style={{
        position: 'absolute', top: '100%', left: 0, marginTop: '4px',
        background: 'var(--app-panel-elevated)', border: '1px solid var(--app-border)',
        borderRadius: '6px', padding: '4px', zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: '140px',
      }}>
        {availableFlags
          .filter(f => !(nodesData[activeTab]?.flags ?? []).includes(f.name))
          .map(flag => (
            <button
              key={flag.name}
              onClick={() => { assignFlag(activeNodeId!, flag.name); setShowFlagPicker(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '6px 10px', background: 'transparent', border: 'none',
                color: 'var(--app-text)', fontSize: '12px', cursor: 'pointer', borderRadius: '4px',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: flag.color, flexShrink: 0 }} />
              {flag.name}
            </button>
          ))}
      </div>
    )}
  </div>
)}
```

Add `Bookmark` to lucide imports.

**Step 7: Close flag picker on outside click**

Reuse the existing `contextMenu` outside-click pattern — add a click-outside overlay div when `showFlagPicker` is true (same pattern as the tab context menu at the bottom of the component).

**Step 8: Verify TS**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 9: Commit**

```bash
git add src/components/focus/FocusPanel.tsx
git commit -m "feat: flag chips and privacy lock toggle in node detail view"
```

---

### Task 10: Settings — FlagsViewer + SettingsModal tab

**Files:**
- Create: `src/components/settings/FlagsViewer.tsx`
- Modify: `src/components/settings/SettingsModal.tsx`

**Step 1: Create FlagsViewer.tsx**

Look at `src/components/settings/ApiKeysViewer.tsx` for the style pattern (it's a settings panel with a list + form). Follow the same structure.

```tsx
"use client";

import { useState, useEffect } from 'react';
import { Trash2, Plus, Bookmark } from 'lucide-react';

const PRESET_COLORS = ['#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

interface Flag { name: string; color: string; created_at: string; }

export default function FlagsViewer() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [loading, setLoading] = useState(false);

  const fetchFlags = async () => {
    const res = await fetch('/api/flags');
    const data = await res.json();
    if (data.success) setFlags(data.flags);
  };

  useEffect(() => { fetchFlags(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    await fetch('/api/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    setNewName('');
    setNewColor('#6b7280');
    await fetchFlags();
    setLoading(false);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remove flag "${name}" from all nodes?`)) return;
    await fetch(`/api/flags/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await fetchFlags();
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>
        Flags are workflow labels you assign to nodes — separate from dimensions. Use them to track status like "to-read" or "active".
      </div>

      {/* Existing flags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {flags.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--app-text-subtle)', padding: '8px 0' }}>No flags defined yet.</div>
        )}
        {flags.map(flag => (
          <div key={flag.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'var(--app-surface-subtle)' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: flag.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--app-text)' }}>{flag.name}</span>
            <button
              onClick={() => handleDelete(flag.name)}
              className="app-button app-button--ghost app-button--compact"
              style={{ padding: '4px' }}
            >
              <Trash2 size={12} style={{ color: 'var(--app-text-subtle)' }} />
            </button>
          </div>
        ))}
      </div>

      {/* New flag form */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--app-border)' }}>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              style={{
                width: 16, height: 16, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                outline: newColor === c ? `2px solid var(--app-text)` : 'none', outlineOffset: '1px',
              }}
            />
          ))}
        </div>
        <input
          type="text"
          placeholder="Flag name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          style={{
            flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px',
            background: 'var(--app-input)', border: '1px solid var(--app-border)',
            color: 'var(--app-text)', outline: 'none',
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || loading}
          className="app-button app-button--compact"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Add 'flags' to SettingsModal**

In `SettingsModal.tsx`:

1. Add `'flags'` to `SettingsTab` type:
```ts
export type SettingsTab = 'logs' | 'tools' | 'guides' | 'apikeys' | 'database' | 'context' | 'agents' | 'preferences' | 'flags';
```

2. Add import:
```ts
import FlagsViewer from './FlagsViewer';
```

3. Add tab button in the tab list (find where other tab buttons are rendered, add):
```tsx
<button onClick={() => setActiveTab('flags')} className={tabClass('flags')}>Flags</button>
```

4. Add tab content panel (find where other tab content is rendered, add):
```tsx
{activeTab === 'flags' && <FlagsViewer />}
```

**Step 3: Wire `flags` prop into ViewFilters callers**

Find all callers of `<ViewFilters ... />` (run `grep -rn "ViewFilters" src/`). For each, fetch flags from `/api/flags` and pass as `flags` prop. The simplest approach: fetch in the parent component (likely `ViewsPane.tsx` or similar) alongside the existing dimensions fetch.

**Step 4: Verify TS**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```bash
git add src/components/settings/FlagsViewer.tsx src/components/settings/SettingsModal.tsx
git commit -m "feat: Flags settings tab for managing user-defined workflow flags"
```

---

## Testing Checklist (manual)

After all tasks:

- [ ] Create a flag "to-read" (green) in Settings → Flags
- [ ] Open a node, assign "to-read" flag — chip appears in header
- [ ] Click chip to remove it
- [ ] Filter by "to-read" in ViewFilters — only flagged nodes appear
- [ ] Filter button stays pinned left as filters are added
- [ ] Toggle a node to private (lock fills red) — confirm node disappears from MCP `queryNodes` results
- [ ] Toggle back to public — reappears in MCP results
- [ ] Delete "to-read" flag in Settings — confirm it disappears from all nodes
- [ ] Standalone MCP server: start it, run `getNodes` — private nodes absent
