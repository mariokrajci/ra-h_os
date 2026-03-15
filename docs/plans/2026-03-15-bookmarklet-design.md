# Bookmarklet Design

**Date:** 2026-03-15

## Overview

A browser bookmarklet that sends content from any page to RA-OS with one click. Uses a hosted loader pattern (approach B): the bookmark contains a tiny snippet that fetches the real logic from the app, making updates transparent without re-installing the bookmark.

## Components

### 1. Bookmark Snippet

A one-liner saved in the browser's bookmarks bar:

```javascript
javascript:(function(){var s=document.createElement('script');s.src='http://localhost:3000/bookmarklet.js?_='+Date.now();document.head.appendChild(s);})();
```

- The URL is configurable via the settings/install page
- `?_=Date.now()` busts the cache on every click

### 2. Loader Script (`/public/bookmarklet.js`)

Served statically by Next.js. On click:

1. Read `window.getSelection().toString()`
2. **If selection present:** POST `{ input: selectedText, mode: 'note' | 'chat', sourceUrl: window.location.href, sourceTitle: document.title }`
   - Use `mode: 'chat'` when on `chatgpt.com`, otherwise `mode: 'note'`
3. **If no selection:** POST `{ input: window.location.href }` — let backend auto-detection handle type (YouTube, podcast, website, PDF)
4. Show toast: "Saved to RA-OS ✓" on success, "Failed ✗" on error

### 3. Backend Change (`/api/quick-add`)

Add optional fields to the request body:

```typescript
sourceUrl?: string   // origin page URL (when input is selected text)
sourceTitle?: string // page title
```

These are stored as metadata on the resulting note so the source is never lost.

### 4. Install Page

A new settings section (e.g. `/settings` or dedicated `/bookmarklet` page) that:

- Has a text input for the app URL (pre-filled with current origin)
- Shows the generated bookmarklet snippet, updating live as the URL changes
- Has a draggable anchor link the user drags to their bookmarks bar

## Data Flow

```
Browser click
  → bookmark snippet loads /bookmarklet.js from app
  → bookmarklet.js reads selection or URL + title
  → POST /api/quick-add { input, mode?, sourceUrl?, sourceTitle? }
  → toast confirmation
```

## Payload Summary

| Scenario | input | mode | sourceUrl | sourceTitle |
|----------|-------|------|-----------|-------------|
| No selection | current URL | (auto) | — | — |
| Text selected (ChatGPT) | selected text | chat | current URL | page title |
| Text selected (other) | selected text | note | current URL | page title |

## Out of Scope

- Browser extension
- PWA share target
- Automatic scraping of full page when text is selected
