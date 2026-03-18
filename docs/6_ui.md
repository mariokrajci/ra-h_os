# User Interface

> How to navigate and use RA-OS's interface.

**How it works:** RA-OS uses a responsive app shell. On desktop and larger screens it keeps the pane-based workspace. On phones it switches to a capture-and-retrieval interface with a notes list home screen and full-screen navigation.

---

## Layout Modes

### Phone

Phone mode is optimized for capture and retrieval:

- default screen is the notes list, sorted by last edited unless the user changes sort
- persistent bottom actions are limited to `Search` and `Add`
- tapping a note opens a full-screen detail view
- search and add are dedicated full-screen flows
- advanced areas like map, table/database, logs, and other admin-heavy surfaces are intentionally de-emphasized

### Desktop / Large Screen

Desktop keeps the pane workspace for graph browsing, editing, and supporting tools.

### Tablet

Tablet now uses a simpler master-detail shell:

- notes list stays visible on the left
- note detail opens on the right
- search and add remain quick-access actions from the list pane
- it avoids the full split-pane/pane-switching complexity of desktop

## Desktop Workspace

```
┌─────────────┬─────────────────────────┐
│   NODES     │        FOCUS            │
│   Panel     │        Panel            │
│             │                         │
│ • Search    │ • Tabbed workspace      │
│ • Filters   │ • Node content          │
│ • Folders   │ • Connections           │
│ • Docs      │                         │
│             │                         │
└─────────────┴─────────────────────────┘
```

---

## Desktop Left Panel: Nodes

Browse and manage your knowledge base.

### Features

- **Search bar** — Cmd+K opens global search modal
- **Dimension filters** — Multi-select dimension tags
- **Node list** — Scrollable list of filtered nodes
- **Folder view toggle** — Switch between list and folder views
- **Docs button** — Opens the built-in docs modal from top-level numbered `docs/*.md` files

### Node Display

Each node shows:
- Title + description preview
- Dimension tags (with custom icons)
- Last updated timestamp
- Node ID badge

### Folder View

Click the folder icon to open the **Folder View Overlay**:

**Two Modes:**

1. **Folders Mode** — Browse by dimension folders
   - Each dimension shows as a folder card
   - Drag nodes to folders to add dimensions
   - Click to view nodes in that dimension

2. **Filtered View Mode** — Multi-dimension filtering with views
   - Add multiple dimension filters
   - Choose view layout (List, Grid, Kanban)
   - Save views for quick access

---

## Filtered View System

### View Modes

| Mode | Description |
|------|-------------|
| **List** | Nodes grouped by dimension with section headers |
| **Grid** | Cards in responsive grid, grouped by dimension |
| **Kanban** | Columns per dimension, drag to move between |

### Compound Filters (AND Logic)

Add secondary filters to columns:

1. Add a filter (e.g., "inbox")
2. Click the `[+ AND]` button next to the dimension name
3. Select secondary dimension (e.g., "research")
4. Column now shows only nodes with BOTH dimensions

### Saved Views

Save filter + view combinations:

1. Configure your filters and view mode
2. Click the save icon
3. Name your view
4. Access from the "Saved Views" dropdown

### Drag-and-Drop

- **Reorder nodes** within views
- **Move between Kanban columns** (updates dimensions)
- **Drag from nodes list** to dimension folders

---

## Phone Screens

### Notes List

- Default home screen
- Sorted by `updated_at desc` unless the user changes sort
- Shows title, preview, and updated time
- Pending capture items appear near the top while quick-add work is still processing

### Note Detail

- Full-screen reading view with back navigation
- Minimal actions instead of desktop tabs and pane chrome
- Supports lightweight note editing
- Secondary information such as metadata, source preview, and connection count stays compact

### Search

- Full-screen search route instead of a modal
- Optimized for fast retrieval

### Add

- Full-screen capture flow
- Reuses the existing quick-add pipeline for notes, links, and supported uploads

## Desktop Right Panel: Focus

Active workspace for the node(s) you're working with.

### Tabbed Interface

- **Primary tab** — Main focused node
- **Additional tabs** — Related nodes opened from links
- **Tab controls** — Close (×), reorder, switch

### Node Detail View

| Section | Content |
|---------|---------|
| **Header** | Title, node ID, trash icon |
| **Content** | Full markdown content with syntax highlighting |
| **Metadata** | Created, updated, type, link |
| **Dimensions** | Editable dimension tags |
| **Connections** | Suggested connections plus incoming/outgoing edges |

### Content Rendering

- Markdown support
- `[NODE:id:"title"]` renders as clickable links
- Syntax highlighting for code blocks
- YouTube embeds (if link is YouTube URL)

### Edges Tab

- Edge proposals are preloaded when a note becomes active.
- Suggestions appear only inside the `Edges` tab under **Suggested connections**.
- Suggestions are generated from the note title, description, notes, normalized title mentions, repo-style aliases, strong title overlap, and some high-confidence reciprocal matches from related notes.
- `Approve` creates the edge immediately through the existing edge-creation flow.
- `Dismiss` hides the proposal for that source note so it does not keep reappearing.
- Manual creation still exists as a fallback, but suggestions are the default workflow.

