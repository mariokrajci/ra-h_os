# RA-H — User Guide

> This guide gets you navigating and using RA-H from scratch. No prior knowledge assumed.
> For architecture and AI internals, see [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md).

---

## 1. The Screen at a Glance

When you open the app you see three regions:

```
┌──────┬──────────────────────────┬──────────────────────┐
│      │                          │                      │
│ Left │       Slot A             │      Slot B          │
│ Bar  │  (main content pane)     │  (second pane,       │
│      │                          │   optional)          │
│      │                          │                      │
└──────┴──────────────────────────┴──────────────────────┘
```

**Left toolbar (top → bottom):**

| Icon | Shortcut | What it does |
|------|----------|--------------|
| Search | Cmd+K | Open global search |
| + Add | Cmd+N | Quick-add a note, URL, or file |
| Refresh | Cmd+Shift+R | Reload all panes |
| Feed | — | List of all nodes (default view) |
| Map | — | Interactive graph of connections |
| Dimensions | — | Browse nodes grouped by tag |
| Table | — | Spreadsheet view of all nodes |
| Settings | — | API keys, logs, database, guides |

**Slot A** is always open. It shows whichever view you picked in the toolbar (Feed by default).

**Slot B** is optional. Press **Cmd+\\** to open it. Useful for keeping a node open while browsing the Feed. Drag the vertical divider to resize.

**Focus Panel:** When you click a node, it opens in the Focus Panel — the detail view that fills the right portion of Slot A (or all of Slot B). That's where you read and edit everything about a node: its description, notes, connections, and extracted content.

---

## 2. Your First 5 Minutes

Follow these steps exactly — no decisions needed.

**1. Launch the app**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

**2. Handle the API key modal**
A modal appears asking for your **OpenAI** key and your **Anthropic** key. Enter whichever you have. If you have neither, click **"Got it"** — you can still use the app manually; AI features (auto-descriptions, semantic search, auto-tags) just won't work.

**3. You're looking at the Feed**
It's empty. This is your home screen — a chronological list of everything you save.

**4. Create your first node**
Press **Cmd+N** (or click the **+** button in the toolbar).

A small input appears. Type anything — a topic, a thought, a URL:
```
Machine learning basics
```
Press **Cmd+Enter** to save.

**5. Watch it appear**
Your node shows up in the Feed. If you have an API key, within a few seconds it gets:
- An auto-generated 280-character description
- Suggested tags (dimensions) based on the content

Click the node to open it in the Focus Panel and see the details.

That's it. You've created your first node. Everything else in this guide builds on this flow.

---

## 3. The 5 Core Workflows

### Workflow 1: Add a Plain Note

1. Press **Cmd+N**
2. Type your note text
3. Press **Cmd+Enter**

The system sees multi-line text and creates a "note" type node.

---

### Workflow 2: Add a YouTube Video or Webpage

1. Press **Cmd+N**
2. Paste any URL (YouTube, article, arxiv paper, etc.)
3. The system auto-detects the type — you'll see a colored badge appear:
   - **YouTube** → transcript will be extracted
   - **Paper** → PDF will be parsed
   - **Web** → page content will be scraped
4. Press **Cmd+Enter**
5. The modal closes. In the Feed, a **pending node** appears with a spinner: _"Extracting YouTube video..."_
6. When extraction finishes (usually 10–30 seconds), the spinner disappears and your node is ready with full content, description, and tags.

Click the node to open it. The **Source tab** in the Focus Panel shows the raw extracted content.

---

### Workflow 3: Browse a Node

Click any node in the Feed to open it in the Focus Panel.

The Focus Panel has four tabs:

| Tab | What you see |
|-----|-------------|
| **Description** | AI-generated 280-char summary. Click the edit icon to change it. Click **Regenerate** to re-run the AI. |
| **Notes** | AI-seeded editable notes. Supports markdown. You can rewrite and extend them freely. |
| **Edges** | All connections to/from this node (see Workflow 4). |
| **Source** | Raw extracted content — YouTube transcript chunks, PDF pages, web text. Toggle between Raw and Reader view. |

The node **title** is at the top — click it to edit. The **link icon** (top-left of the panel) opens the source URL.

To delete a node: click the **trash icon** next to the title.

---

### Workflow 4: Connect Two Nodes

Connections (edges) let you build a knowledge graph. Each connection has a direction and a relationship type.

**How direction works:** The arrow always points from the **dependent** node toward the **foundational** node — like a citation. The derived thing points to what it came from, the part points to the whole, the output points to its cause.

| Type | Arrow direction | Example |
|------|----------------|---------|
| `created_by` | Content → Creator | `[Book] ──→ [Author]` |
| `part_of` | Part → Whole | `[Episode] ──→ [Podcast]` |
| `source_of` | Derivative → Source | `[Insight] ──→ [Article]` |
| `related_to` | No fixed direction | `[Topic A] ──→ [Topic B]` |

When you add a connection, you're always on the **dependent** node, pointing toward the foundational one. The system also detects reverse phrasing automatically — typing _"author of"_ while on the Author node will flip the stored direction so it still reads correctly.

1. Open a node in the Focus Panel
2. Click the **Edges** tab (or the connections button with a number badge next to the title)
3. In the **"Add connection"** input at the bottom, start typing the title of the node you want to connect to
4. Select it from the dropdown (arrow keys + Enter, or click)
5. A second input appears: type the relationship in plain English:
   - _"created by"_ → `created_by` (this node was created by the target)
   - _"part of"_ → `part_of` (this node is a part of the target)
   - _"source of"_ → `source_of` (this node was derived from the target)
   - _"related to"_ → `related_to` (no directional meaning)
   - Anything else → AI infers the type
