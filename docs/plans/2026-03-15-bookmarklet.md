# Bookmarklet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a hosted-loader browser bookmarklet that sends the current page URL or selected text to `/api/quick-add`, with a toast confirmation, configurable via a new Settings tab.

**Architecture:** The bookmark itself is a one-liner that fetches `/public/bookmarklet.js` from the app. That script detects selection vs. URL, builds a payload with `sourceUrl`/`sourceTitle` for text selections, and POSTs to `/api/quick-add`. The backend gains two optional fields (`sourceUrl`, `sourceTitle`) threaded through to node creation.

**Tech Stack:** Next.js 15, TypeScript, Vitest, plain browser JS (no bundler for bookmarklet.js)

---

### Task 1: Extend `QuickAddInput` and thread `sourceUrl`/`sourceTitle` through the service

**Files:**
- Modify: `src/services/agents/quickAdd.ts:19-33` (QuickAddInput interface)
- Modify: `src/services/agents/quickAdd.ts:202-297` (handleNoteQuickAdd)
- Modify: `src/services/agents/quickAdd.ts:299-390` (handleChatTranscriptQuickAdd)
- Modify: `src/services/agents/quickAdd.ts:409` (enqueueQuickAdd)
- Test: `tests/unit/quick-add-source-url.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/quick-add-source-url.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch to capture what gets sent to /api/nodes
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('setImmediate', (fn: () => void) => fn());

// Mock external dependencies
vi.mock('@/services/agents/toolResultUtils', () => ({ summarizeToolExecution: vi.fn(() => '') }));
vi.mock('@/tools/other/youtubeExtract', () => ({ youtubeExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/websiteExtract', () => ({ websiteExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/paperExtract', () => ({ paperExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/podcastExtract', () => ({ podcastExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/infrastructure/nodeFormatter', () => ({ formatNodeForChat: vi.fn(() => '') }));
vi.mock('@/services/agents/transcriptSummarizer', () => ({
  summarizeTranscript: vi.fn(() => ({ summary: 'summary', subject: 'test' })),
}));
vi.mock('@/services/events', () => ({ eventBroadcaster: { broadcast: vi.fn() } }));
vi.mock('@/services/ingestion/bookMetadata', () => ({ fetchBookMetadata: vi.fn(() => null) }));
vi.mock('@/services/ingestion/bookCommand', () => ({
  parseBookCommand: vi.fn(() => ({ kind: 'none' })),
}));
vi.mock('@/services/ingestion/bookEnrichmentQueue', () => ({ bookEnrichmentQueue: { enqueue: vi.fn() } }));
vi.mock('@/services/analytics/bookTelemetry', () => ({ logBookTelemetry: vi.fn() }));
vi.mock('@/services/ingestion/bookCoverCache', () => ({ cacheBookCoverForNode: vi.fn() }));

import { enqueueQuickAdd } from '@/services/agents/quickAdd';

describe('enqueueQuickAdd with sourceUrl/sourceTitle', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 1 } }),
    });
  });

  it('passes sourceUrl as link and sourceTitle in metadata for note input', async () => {
    await enqueueQuickAdd({
      rawInput: 'Some selected text from an article',
      mode: 'note',
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Example Article',
      baseUrl: 'http://localhost:3000',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.link).toBe('https://example.com/article');
    expect(body.metadata.source_title).toBe('Example Article');
  });

  it('passes sourceUrl and sourceTitle for chat transcript input', async () => {
    await enqueueQuickAdd({
      rawInput: 'User: hello\nAssistant: hi there',
      mode: 'chat',
      sourceUrl: 'https://chatgpt.com/c/abc123',
      sourceTitle: 'ChatGPT conversation',
      baseUrl: 'http://localhost:3000',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.link).toBe('https://chatgpt.com/c/abc123');
    expect(body.metadata.source_title).toBe('ChatGPT conversation');
  });

  it('omits link and source_title when sourceUrl is not provided', async () => {
    await enqueueQuickAdd({
      rawInput: 'A plain note with no source',
      mode: 'note',
      baseUrl: 'http://localhost:3000',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.link).toBeUndefined();
    expect(body.metadata.source_title).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/quick-add-source-url.test.ts
```

Expected: FAIL — `sourceUrl` is not a known property on `QuickAddInput`.

**Step 3: Add `sourceUrl` and `sourceTitle` to `QuickAddInput`**

In `src/services/agents/quickAdd.ts`, update the interface at line 19:

```typescript
export interface QuickAddInput {
  rawInput: string;
  mode?: QuickAddMode;
  description?: string;
  baseUrl?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  bookSelection?: {
    title: string;
    author?: string;
    isbn?: string;
    cover_url?: string;
    publisher?: string;
    first_published_year?: number;
    page_count?: number;
  };
}
```

**Step 4: Thread `sourceUrl`/`sourceTitle` through `handleNoteQuickAdd`**

Update the function signature at line 202:

```typescript
async function handleNoteQuickAdd(
  rawInput: string,
  task: string,
  userDescription: string | undefined,
  apiBaseUrl: string,
  command?: BookCommandParseResult,
  bookSelection?: QuickAddInput['bookSelection'],
  sourceUrl?: string,
  sourceTitle?: string,
): Promise<string>
```

In the `nodePayload` at line 226, add `link` and `source_title`:

```typescript
const nodePayload: Record<string, unknown> = {
  title,
  ...(content ? { notes: content } : {}),
  ...(sourceUrl ? { link: sourceUrl } : {}),          // add this
  ...(isBookCommand ? { dimensions: ['books'] } : {}),
  metadata: {
    source: 'quick-add-note',
    ...(sourceTitle ? { source_title: sourceTitle } : {}),  // add this
    refined_at: new Date().toISOString(),
    // ... rest of existing metadata
```

**Step 5: Thread `sourceUrl`/`sourceTitle` through `handleChatTranscriptQuickAdd`**

Update the function signature at line 299:

```typescript
async function handleChatTranscriptQuickAdd(
  rawInput: string,
  task: string,
  apiBaseUrl: string,
  sourceUrl?: string,
  sourceTitle?: string,
): Promise<string>
```

In the `fetch` call body at line 362, add:

```typescript
body: JSON.stringify({
  title,
  notes: content,
  chunk: transcript,
  ...(sourceUrl ? { link: sourceUrl } : {}),
  metadata: {
    ...metadata,
    ...(sourceTitle ? { source_title: sourceTitle } : {}),
  },
}),
```

**Step 6: Thread through `enqueueQuickAdd`**

Update the function at line 409 to destructure and pass the new fields:

```typescript
export async function enqueueQuickAdd({
  rawInput, mode, description, baseUrl, bookSelection, sourceUrl, sourceTitle
}: QuickAddInput): Promise<QuickAddResult> {
```

In the `setImmediate` block, update the note and chat branches:

```typescript
if (inputType === 'note') {
  summary = await handleNoteQuickAdd(
    routing.normalizedInput, task, description, apiBaseUrl,
    routing.command, bookSelection, sourceUrl, sourceTitle   // add last two
  );
} else if (inputType === 'chat') {
  summary = await handleChatTranscriptQuickAdd(
    rawInput, task, apiBaseUrl, sourceUrl, sourceTitle       // add last two
  );
}
```

**Step 7: Run test to verify it passes**

```bash
npx vitest run tests/unit/quick-add-source-url.test.ts
```

Expected: PASS (3 tests)

**Step 8: Commit**

```bash
git add src/services/agents/quickAdd.ts tests/unit/quick-add-source-url.test.ts
git commit -m "feat: thread sourceUrl/sourceTitle through quickAdd service"
```

---

### Task 2: Extend the API route to accept `sourceUrl` and `sourceTitle`

**Files:**
- Modify: `app/api/quick-add/route.ts`

**Step 1: Write the failing test**

Create `tests/unit/quick-add-api-source-fields.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

// Mock enqueueQuickAdd to capture its arguments
const enqueueQuickAddMock = vi.fn(() =>
  Promise.resolve({ id: 'qa_1', task: 't', inputType: 'note', status: 'queued' })
);
vi.mock('@/services/agents/quickAdd', () => ({
  enqueueQuickAdd: enqueueQuickAddMock,
}));

import { POST } from '@/app/api/quick-add/route';
import { NextRequest } from 'next/server';

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/quick-add', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/quick-add sourceUrl/sourceTitle', () => {
  it('passes sourceUrl and sourceTitle to enqueueQuickAdd', async () => {
    await POST(makeRequest({
      input: 'Some selected text',
      mode: 'note',
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Example Article',
    }));

    expect(enqueueQuickAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUrl: 'https://example.com/article',
        sourceTitle: 'Example Article',
      })
    );
  });

  it('omits sourceUrl/sourceTitle when not provided', async () => {
    await POST(makeRequest({ input: 'just a note' }));

    expect(enqueueQuickAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUrl: undefined,
        sourceTitle: undefined,
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/quick-add-api-source-fields.test.ts
```