---

## Search (Cmd+K)

Global search modal with 4-tier relevance:

1. **Exact title match** — Highest priority
2. **Title substring** — High priority
3. **FTS content match** — Medium priority
4. **Semantic embedding** — Conceptual matches

**Features:**
- Type-ahead instant results
- Keyboard navigation (↑↓, Enter)
- Click or Enter to open in Focus panel

---

## Settings Panel

**Access:** Settings cog icon in the left toolbar

### Tabs

| Tab | Purpose |
|-----|---------|
| **API Keys** | Configure OpenAI/Tavily keys |
| **Skills** | View, edit, create skills |
| **Tools** | View available tools |
| **Database** | Full node table with filters/sorting |
| **Logs** | Activity feed (last 100 entries) |
| **Context** | Context/system information viewer |
| **Agents** | External agent (MCP) configuration |
| **Preferences** | Theme selection and appearance settings |
| **Bookmarklet** | Install browser capture (bookmarklet or Chrome extension) |

### Appearance

- Theme preference supports **System**, **Light**, and **Dark**
- The app defaults to your OS color scheme until you override it
- The left toolbar uses stronger contrast in dark mode so actions and active panes are easier to distinguish
- Settings content panels now inherit the active theme, including Logs, Database, Skills, API keys, Context, and External Agents

---

## Browser Capture

Save any page to RA-OS with one click from your browser. Two install options are available from **Settings → Bookmarklet**.

### Bookmarklet

A hosted-loader bookmark — the bookmark contains a tiny snippet that fetches the latest logic from your app each time it's clicked.

**Install:**
1. Go to Settings → Bookmarklet
2. Set the App URL (defaults to current origin)
3. Drag the **Save to RA-OS** button to your bookmarks bar — or click **Copy URL** and paste it as the URL of a new bookmark manually (required for Arc and other non-traditional browsers)

### Chrome Extension

A more capable option that works without a bookmarks bar and supports full ChatGPT conversation capture.

**Install:**
1. Download or locate the extension folder at `public/bookmarklet-button/`
2. Open `chrome://extensions` in your browser
3. Enable **Developer mode**
4. Click **Load unpacked** and select the folder
5. The RA-H_OS button appears in your toolbar

**To update after code changes:** go to `chrome://extensions` and click the reload button on the extension. No re-upload needed unless `manifest.json` changed.

### How capture works

| Scenario | Behaviour |
|----------|-----------|
| No selection | Sends the current URL — auto-detected as article, YouTube, podcast, etc. |
| Text selected | Saves the selection as a note with the page URL and title as source |
| Text selected on ChatGPT | Saved as a chat transcript |
| ChatGPT tab (extension only) | Fetches the full conversation via ChatGPT's internal API, formatted with speaker labels |

### Incremental highlighting

If you save content from the same URL more than once, subsequent saves **append** to the existing node's notes rather than creating a new one. This lets you build up highlights from an article or video incrementally.

- Full transcripts (YouTube, podcasts) go to the **Source** tab (`chunk` field)
- Your highlights go to the **Notes** tab — kept separate, no conflict

### Notes are generated on demand

Chat transcripts and other captures do **not** auto-generate AI notes. The raw content is stored in Source. Use the **Generate notes from source** button in the Focus panel when you want an AI summary.

---

## Map View

Visual graph of your knowledge network.

**Features:**
- Force-directed layout with pan/zoom
- Node size proportional to edge count
- Top 15 nodes labeled (title + dimensions)
- Click node to highlight connections
- Selection shows connected nodes in green

---

## Database View

Full table view of all nodes.

**Columns:**
- Node (title + ID)
- Dimensions (folder badges)
- Edges (count)
- Updated (timestamp)

**Features:**
- Search by title/content
- Filter by dimensions
- Sort by updated/edges/created
- Pagination

---

## Dimension Icons

Each dimension can have a custom Lucide icon.

**To set:**
1. Open Folder View → hover over dimension
2. Click edit (pencil) icon
3. Choose icon from curated options
4. Icons persist in localStorage

---

## Node References

**Format:** `[NODE:id:"title"]`

**Rendering:**
- Clickable labels in node content
- Hover shows preview tooltip
- Click opens in Focus panel

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open search |
| `Option/Alt+V` | Paste clipboard content as Markdown in edit textareas (Quick Add, Notes, Description, Source) |
| `Escape` | Close modals/overlays |

---

## Design System

### Colors

- **Theme-aware shell:** Automatically follows system light/dark preference by default
- **Accent:** Green for actions and selections
- **Contrast:** Navigation and shell surfaces use stronger separation in dark mode

### Typography

- **Font:** Geist (monospace feel)
- **Sizes:** 11-14px for UI, larger for content

### Buttons

- **Primary:** White bg, black text
- **Secondary:** Transparent, border, white text
- **Toggle:** 28×28px, subtle border, icon only
