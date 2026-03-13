# FocusPanel Theme Sweep Design

## Goal

Finish the class-based theme primitive migration for the most visible remaining dark-first surfaces inside `FocusPanel`.

## Approach

Keep the current interaction model and layout intact, but replace the Edges tab styling cluster and the focus-owned top tab strip with semantic theme primitives and shared tokens from `app/globals.css`. This keeps `FocusPanel` aligned with the new theme architecture instead of layering more one-off light-mode patches onto a large file.

## Scope

- Migrate the Edges tab suggestion surfaces in `src/components/focus/FocusPanel.tsx`
- Migrate the Edges search box, suggestion list, connection rows, and inline explanation editor in `src/components/focus/FocusPanel.tsx`
- Migrate the focus-owned tab strip and nearby empty states in `src/components/focus/FocusPanel.tsx`
- Extend `tests/unit/focusTheme.test.ts` so the regression contract covers these `FocusPanel` surfaces

## Notes

This is a bounded `FocusPanel` cleanup, not a full rewrite of the file. The goal is to eliminate the remaining dark-only styling cluster that keeps showing up in screenshots, while preserving behavior and reducing future styling drift.
