# Node Empty-State Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace full-width stacked action buttons in the node empty-state with compact centered pill-style buttons in three semantic groups.

**Architecture:** Pure UI change in a single render block inside FocusPanel.tsx. No logic changes — same onClick handlers, same conditional rendering logic, just new layout and icons.

**Tech Stack:** React, Tailwind-compatible inline styles, lucide-react

---

### Task 1: Add `Sparkles` to lucide import

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx:4`

**Step 1: Add Sparkles to the import**

Current line 4:
```ts
import { Eye, Trash2, Link, Loader, Database, RefreshCw, Pencil, X, Save, Plus, BookOpen, ExternalLink } from 'lucide-react';
```

New line 4:
```ts
import { Eye, Trash2, Link, Loader, Database, RefreshCw, Pencil, X, Save, Plus, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
```

**Step 2: Verify no TS errors**

Run: `npx tsc --noEmit`
Expected: no new errors

---

### Task 2: Replace empty-state button block

**Files:**
- Modify: `src/components/focus/FocusPanel.tsx:3132-3170`

**Step 1: Replace the block**

Replace the entire `<div>` at lines 3132–3170 with:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', padding: '8px 4px' }}>

  {/* Group 1: Notes actions */}
  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '8px 0' }}>
    <button
      onClick={startNotesEdit}
      className="app-button app-button--compact"
      style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
    >
      <Pencil size={12} />
      Write notes
    </button>
    {nodesData[activeTab]?.chunk && (
      <button
        onClick={generateNotesFromSource}
        disabled={generatingNotesFromSource}
        className="app-button app-button--secondary app-button--compact"
        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
      >
        {generatingNotesFromSource ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {generatingNotesFromSource ? 'Generating…' : 'Generate notes'}
      </button>
    )}
  </div>

  {/* Divider */}
  {nodesData[activeTab]?.chunk && (
    <div style={{ width: '100%', height: '1px', background: 'var(--app-border)' }} />
  )}

  {/* Group 2: Source action (conditional) */}
  {nodesData[activeTab]?.chunk && (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
      <button
        onClick={() => setActiveContentTab('source')}
        className="app-button app-button--secondary app-button--compact"
        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
      >
        <BookOpen size={12} />
        View source
      </button>
    </div>
  )}

  {/* Divider */}
  <div style={{ width: '100%', height: '1px', background: 'var(--app-border)' }} />

  {/* Group 3: Graph action */}
  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
    <button
      onClick={createLinkedNote}
      disabled={creatingNote}
      className="app-button app-button--secondary app-button--compact"
      style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500 }}
    >
      {creatingNote ? <Loader size={12} className="animate-spin" /> : <Link size={12} />}
      New linked node
    </button>
  </div>

</div>
```

**Step 2: Verify no TS errors**

Run: `npx tsc --noEmit`
Expected: no new errors

**Step 3: Visual check**

Open a node with no notes. Confirm:
- For a node **without** a source chunk: "Write notes" + divider + "New linked node"
- For a node **with** a source chunk: "Write notes" + "Generate notes" + divider + "View source" + divider + "New linked node"
- All buttons are centered
- All buttons are compact (not full-width)

**Step 4: Commit**

```bash
git add src/components/focus/FocusPanel.tsx
git commit -m "fix: replace full-width empty-state action buttons with compact grouped layout"
```
