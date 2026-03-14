# Mobile-Friendly Design Proposal

## Summary

RA-OS should have a distinct phone experience instead of shrinking the current desktop pane workspace. On phones, the app should optimize for two core jobs:

- capture
- retrieval

The default mobile screen should be the notes list sorted by last edited (`updated_at desc`) unless the user changes that preference. Persistent global UI should be minimal, with only `Search` and `Add` anchored at the bottom. All other navigation should use full-screen drill-down and back navigation, similar to Apple Notes.

This proposal treats mobile as a focused companion to the desktop app:

- desktop: full multi-pane knowledge workspace
- tablet: simplified master-detail workspace
- phone: quick capture and fast retrieval

## Problem

The current shell is desktop-first:

- permanent left toolbar
- multi-pane layout with split resizing
- mouse-oriented drag interactions
- dense pane switching
- modal-heavy supporting flows

That model works on larger screens but is a poor fit for phones. A direct responsive collapse would likely create a cramped UI with too much chrome and too many competing destinations.

## Goals

- Make RA-OS feel intentional on phones
- Prioritize fast note capture and fast note retrieval
- Keep reading and light editing comfortable on narrow screens
- Remove desktop-specific navigation patterns from phone layouts
- Preserve the full workspace model on tablet and desktop

## Non-Goals

- Bringing every desktop surface to phones
- Supporting split panes on phones
- Prioritizing graph exploration, admin, or data-management workflows on mobile
- Preserving parity between phone and desktop navigation

## Product Positioning

Phone RA-OS is not the full workstation. It is a focused companion for:

- adding notes, links, and lightweight source material
- finding recently edited notes
- searching and reopening existing notes
- reading and making lightweight edits

Advanced surfaces such as map, table/database, logs, dimension management, and most settings should remain tablet/desktop-first.

## Core Information Architecture

The phone information architecture should be intentionally narrow:

1. Notes List
2. Note Detail
3. Search
4. Add

This is the entire primary mobile product surface.

All movement should be hierarchical and full-screen:

- notes list -> note detail
- note detail -> source
- note detail -> metadata
- note detail -> connections
- search -> search result -> note detail

Back navigation should be the dominant way to move around the app.

## Navigation Model

### Phone

Use full-screen layered navigation. Each screen fully replaces the previous screen. Avoid floating sidebars, split views, and persistent utility rails.

Persistent bottom actions:

- `Search`
- `Add`

These should be the only always-visible global actions on phone.

All other destinations should be discovered through:

- the default notes list
- drill-down from note content
- low-prominence overflow entry points if needed

### Tablet

Tablet can reintroduce a simplified master-detail layout:

- left: notes list or active collection
- right: selected note

Tablet can also support a limited split experience if it stays touch-friendly, but it should still avoid the full complexity of the desktop shell.

### Desktop

Desktop keeps the current workspace model:

- left toolbar
- pane switching
- split panes
- advanced destinations

## Screen Specifications

### 1. Notes List

This is the default phone home screen.

Behavior:

- loads immediately on app open
- sorted by `updated_at desc` by default
- remembers user-selected sort if changed
- supports pull-to-refresh or lightweight refresh affordance
- tapping a row opens note detail full-screen

Content priority per row:

- title
- short preview or summary line
- last edited timestamp
- optional small metadata cue if it adds value

Design rules:

- keep the header minimal
- do not crowd the screen with advanced filters
- avoid dense icons and permanent secondary controls
- prioritize scanability and tap targets

Optional lightweight controls:

- sort selector
- simple filter chip for common views like `All`, `Recent`, or `Inbox`

These should remain secondary to the list itself.

### 2. Note Detail

This is the main retrieval and light editing surface.

Behavior:

- opens full-screen
- includes standard back navigation
- prioritizes reading over administration
- supports inline edit or a dedicated edit action

Structure:

- top bar with back and minimal actions
- title and content
- compact secondary information below content or in child screens

Secondary areas should not dominate the first view:

- edges/connections
- source content
- metadata
- dimensions/tags

These can appear as:

