# Mobile UI Polish — Design

## Summary

Elevate the mobile experience from a functional implementation to a premium, editorially-considered product. Inspired by Apple Notes' navigation grammar but with RA-OS's own visual identity: an editorial flat-list style, strong typographic hierarchy, consistent screen headers, and native-feeling transitions and gestures.

This document covers both functional gaps identified in the post-implementation review and the broader visual redesign.

## Scope

### Functional improvements

1. **Screen slide transitions** — CSS keyframe animations driven by navigation direction
2. **Scrolling title in note detail header** — title fades in once the hero title scrolls out of view
3. **Timestamps in notes list** — relative time shown per row
4. **Tappable connections** — connected notes in the child screen navigate to that note
5. **Recent notes on empty search** — reuse `useNotesFeed` to show recents when query is empty
6. **Native mobile capture form** — drop `QuickAddInput`, build a purpose-built mobile composer
7. **Markdown stripping in previews** — strip markdown syntax before truncating preview text
8. **Auto-focus textarea on edit** — keyboard opens immediately when entering edit mode
9. **Empty state for notes list** — designed empty state with CTA when no notes exist
10. **Swipe-back gesture** — History API integration; `popstate` triggers back navigation

### Visual redesign

11. **Editorial flat list** — replace note cards with flat rows and hairline dividers
12. **Large collapsing header** — "Notes" heading at 32px/700 collapses into sticky header on scroll
13. **Type system** — system font stack (`ui-sans-serif, -apple-system`), strong weight contrast
14. **Consistent screen headers** — shared pattern: blur backdrop, chevron + parent label left, action right
15. **Connection count indicator** — subtle inline count on list rows for notes with connections
16. **Refined bottom bar** — 60px height, cleaner add button (`+`), refined search pill
17. **Hero note title** — 30px/700, generous reading layout (16px body, line-height 1.75)
18. **Flush child sections** — Connections/Source/Metadata as hairline-divided sections, not elevated cards
19. **Native capture composer** — bare textarea, text-tab mode toggle, bottom-anchored submit

## Architecture

### Navigation state

`MobileShell` gains `navDirection: 'forward' | 'backward' | 'none'` state alongside the existing route reducer. All `dispatch` calls are wrapped in a `navigate` function that sets direction before dispatching.

### History API (swipe-back)

`navigate` calls `history.pushState(null, '', window.location.href)` on every forward navigation. A `popstate` listener in `MobileShell` dispatches `back`. This gives native swipe-back on iOS Safari automatically.

### Screen transitions

CSS `@keyframes` in `globals.css`:
- `slideInFromRight` — forward navigation (`translateX(100%) → 0`)
- `slideInFromLeft` — backward navigation (`translateX(-100%) → 0`)
- Duration: 280ms, `ease-out`
- Each screen wrapper receives an `animation` style based on `navDirection`
- `MobileNoteDetail` keyed on `nodeId` so re-entering the same type replays the animation

### New utility

`src/components/mobile/formatRelativeTime.ts` — formats ISO date strings as relative labels ("just now", "2h ago", "Yesterday", "Mar 12", etc.)

## Screen Specifications

### Notes List

- Large "Notes" title (32px, 700) at top, collapses into sticky header title on scroll
- Sort shown as a labeled chip in the header row ("Recently edited ↕"), replaces the `···` menu
- Flat rows, hairline dividers (`var(--app-border)`, `0.5px`)
- Row layout: title (16px, 650) + one-line preview (14px, muted) + timestamp (12px, subtle, right-aligned)
- Optional connection count inline with preview for notes with edges
- Row min-height: 64px, touch target full-width
- Empty state: centered card with "No notes yet" + "Capture your first note" button
- Pending nodes shown above the list as before

### Note Detail

- Consistent sticky header: blur backdrop, `‹ Notes` back, action button right
- Title fades into header once hero scrolls out of view (threshold ~52px)
- Hero title: 30px, 700, generous top padding
- Timestamp subtitle: 12px, `--app-text-subtle`
- Notes content: 16px, line-height 1.75, comfortable reading width
- Edit mode: textarea auto-focuses via `useEffect` keyed on `editingNotes`
- Child sections (Connections, Source, Metadata): flush cards with hairline top border, labeled with uppercase 11px section headers

### Search

- Consistent sticky header: "‹ Notes" back, autofocused input below
- Empty state: "Recent" section using `useNotesFeed` (top 8, sorted by updated)
  - Same row style as notes list
- Loading state: "Searching…" in muted text during debounce/fetch
- No results: "No results for [query]"
- Results: title + one-line content snippet (dimensions removed as secondary info)

### Capture

- Full-screen composer, no desktop modal wrapper
- Mode toggle: two text tabs at top ("Note" / "Link"), tab-style, `--toolbar-accent` underline on active
- Note mode: bare growing textarea (no border, no outline, 18px, `--app-text`), placeholder "Write a note…"
- Link mode: URL input + optional description textarea
- Submit button: full-width, accent, anchored above safe area at bottom
- Disabled while input is empty or submitting

### Bottom Bar

- Height: 60px pills
- Search pill: `min(72vw, 280px)` wide, "Search notes…" placeholder label
- Add button: `+` icon (replaces `PenSquare`)
- Existing glassmorphism style retained and refined

## Routing Changes

`MobileNoteChildScreen` gains `onOpenNode: (nodeId: number) => void`. `MobileNoteDetail` passes this through. `MobileShell` wires it to dispatch `open-note`.

`MobileNotesList` gains `onOpenAdd: () => void` for the empty state CTA. Wired in `MobileShell`.

## New Files

- `src/components/mobile/formatRelativeTime.ts`

## Modified Files

- `src/components/mobile/MobileShell.tsx`
- `src/components/mobile/MobileNotesList.tsx`
- `src/components/mobile/MobileNoteDetail.tsx`
- `src/components/mobile/MobileNoteChildScreen.tsx`
- `src/components/mobile/MobileSearchScreen.tsx`
- `src/components/mobile/MobileCaptureScreen.tsx`
- `src/components/mobile/mobileNotesPresentation.ts`
- `app/globals.css`
