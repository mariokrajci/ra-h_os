# Node Empty-State Actions — UI Redesign

**Date:** 2026-03-14
**Status:** Approved
**Location:** `src/components/focus/FocusPanel.tsx` ~L3132–3170

## Problem

When a node has no notes, four action buttons are shown stacked full-width. They are:
- Too wide (stretch to container width, look like form inputs)
- Hard to scan (no visual grouping, verbose labels, inconsistent icon use)

## Solution

Replace full-width stacked buttons with **compact centered pill-style buttons** in **three semantic groups**, separated by thin horizontal dividers.

### Groups

| Group | Actions | Lucide Icon |
|-------|---------|-------------|
| Notes | Write notes, Generate notes | `Pencil`, `Sparkles` |
| Source | View source | `BookOpen` |
| Graph | New linked node | `Link` |

### Layout

```
       [ Pencil  Write notes ]  [ Sparkles  Generate notes ]
       ────────────────────────────────────────────────────
                    [ BookOpen  View source ]
       ────────────────────────────────────────────────────
                   [ Link  New linked node ]
```

- All groups and buttons are **centered** (`justify-content: center`)
- Buttons use `app-button--compact` with `app-button--secondary` (except Write notes uses primary)
- Conditional buttons (View source, Generate notes) only render when node has a `chunk`
- `Sparkles` is the only new lucide import needed

## Files Changed

- `src/components/focus/FocusPanel.tsx` — update empty-state button block and add `Sparkles` to lucide import