6. Press **Enter**

The connection appears immediately. Green arrows = outgoing (this node → other). Orange arrows = incoming (other → this node). Click any connected node title to jump to it.

To remove a connection: click the **×** next to it.

---

### Workflow 5: Search

Press **Cmd+K** to open search.

Type anything — a word, phrase, or concept. Results update as you type and pull from:
- Node titles and descriptions (full-text)
- Embedded content chunks (semantic/vector search, if API key is set)

Navigate results with **↑↓**, open with **Enter**, close with **Esc**.

> **Tip:** Semantic search finds conceptually similar nodes even if the exact words don't match. Try searching for _"renewable energy"_ and it might surface a node titled _"solar panel research"_.

---

## 4. The Four Views

Switch views using the icons in the left toolbar.

### Feed (default)
Your chronological list of nodes. This is where you'll spend most of your time.

- **Filter by tag:** Click the filter icon → pick one or more dimensions → nodes with those tags appear. You can combine with AND (must have all) or OR (must have any).
- **Sort:** Change the sort order to Updated, Created, Edge count, or Custom. Custom lets you drag nodes into any order.
- **Pending nodes:** When extraction is in progress, a spinner node sits at the top of the Feed. It disappears automatically when done.

### Map
An interactive graph where nodes are bubbles and edges are lines between them. Zoom with scroll, pan by dragging. Click any node to open it in the opposite pane. Best for spotting clusters and unexpected connections.

### Dimensions
A tree view of all your tags (dimensions). Shows how many nodes have each tag. Click a dimension to filter the Feed to just those nodes. Use this when you want to browse by topic rather than by time.

### Table
A sortable spreadsheet showing all nodes at once. Columns: Title, Dimensions, Link, Event Date, Created, Updated, Edges. Click any column header to sort. Click a row to open the node. Best for bulk scanning or auditing your knowledge base.

---

## 5. Focus Panel — Tab Reference

The Focus Panel is the detail view for a single node. It opens when you click any node.

### Description tab
The AI-generated summary (up to 280 characters). It's created automatically when you add a node.

- **Edit:** Click the pencil icon → edit inline → Save
- **Regenerate:** Click the regenerate button to have the AI rewrite it. Estimated cost shown before you confirm.

### Notes tab
AI-seeded editable synthesis. Supports full Markdown.

- Click **Edit** to enter edit mode
- Type freely — headers, lists, code blocks all work
- For extracted sources, Notes may start with an AI-generated synthesis based on the Source content
- Reference another node: type `@` followed by the node ID (the green number badge on any node). It becomes a clickable link.
- **Tip:** Drag a node's green ID badge from any panel and drop it into the Notes editor to insert a reference automatically.
- Click **Save** when done. Navigating away without saving will discard changes.

### Edges tab
All connections this node has.

- **Green arrow (→):** This node points _to_ another node (outgoing)
- **Orange arrow (←):** Another node points _to_ this node (incoming)
- Click any connected node's title to open it
- Click the **×** to delete a connection
- To edit a relationship explanation: click on the explanation text, edit, press Enter

Adding connections: see Workflow 4 above.

### Source tab
Raw content extracted from the source URL — YouTube transcript segments, PDF page text, website paragraphs. This is what gets chunked and embedded for semantic search.

- **Raw view:** Monospace, shows exact text
- **Reader view:** Formatted for readability
- Click **Edit** to manually correct extraction errors
- Each chunk shows its index — useful when tracing where a search result came from

---

## 6. Settings

Click the **Settings** icon (bottom of the left toolbar) to open the settings modal. It has these tabs:

**API Keys**
Enter your OpenAI API key (`sk-...`) and your Anthropic API key (`sk-ant-...`). A Tavily key is optional and enables web search. Keys are stored in `.env.local` on your machine only. Without these keys the app works manually — no auto-descriptions, no semantic search, no auto-tags.

**Guides**
Markdown documents you write for yourself or for AI agents. Guides are readable by external tools (Claude Code via MCP) so agents can follow your custom workflows. Create, edit, or delete guides here.

**Logs**
A full audit trail of every node creation, update, and deletion. Each entry shows the table, action, timestamp, and a snapshot of the data before the change. Useful for understanding what happened if something looks wrong. Auto-pruned to 10,000 entries.

**Database**
SQLite stats (node count, edge count, database file size). Backup and restore your entire knowledge base as a single `.sqlite` file.

**Tools**
A read-only list of all AI tools available to agents — what each tool does and what parameters it accepts. Reference this when writing Guides or debugging agent behavior.

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd+K** | Open search |
| **Cmd+N** | Open Quick-Add (add note/URL/file) |
| **Cmd+\\** | Toggle second pane (Slot B) |
| **Cmd+Shift+R** | Refresh all panes |
| **Cmd+Enter** | Submit in Quick-Add and other modals |
| **Esc** | Close any modal |
| **↑ / ↓** | Navigate search results and connection suggestions |
| **Enter** | Select highlighted item in dropdowns |

**In the Feed:**

| Shortcut | Action |
|----------|--------|
| Click node | Open in current pane |
| Ctrl+Alt+Click | Open in the other pane (Slot A ↔ Slot B) |
| Right-click tab | Context menu: open in other pane, close |

---

*For architecture, AI internals, and the MCP server setup, see [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md).*
