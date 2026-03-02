# Design: USER_GUIDE.md

**Date:** 2026-02-26
**Status:** Approved
**Output file:** `/Users/mariokrajci/Desktop/Svelte/knowledgebase/ra-h_os/USER_GUIDE.md`

---

## Problem

`PROJECT_SUMMARY.md` reads like a technical reference. A new user who opens the app for the first time still won't know what to click, how the panels relate to each other, or how to do the five most common tasks. The goal of this guide is to close that gap.

## Audience

Anyone opening the app for the first time — developer or not. Assumes no prior knowledge of the UI. Technical depth is minimal; the focus is navigation and workflows.

## Approach

A separate `USER_GUIDE.md` at the repo root. `PROJECT_SUMMARY.md` stays unchanged as the technical reference. The two files serve different purposes.

---

## Document Structure

### Section 1 — The Screen at a Glance
- ASCII layout diagram with labeled regions
- Left toolbar: every icon explained (Search, Add, Feed, Map, Dimensions, Table, Settings)
- Slot A vs Slot B: what they are, how the dual-pane system works
- Key concept: clicking a node in a list opens it in the Focus Panel

### Section 2 — Your First 5 Minutes
- Narrative walkthrough, no choices:
  1. App opens → API key modal appears → dismiss (or enter key)
  2. Empty Feed view — this is home base
  3. Press Cmd+N → Quick-Add modal
  4. Type a title or paste a URL → press Cmd+Enter
  5. Watch node appear in Feed with auto-generated description and tags
- Goal: user has created their first node before reading Section 3

### Section 3 — The 5 Core Workflows
Step-numbered instructions for each task:

1. **Add a plain note** — Cmd+N → type text → Cmd+Enter
2. **Add a YouTube video or webpage** — Cmd+N → paste URL → type auto-detected → Cmd+Enter → extraction runs in background
3. **Browse a node** — click node in Feed → Focus Panel opens → Description / Notes / Source tabs explained
4. **Connect two nodes** — open node → Edges tab → search for target node → type relationship explanation → Enter
5. **Search** — Cmd+K → type query → navigate with arrows → Enter to open

### Section 4 — Views: Feed, Map, Dimensions, Table
- One paragraph per view explaining what it shows and when to use it
- Feed: daily driver, filter by tags, custom sort
- Map: visual graph of connections, click node to open
- Dimensions: browse nodes grouped by tag, manage tag priority
- Table: scan many nodes at once, sortable columns

### Section 5 — The Focus Panel Tab by Tab
- **Description** — AI-generated summary, editable, regenerate button
- **Notes** — free-form user notes, markdown supported, @NodeID references
- **Edges** — incoming/outgoing connections, add/remove/edit relationships
- **Source** — raw extracted content (YouTube chunks, PDF pages, web text), Raw vs Reader toggle
- Non-obvious interactions: drag node ID badge into Notes to create a reference

### Section 6 — Settings Reference
Short paragraph per tab:
- API Keys — enter OpenAI and Tavily keys
- Guides — create/edit markdown docs visible to agents
- Logs — full audit trail of every change
- Database — SQLite stats, backup/restore
- Tools — list of available AI tools

### Section 7 — Keyboard Shortcuts Cheatsheet
Table format:

| Shortcut | Action |
|----------|--------|
| Cmd+K | Open search |
| Cmd+N | Open Quick-Add |
| Cmd+\ | Toggle second pane |
| Cmd+Shift+R | Refresh all panes |
| Cmd+Enter | Submit in modals |
| Esc | Close any modal |

---

## Tone & Style

- Second person ("you"), present tense
- Short sentences, no jargon
- Step numbers for anything procedural
- Avoid explaining *why* things work — focus on *what* to do
- Length target: scannable in 10 minutes, reference-friendly after that
