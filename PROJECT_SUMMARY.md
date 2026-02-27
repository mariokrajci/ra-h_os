# RA-H Open Source — Project Summary

> A local-first AI-augmented knowledge graph. Store, connect, and query your knowledge — with your own AI models, on your own machine.

---

## Architecture

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5.7 · Tailwind CSS · SQLite

```
┌─────────────────────────────────────────────────────────┐
│                     Browser UI                          │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ NodePane │  │  FocusPanel   │  │  (AI chat/tools) │  │
│  │ (browse) │  │ (node detail) │  │  [backend only]  │  │
│  └──────────┘  └───────────────┘  └──────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ Next.js API routes
┌───────────────────────▼─────────────────────────────────┐
│                   Service Layer                         │
│  database/ · embeddings/ · agents/ · extractors/        │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│          SQLite  (~/Library/Application Support/RA-H/)  │
│  nodes · edges · chunks · dimensions · chats · logs     │
│  + sqlite-vec extension (1536-dim vector search)        │
└─────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│         MCP Server  (apps/mcp-server-standalone/)       │
│         14 tools exposed to Claude Code / agents        │
└─────────────────────────────────────────────────────────┘
```

**Key design choices:**
- **Local-first** — all data in a portable SQLite file, no cloud sync, no login
- **BYO keys** — bring your own OpenAI (and optionally Tavily) API keys
- **Graceful degradation** — works without API keys (no embeddings, fallback descriptions)
- **Two-layer embeddings** — node-level (fast) + chunk-level (detailed content search)
- **Service-oriented** — clean separation: `src/services/`, `src/tools/`, `app/api/`

---

## Features

### Knowledge Graph
- **Nodes** — create, read, update, delete knowledge items with title, source content, description, notes, link, event date
- **Edges** — directed relationships between nodes with auto-inferred type (`created_by`, `part_of`, `source_of`, `related_to`) and confidence score
- **Dimensions** — flexible tag/category system; priority dimensions are auto-assigned to new nodes by LLM
- **Graph visualization** — interactive map view powered by `@xyflow/react`
- **Table view** — spreadsheet-style node browser

### Search
- **Full-text search** — SQLite FTS5 on titles, descriptions, notes
- **Semantic search** — vector similarity via `sqlite-vec` on node + chunk embeddings
- **Filter & sort** — by dimensions (AND/OR), date range, edge count, event date

### Content Extraction
- **YouTube** — transcript extraction → AI analysis → auto-description + tags
- **PDF / Papers** — upload → text extraction → chunking → embedding
- **Websites** — HTML → markdown → AI analysis
- **Chunking** — long content split into ~1000-char overlapping chunks, each embedded

### AI Chat & Agents (backend service — not in this repo)
- **Easy mode** — GPT-4o-mini, concise responses, fast (system prompt: `src/config/prompts/rah-easy.ts`)
- **Hard mode** — Claude Sonnet 4.5, full reasoning chain (system prompt: `src/config/prompts/rah-main.ts`)
- The `/api/rah/chat` endpoint is called by evals but is served by a separate backend (`BACKEND_SERVICE_URL`), not present in this open source repo
- **Quick-Add** — single-line input → auto-creates node with description + tags

### System
- **Guides** — Markdown documents stored in DB, readable by UI and external agents
- **Audit log** — every mutation logged (auto-pruned to 10k rows)
- **Cost tracking** — tokens + USD cost stored per chat message
- **MCP server** — 14 tools for Claude Code / external AI agent access
- **Read-only mode** — `SQLITE_READONLY=true` disables all writes

---

## Onboarding Guide

### Prerequisites
- Node.js 18+
- npm (or compatible package manager)
- An OpenAI API key (starts with `sk-`)

### Step 1 — Install

```bash
cd ra-h_os
npm install
```

> The `sqlite-vec` native extension installs automatically on macOS.
> On Linux/Windows, follow the manual setup in `docs/setup-linux.md`.

