# Dark Inline Code Prominence Design

## Goal

Make inline code segments in markdown more visually prominent in dark mode while keeping the lighter treatment already working well in light mode.

## Approach

Use shared semantic CSS variables for inline code background, border, and text. The markdown renderer already powers both the Source reader and the Docs modal, so updating that shared path gives us consistent behavior without duplicating styling logic.

## Scope

- Add inline-code theme tokens in [`app/globals.css`](/home/mario/srv/apps/ra-h_os/app/globals.css)
- Apply those tokens in [`src/components/helpers/MarkdownWithNodeTokens.tsx`](/home/mario/srv/apps/ra-h_os/src/components/helpers/MarkdownWithNodeTokens.tsx)
- Cover the regression with a focused unit test in [`tests/unit/focusTheme.test.ts`](/home/mario/srv/apps/ra-h_os/tests/unit/focusTheme.test.ts)

## Notes

Dark mode should gain stronger separation through a deeper chip background, visible border, and brighter code text. Light mode should remain subtle and readable.
