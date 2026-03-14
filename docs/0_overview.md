# RA-OS Overview

## What is RA-OS?

RA-OS is a minimal knowledge graph UI with MCP server integration. It provides a local-first knowledge management system designed to be extended by external AI agents via the Model Context Protocol.

**Open Source:** [github.com/bradwmorris/ra-h_os](https://github.com/bradwmorris/ra-h_os)

## Design Philosophy

**Local-first** — Your knowledge network belongs to you. Everything runs locally in a SQLite database you control.

**Agent-agnostic** — No built-in AI chat. Instead, RA-OS exposes an MCP server that any AI agent (Claude Code, custom agents) can connect to.

**Simple & focused** — desktop keeps a multi-pane knowledge workspace, while phone mode collapses into a capture-and-retrieval flow. No bloat.

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Database:** SQLite + sqlite-vec (vector search)
- **Embeddings:** OpenAI (BYO API key)
- **MCP Server:** Local connector for Claude Code and external agents

## What's Included

- Responsive app shell with desktop workspace and phone capture/retrieval mode
- Node/Edge/Dimension CRUD
- Full-text and semantic search
- MCP server with graph and skill tools
- Skills system (shared instructions for internal + external agents)
- PDF extraction
- Graph visualization (Map view)
- BYO API keys

## What's NOT Included

- Chat interface (use external agents via MCP)
- Voice features
- Built-in AI agents
- Auth/subscription system
- Desktop packaging

## Responsive Layout Modes

RA-OS now uses different shells depending on screen size:

- **Phone** — notes list by default, with full-screen `Search` and `Add` flows
- **Tablet** — touch-friendly master-detail layout with notes on the left and note detail on the right
- **Desktop** — multi-pane workspace for browsing, editing, and graph work

## Desktop Workspace

```
┌─────────────┬─────────────────────────┐
│   NODES     │        FOCUS            │
│   Panel     │        Panel            │
│             │                         │
│ • Search    │ • Node content          │
│ • Filters   │ • Connections           │
│ • List      │ • Dimensions            │
│             │                         │
└─────────────┴─────────────────────────┘
```

## Phone Mode

Phone mode is intentionally narrower than desktop:

- opens to the notes list sorted by last edited
- keeps only `Search` and `Add` as persistent bottom actions
- uses full-screen drill-down navigation for note retrieval
- de-emphasizes graph/admin tooling that makes more sense on larger screens

## MCP Integration

RA-OS is designed to be the knowledge backend for your AI workflows:

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

Add this to `~/.claude.json` and restart Claude. Works without RA-OS running.

Core tools include: `createNode`, `queryNodes`, `updateNode`, `getNodesById`, `createEdge`, `queryEdge`, `queryDimensions`, `createDimension`, `updateDimension`, `deleteDimension`, `listSkills`, `readSkill`

## Documentation

| Doc | Description |
|-----|-------------|
| [Schema](./2_schema.md) | Database schema, node/edge structure |
| [Tools & Skills](./4_tools-and-guides.md) | Available MCP tools, skill system |
| [UI](./6_ui.md) | Component structure, panels, views |
| [MCP](./8_mcp.md) | External agent connector setup |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and fixes |
