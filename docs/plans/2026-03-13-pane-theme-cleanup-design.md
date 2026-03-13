# Pane Theme Cleanup Design

## Summary

Extend the initial app theme work into the main inner panes so light mode feels coherent beyond the shell. This phase focuses on the highest-traffic surfaces and shared pane chrome rather than every single dark-first detail in the product.

## Goals

- Make light mode visually consistent across common pane interiors.
- Remove the most visible hard-coded dark shell colors from shared pane components.
- Preserve the improved dark-theme contrast introduced in the first theming phase.
- Keep behavior unchanged and limit scope to styling/token adoption.

## Non-Goals

- Full redesign of reader-specific document themes.
- Large refactors of pane component architecture.
- Fixing unrelated repository-wide lint/build issues.

## Current State

The app shell now follows `system`, `light`, and `dark` themes, but several inner panes still hard-code dark backgrounds, borders, and hover colors. The most noticeable mismatches appear in:

- pane headers and tabs
- node/focus pane chrome
- split handle
- logs and database surfaces
- map shell and map CSS
- some shared settings/list surfaces

## Chosen Approach

Tokenize in place, pane by pane:

- extend the global theme token set with a few more semantic surfaces
- update shared pane chrome first
- update the highest-traffic inner panes next
- reuse the existing CSS variable approach instead of creating a new styling abstraction

## Alternatives Considered

### 1. Broad helper abstraction first

Could reduce repetition later, but increases churn and risk now.

### 2. Visual patch-only pass

Would be faster, but would leave the UI inconsistent and harder to maintain.

## Scope

### Shared structural components

- `src/components/panes/PaneHeader.tsx`
- `src/components/layout/SplitHandle.tsx`
- `src/components/panes/NodePane.tsx`

### High-traffic pane interiors

- `src/components/focus/FocusPanel.tsx`
- `src/components/focus/focusPanelStyles.ts`
- `src/components/focus/source/SourceReader.tsx`
- `src/components/settings/LogsViewer.tsx`
- `src/components/settings/LogsRow.tsx`
- `src/components/settings/DatabaseViewer.tsx`
- `src/components/panes/MapPane.tsx`
- `src/components/panes/map/map-styles.css`
- `src/components/panes/library/LibraryFilters.tsx`

## Styling Plan

Add semantic tokens for:

- subtle surface
- strong surface
- input/control surface
- striped row surface
- hairline divider
- overlay edge/highlight states where needed

These should map cleanly across both dark and light themes.

## Testing Strategy

- Add focused unit tests for shared pane styling outputs where practical.
- Re-run the theme mode tests from phase 1.
- Run `npm run type-check`.
- Report `npm run lint` and `npm run build` status explicitly if they remain blocked by pre-existing issues.

## Risks

- Inline hover handlers may still restore old dark colors if not updated where touched.
- FocusPanel is large, so a targeted styling pass must avoid accidental behavior changes.

## Mitigations

- Limit changes to visually central surfaces and controls.
- Prefer token substitution over structural rewrites.
- Verify via focused tests and type-check after each pass.