Expected: FAIL — route doesn't extract or pass `sourceUrl`/`sourceTitle`.

**Step 3: Update the API route**

In `app/api/quick-add/route.ts`, update the destructure at line 7:

```typescript
const { input, mode, description, bookSelection, sourceUrl, sourceTitle } = body as {
  input?: unknown;
  mode?: unknown;
  description?: unknown;
  bookSelection?: unknown;
  sourceUrl?: unknown;
  sourceTitle?: unknown;
};
```

Add normalization after `normalizedDescription`:

```typescript
const normalizedSourceUrl: string | undefined =
  typeof sourceUrl === 'string' && sourceUrl.trim() ? sourceUrl.trim() : undefined;
const normalizedSourceTitle: string | undefined =
  typeof sourceTitle === 'string' && sourceTitle.trim() ? sourceTitle.trim() : undefined;
```

Update the `enqueueQuickAdd` call:

```typescript
const delegation = await enqueueQuickAdd({
  rawInput: input.trim(),
  mode: normalizedMode,
  description: normalizedDescription,
  baseUrl: request.nextUrl.origin,
  bookSelection: normalizedBookSelection?.title ? normalizedBookSelection : undefined,
  sourceUrl: normalizedSourceUrl,
  sourceTitle: normalizedSourceTitle,
});
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/quick-add-api-source-fields.test.ts
```

Expected: PASS (2 tests)

**Step 5: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all existing tests still pass.

**Step 6: Commit**

```bash
git add app/api/quick-add/route.ts tests/unit/quick-add-api-source-fields.test.ts
git commit -m "feat: accept sourceUrl and sourceTitle in quick-add API"
```

---

### Task 3: Create `/public/bookmarklet.js`

**Files:**
- Create: `public/bookmarklet.js`

No unit tests for this file — it's pure browser JS. Manual verification steps are in Step 3.

**Step 1: Create the file**

Create `public/bookmarklet.js`:

```javascript
(function () {
  // Derive app base URL from this script's src (e.g. http://localhost:3000)
  var scriptSrc = document.currentScript && document.currentScript.src;
  var appUrl = scriptSrc
    ? scriptSrc.replace(/\/bookmarklet\.js.*$/, '')
    : 'http://localhost:3000';

  // Build payload
  var selection = window.getSelection ? window.getSelection().toString().trim() : '';
  var payload;

  if (selection) {
    var isChat = /chatgpt\.com|claude\.ai|gemini\.google\.com/i.test(window.location.hostname);
    payload = {
      input: selection,
      mode: isChat ? 'chat' : 'note',
      sourceUrl: window.location.href,
      sourceTitle: document.title || undefined,
    };
  } else {
    payload = { input: window.location.href };
  }

  // Toast helper
  function showToast(message, isError) {
    var existing = document.getElementById('__raos_toast__');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = '__raos_toast__';
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:2147483647',
      'padding:10px 18px',
      'border-radius:8px',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'font-size:14px',
      'font-weight:500',
      'color:#fff',
      'background:' + (isError ? '#e53e3e' : '#2d3748'),
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
      'transition:opacity 0.3s',
      'opacity:1',
    ].join(';');

    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // Send
  fetch(appUrl + '/api/quick-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showToast('Saved to RA-OS');
    })
    .catch(function () {
      showToast('Failed to save — is the app running?', true);
    });
})();
```

**Step 2: Verify the file is served**

Start the app (`npm run dev`) then open in browser:
```
http://localhost:3000/bookmarklet.js
```

Expected: the JS source is returned (not a 404).

**Step 3: Manual test — URL capture**

1. Navigate to any webpage (e.g. a news article)
2. Make sure nothing is selected
3. Open browser console, paste and run:
   ```javascript
   var s=document.createElement('script');s.src='http://localhost:3000/bookmarklet.js?_='+Date.now();document.head.appendChild(s);
   ```
4. Expected: dark toast "Saved to RA-OS" appears bottom-right; new node appears in app feed

**Step 4: Manual test — selection capture**

1. Navigate to a ChatGPT conversation
2. Select all (Cmd+A)
3. Run the same script snippet from Step 3
4. Expected: toast appears; new node created in app with `mode: chat`, source URL and title stored