### Step 2 — Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```env
OPENAI_API_KEY=sk-...          # Required for embeddings + AI features
TAVILY_API_KEY=tvly-...        # Optional: enables web search tool
MCP_ALLOW_WRITES=true          # Optional: allow MCP server to write data
```

### Step 3 — Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first launch a modal will prompt you to enter your API keys (stored only in `.env.local`).

### Step 4 — Create your first node

Click the **+** Quick-Add button at the top of the NodePane. Type a title or paste a URL. The system will:
1. Create the node in SQLite
2. Auto-generate a 280-char description (OpenAI)
3. Suggest and assign dimensions (tags)
4. Queue embedding generation in the background

### Step 5 — Extract content

Open any node in the FocusPanel and use the extraction buttons:
- **YouTube** — paste a YouTube URL, transcripts are fetched + chunked + embedded
- **PDF** — upload a file via the PDF button
- **Web** — paste any URL to extract and analyze page content

### Step 6 — Connect Claude Code (MCP)

Add to your `claude_desktop_config.json` (or `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "ra-h": {
      "command": "npx",
      "args": ["ra-h-mcp-server"]
    }
  }
}
```

Claude Code will now have access to your knowledge base via 14 MCP tools — it auto-calls `rah_get_context` on startup to orient itself.

### Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run unit tests (Vitest) |
| `npm run evals` | Run LLM evaluation suite |
| `npm run sqlite:backup` | Backup the SQLite database |
| `npm run sqlite:restore` | Restore from backup |

---

## Where AI Is Used

| Location | Model | Purpose |
|----------|-------|---------|
| Node creation | `gpt-4o-mini` | Auto-generate 280-char description |
| Node creation | `gpt-4o-mini` | Suggest + assign dimension tags |
| Source-backed note synthesis | `gpt-4o-mini` | Generate editable notes from extracted source |
| Edge creation | `gpt-4o-mini` | Infer relationship type + confidence (with heuristic fast-path) |
| YouTube extraction | `gpt-4o-mini` | Analyze transcript → description + tags |
| PDF/website extraction | `gpt-4o-mini` | Analyze content → description + tags |
| Chat easy mode _(backend)_ | `gpt-4o-mini` | Fast chat via external backend service |
| Chat hard mode _(backend)_ | `claude-sonnet-4-5` | Deep reasoning via external backend service |
| Embeddings (all) | `text-embedding-3-small` | 1536-dim vectors for semantic search |
| MCP server | `gpt-4o-mini` | Processes writes triggered by external agents |

**Two-layer embedding architecture:**
- **Node-level** — whole-node embedding stored in `nodes.embedding` BLOB + `vec_nodes` virtual table
- **Chunk-level** — per-chunk embeddings in `chunks` → `vec_chunks` for detailed content search

**Cost tracking:** Every AI call stores `input_tokens`, `output_tokens`, `model_used`, and `estimated_cost_usd` in `chats.metadata` (JSON). View it in Settings → Logs.

**Graceful degradation:** If no API key is configured, node descriptions fall back to a truncated title, embeddings are skipped, and dimensions are assigned from defaults. The app remains fully functional for manual use.

---

## Areas for Improvement

### Testing
- **No UI component tests** — Vitest covers services/tools but zero test coverage for React components; adding React Testing Library or Playwright E2E tests would significantly improve confidence
- **LLM eval suite is minimal** — `npm run evals` exists but evaluation coverage is narrow

### Platform & Distribution
- **Linux/Windows sqlite-vec setup is manual** — the native extension installs automatically on macOS but requires manual steps on other platforms; pre-bundled binaries or a WASM fallback would fix this
- **No installers** — distributed as a Node.js project; an Electron or Tauri wrapper would make it accessible to non-technical users

### Multi-user & Collaboration
- **Strictly single-user, single-machine** — the local-first design is intentional but limits team use; a sync layer (e.g. CR-SQLite or LibSQL) could enable optional multi-device sync without breaking the local-first model
- **Event broadcaster is process-local** — real-time updates don't work across multiple browser tabs or devices

### Data & Export
- **No graph export** — no built-in way to export nodes/edges as JSON, CSV, or standard graph formats (GraphML, GEXF); useful for backup, migration, or analysis in other tools
- **No import** — bulk import from Notion, Obsidian, Roam, or plain markdown isn't supported

### AI & MCP
- **MCP write access is binary** — `MCP_ALLOW_WRITES=true` unlocks all writes for external agents; fine-grained permissions (e.g. allow search but not delete) would be safer
- **Single embedding model** — hard-coded to `text-embedding-3-small`; supporting local embedding models (Ollama, nomic-embed) would eliminate the OpenAI dependency for offline use
- **In-app AI chat not in this repo** — the easy/hard mode chat system (`/api/rah/chat`) is implemented in a separate backend service; the open source build only includes the prompts and type definitions, not the chat UI or API route

### Code Quality
- **Dual PDF dependency** — both `pdf-parse` (deprecated) and `pdfjs-dist` are used; consolidating to `pdfjs-dist` alone would reduce bundle size and maintenance surface
- **LangChain used only for text splitting** — `@langchain/core` + `@langchain/textsplitters` is a heavy dependency used solely for `RecursiveCharacterTextSplitter`; replacing with a small inline utility would trim ~2MB from the install
