# Extension Hardening Plan (2026-03-18)

## Goal

Preserve one-click "capture from any source" UX while reducing privacy/security risk and improving ChatGPT capture reliability.

## Non-goals

- Do not limit capture scope to ChatGPT-only.
- Do not add a second user-facing activation step before capture.

## Phase 0: Baseline and Safety Net

1. Record current behavior matrix:
   - generic page URL save
   - generic page selection save
   - ChatGPT full conversation save
   - ChatGPT selection save
   - ChatGPT edited-prompt branch save
2. Ensure baseline tests exist for parser and markdown mapping.

## Phase 1: Injection Refactor (No UX Change)

1. Remove blanket background pre-injection across all tabs.
2. Keep single-click UX:
   - when user clicks extension action, inject `content.js` into active tab
   - immediately proceed with capture flow.
3. Keep all-source functionality unchanged.

Status: implemented in `public/bookmarklet-button/background.js`.

## Phase 2: API Auth Hardening for Extension Requests

1. Introduce extension token (one-time setup):
   - stored in extension settings (`chrome.storage.local`)
   - sent in `X-RAOS-Extension-Token` header.
2. Validate token in `/api/quick-add` and reject invalid/missing token with `401`.
3. Add rate limiting and payload-size limits on `/api/quick-add`.

Status: implemented in `app/api/quick-add/route.ts` with `RAOS_QUICK_ADD_REQUIRE_TOKEN` + `RAOS_EXTENSION_TOKEN`.
Explicit pairing flow implemented via:
- `POST /api/bookmarklet/pairing-code` (generate/revoke)
- `POST /api/bookmarklet/pair` (exchange one-time code for token)
- extension options pairing UI.

## Phase 3: Sensitive Domain Controls

1. Add extension options for:
   - denylist domains
   - allowlist-only mode (optional)
   - confirm-before-send toggle.
2. Enforce controls before sending payload.
3. Show clear toast reason when blocked.

Status: implemented in extension settings (`options.html` / `options.js`) and `background.js` domain checks.

## Phase 4: Data Minimization and Logging Hygiene

1. Keep selection cache ephemeral in page memory only.
2. Clear selection cache after send and on lifecycle boundaries (navigation/blur).
3. Remove content-like logs from production; keep status/error only.

Status: implemented in `background.js` (`DEBUG`-gated logs) and selection cache clear hooks in `content.js`.

## Phase 5: ChatGPT Accuracy and Fallbacks

1. Use `current_node` traversal to follow active branch/version.
2. Improve selection matching:
   - beginning-of-message probe
   - short-text containment path
   - chunk probing fallback.
3. Keep fallback to raw selected text when ChatGPT API extraction fails.

Status: implemented in `public/bookmarklet-button/background.js` and mirrored in `src/lib/chatgpt-parser.ts`.

## Phase 6: Sanitization and Rendering Safety

1. Add server-side sanitization for captured content before persistence.
2. Enforce protocol/tag allowlist (block `javascript:` links and unsafe attrs).
3. Add regression tests for common XSS payloads.
4. Keep render-time sanitization as defense in depth.

Status: ingest sanitization implemented in quick-add route via `src/services/security/sanitizeCapture.ts`.

## Phase 7: Documentation and Transparency

1. Document privacy/security behavior:
   - what is captured
   - when data is sent (on user click)
   - domain controls
   - token setup.
2. Add troubleshooting for auth failures and blocked domains.

Status: docs added in `docs/6_ui.md` and `docs/TROUBLESHOOTING.md`.

## Phase 8: Rollout

1. Ship hardening changes behind feature flags where applicable.
2. Roll out: internal -> beta -> default.
3. Monitor:
   - capture success rate
   - branch-correctness issues
   - auth rejection rates.

## Verification Checklist

- `npm run -s type-check`
- `npm test -- tests/unit/chatgpt-parser.test.ts tests/unit/markdownSourceMapping.test.ts`
- Manual extension flow checks for all matrix scenarios from Phase 0.
