# Theme Primitives Refactor Design

## Goal

Refactor the app theme layer so components stop hardcoding dark and light styling inline, and instead compose a shared set of semantic CSS primitives backed by the existing theme tokens.

## Approach

Keep CSS variables as the source of truth for theme colors, then add reusable semantic classes in [`app/globals.css`](/home/mario/srv/apps/ra-h_os/app/globals.css) for common UI roles such as panels, buttons, inputs, tabs, badges, and rendered content. Migrate the highest-traffic components and content renderers onto those classes first so future elements have a default path that is already theme-aware.

## Scope

- Add semantic classes and markdown/content defaults in [`app/globals.css`](/home/mario/srv/apps/ra-h_os/app/globals.css)
- Migrate representative shell and interaction surfaces:
  - [`src/components/settings/SettingsModal.tsx`](/home/mario/srv/apps/ra-h_os/src/components/settings/SettingsModal.tsx)
  - [`src/components/focus/source/SourceReader.tsx`](/home/mario/srv/apps/ra-h_os/src/components/focus/source/SourceReader.tsx)
  - [`src/components/focus/source/SourceSearchBar.tsx`](/home/mario/srv/apps/ra-h_os/src/components/focus/source/SourceSearchBar.tsx)
  - [`src/components/views/ViewsOverlay.tsx`](/home/mario/srv/apps/ra-h_os/src/components/views/ViewsOverlay.tsx)
  - [`src/components/helpers/MarkdownWithNodeTokens.tsx`](/home/mario/srv/apps/ra-h_os/src/components/helpers/MarkdownWithNodeTokens.tsx)
  - [`src/components/focus/source/MappedMarkdownRenderer.tsx`](/home/mario/srv/apps/ra-h_os/src/components/focus/source/MappedMarkdownRenderer.tsx)
- Add regression coverage for the new primitives and migrated usage

## Notes

This is a foundation refactor, not a one-pass rewrite of every component. The first pass should establish clear primitives and move the most commonly reused UI patterns onto them so subsequent migrations become mechanical instead of bespoke.
