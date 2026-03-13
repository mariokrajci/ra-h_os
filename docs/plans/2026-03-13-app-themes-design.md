# App Themes Design

## Summary

Add a lightweight application theme system that supports `system`, `light`, and `dark` modes. The app should default to the system color preference on first load, persist manual overrides locally, and improve navigation contrast in both modes, especially dark mode where the current left toolbar blends into the background.

## Goals

- Support a true light theme for the application shell.
- Default to system preference without requiring user setup.
- Allow manual override through Settings.
- Improve the visibility of navigation and actions in dark mode.
- Keep the implementation small and focused on the app shell.

## Non-Goals

- Full visual redesign of every deep content surface.
- Replacing all inline styles in the application.
- Theming the reader-specific warm/dark controls.

## Current State

- The app shell is hard-coded to a dark palette in `app/globals.css`.
- The left toolbar uses inline dark colors with low separation between background, hover, and active states.
- The Settings modal has no theme controls.
- Local persistence infrastructure already exists via `usePersistentState`.

## Chosen Approach

Use a small app-level theme provider with semantic CSS variables:

- Persist `system | light | dark` using local storage.
- Resolve the effective theme from `matchMedia('(prefers-color-scheme: dark)')` when mode is `system`.
- Apply the resolved theme to the root element using `data-theme`.
- Define shell-level CSS variables for background, surface, elevated surface, border, text, muted text, hover, selected nav state, and accent.
- Update shell components to consume those variables instead of hard-coded dark values.

## Alternatives Considered

### 1. Patch only the toolbar and settings styles

This is fast but leaves the app with dark-only global styling and makes future theme changes harder.

### 2. Introduce a theming library

This adds dependency and abstraction overhead that the app does not need for a small shell-level feature.

## UI Behavior

### Theme selection

- Settings exposes three options: `System`, `Light`, `Dark`.
- `System` is the default for new users.
- Manual changes persist locally.

### Dark theme improvements

- Give the left toolbar a more distinct surface from the app background.
- Increase the contrast of idle icons and labels.
- Use clearer hover and active fills.
- Keep the accent color for active/open state, but ensure the selected state is visible even before the accent is noticed.

### Light theme direction

- Use a segmented shell with a bright background and clearly separated panels.
- Keep borders visible and text dark enough for dense productivity use.
- Maintain the existing green accent in a controlled way.

## Architecture

### New theme module

- Create a small theme context/provider in `src/components/theme/`.
- Expose:
  - current preference mode
  - resolved effective theme
  - setter for preference mode

### App integration

- Wrap the app tree in the provider from `app/layout.tsx`.
- Apply a `data-theme` attribute and `color-scheme` on the document root.

### Styling integration

- Add semantic variables in `app/globals.css`.
- Update shell components that define the current experience:
  - left toolbar
  - app shell backgrounds
  - settings modal surfaces and the new theme selector

## Testing Strategy

- Add unit tests for theme resolution and preference persistence behavior.
- Add a component test for the Settings modal theme selector behavior.
- Run repository-required checks:
  - `npm run type-check`
  - `npm run lint`
  - `npm run build`

## Risks

- Some deeper panes may still look dark-first if they rely heavily on hard-coded colors.
- Server-rendered markup can briefly render without the resolved theme until the client applies it.

## Mitigations

- Focus initial theming on the app shell and most visible navigation surfaces.
- Use semantic variables so follow-up theming work is incremental rather than ad hoc.