- compact summary cards lower in the page, or
- dedicated subpages opened from the note detail screen

Recommended child screens:

- `Source`
- `Connections`
- `Metadata`

This keeps the primary note screen uncluttered while still allowing retrieval of richer context.

### 3. Search

Search should be a dedicated full-screen route rather than a modal.

Behavior:

- opens from persistent bottom action
- autofocuses input
- shows recent searches and recent notes when empty
- returns high-confidence note matches quickly
- tapping a result opens note detail

Search matters disproportionately in this mobile model because it is one of only two persistent global actions. It should feel immediate and central.

### 4. Add

Add should be optimized for low-friction capture.

Primary supported cases:

- quick text note
- pasted link
- simple upload if the flow stays concise

Design principles:

- one clear input path at a time
- progressive disclosure for advanced inputs
- no crowded desktop-style form layout

This can be implemented as either:

- a full-screen composer, or
- a bottom sheet that expands into a dedicated capture screen when needed

Recommendation: start with a simple full-screen composer for consistency with the full-screen navigation model.

## What Stays Off the Phone Main Surface

The following areas should not be part of the primary phone navigation:

- map
- table/database view
- logs
- tools/admin panels
- advanced dimensions management
- multi-pane layout
- drag-to-resize interactions

If any of these remain available on phone, they should live behind a low-priority overflow path and not compete with capture and retrieval.

## Interaction Principles

- One primary task per screen
- Full-screen transitions instead of stacked utility overlays
- Large tap targets and low-chrome layout
- Reading space is more important than control density
- Global actions should be extremely limited
- Desktop-only interactions should not be ported directly to phone

## Responsive Breakpoints and Layout Modes

Use explicit layout modes instead of only CSS adaptation:

- phone: single-screen hierarchical navigation
- tablet: master-detail
- desktop: current multi-pane shell

This is a behavioral adaptation, not just a visual one.

## Technical Direction

### Existing code to preserve

Mobile should reuse as much data and content logic as possible from the existing app, especially:

- note fetching and hydration
- note rendering
- search APIs
- quick-add ingestion APIs

The major change is shell/navigation, not the underlying data model.

### Existing code to avoid reusing directly on phone

The current desktop shell patterns should not be carried onto phone unchanged:

- `ThreePanelLayout`
- permanent `LeftToolbar`
- `SplitHandle`
- desktop pane switching logic

These can remain for desktop while a dedicated mobile shell is introduced.

### Suggested implementation approach

1. Add layout mode detection for phone, tablet, and desktop.
2. Create a dedicated mobile shell component.
3. Build the mobile notes list as the default home screen.
4. Build mobile note detail using simplified rendering from the existing focus view.
5. Convert search into a mobile-first full-screen route.
6. Build a focused add flow for phone capture.
7. Keep advanced panes desktop-only in phase 1.
8. Update documentation to reflect the new multi-mode UI model.

## Rollout Phases

### Phase 1

- mobile shell
- notes list home screen
- note detail screen
- search screen
- add screen

This phase delivers the core mobile promise.

### Phase 2

- improve note detail child screens
- add lightweight saved sort/filter handling
- refine mobile editing behavior
- improve upload flow for capture

### Phase 3

- selective tablet enhancements
- evaluate whether any currently desktop-only surfaces deserve mobile access

## Risks

### Scope creep

The biggest risk is trying to preserve too much desktop parity on phone. This would dilute the clear capture-and-retrieval model.

### Overusing overlays

If too many mobile flows become sheets, drawers, or popovers, the design will lose the clean Apple Notes-like full-screen feel.

### Documentation drift

Current UI docs already lag behind the actual shell. The mobile project should include doc updates as behavior changes.

## Recommendation

Proceed with a mobile design that is intentionally narrower than desktop:

- default to notes list
- sort by last edited
- keep only search and add persistent
- use full-screen hierarchical navigation
- optimize for capture and retrieval
- leave advanced graph/admin workflows to larger screens

This gives RA-OS a mobile experience that feels coherent, useful, and maintainable.