**Step 5: Commit**

```bash
git add public/bookmarklet.js
git commit -m "feat: add hosted bookmarklet.js loader script"
```

---

### Task 4: Add Bookmarklet tab to SettingsModal

**Files:**
- Modify: `src/components/settings/SettingsModal.tsx`

No unit test — this is a UI component. Manual verification at the end.

**Step 1: Add `'bookmarklet'` to the `SettingsTab` type**

At line 16 in `SettingsModal.tsx`, add `'bookmarklet'` to the union:

```typescript
export type SettingsTab =
  | 'logs'
  | 'tools'
  | 'guides'
  | 'apikeys'
  | 'database'
  | 'context'
  | 'agents'
  | 'preferences'
  | 'flags'
  | 'bookmarklet';
```

**Step 2: Add the nav item**

After the `'flags'` nav item at line 211, add:

```tsx
<div onClick={() => setActiveTab('bookmarklet')} className={navItemClassName('bookmarklet')}>
  Bookmarklet
</div>
```

**Step 3: Add the tab title to the header**

After `{activeTab === 'flags' && 'Flags'}` at line 294, add:

```tsx
{activeTab === 'bookmarklet' && 'Bookmarklet'}
```

**Step 4: Build the bookmarklet tab content and wire it up**

Add a `BookmarkletTab` component inline in `SettingsModal.tsx`, above the `export default` line. It needs a `useState` for the URL input, pre-filled via `useEffect` from `window.location.origin`.

```tsx
function BookmarkletTab() {
  const [appUrl, setAppUrl] = useState('http://localhost:3000');

  useEffect(() => {
    setAppUrl(window.location.origin);
  }, []);

  const snippet = `javascript:(function(){var s=document.createElement('script');s.src='${appUrl}/bookmarklet.js?_='+Date.now();document.head.appendChild(s);})();`;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '560px' }}>
      <div>
        <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--app-text)', marginBottom: '6px' }}>
          Browser Bookmarklet
        </div>
        <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', lineHeight: 1.6 }}>
          Send any page or selected text to RA-OS with one click. Drag the button below to your bookmarks bar to install.
        </div>
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--app-text-subtle)', marginBottom: '8px' }}>
          App URL
        </div>
        <input
          type="text"
          value={appUrl}
          onChange={(e) => setAppUrl(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            borderRadius: '8px',
            border: '1px solid var(--app-border)',
            background: 'var(--app-input)',
            color: 'var(--app-text)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--app-text-subtle)', marginBottom: '8px' }}>
          Install
        </div>
        <a
          href={snippet}
          onClick={(e) => e.preventDefault()}
          draggable
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            borderRadius: '8px',
            background: 'var(--app-accent)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          Save to RA-OS
        </a>
        <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '8px' }}>
          Drag this to your bookmarks bar. Click on any page to save it.
        </div>
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--app-text-subtle)', marginBottom: '8px' }}>
          How it works
        </div>
        <div style={{ fontSize: '14px', color: 'var(--app-text-muted)', lineHeight: 1.7 }}>
          <div>• <strong>No selection:</strong> sends the current URL (auto-detected as article, YouTube, podcast, etc.)</div>
          <div>• <strong>Text selected:</strong> sends the selection as a note, with the page URL and title as source</div>
          <div>• <strong>ChatGPT / Claude / Gemini:</strong> selection is treated as a chat transcript and summarized</div>
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Render the tab**

After `{activeTab === 'flags' && <FlagsViewer />}` at line 329, add:

```tsx
{activeTab === 'bookmarklet' && <BookmarkletTab />}
```

**Step 6: Manual verification**

1. Open the app and go to Settings
2. Verify "Bookmarklet" appears in the left nav
3. Click it — the tab content should render with the URL input pre-filled with `http://localhost:3000`
4. Change the URL in the input — verify the draggable anchor's `href` updates live
5. Try dragging the "Save to RA-OS" button to the bookmarks bar

**Step 7: Commit**

```bash
git add src/components/settings/SettingsModal.tsx
git commit -m "feat: add Bookmarklet settings tab with install UI"
```

---

## Done

All four tasks complete. End-to-end manual test:

1. Go to Settings → Bookmarklet
2. Drag "Save to RA-OS" to bookmarks bar
3. Navigate to a YouTube video — click the bookmark — verify node appears in app
4. Navigate to a ChatGPT chat — Cmd+A — click bookmark — verify summarized node appears
