# Podcast Extraction Design

**Date:** 2026-02-27
**Status:** Approved

---

## Problem

Users want to add podcast episodes to their knowledge base and have the transcript available for search and semantic retrieval. Entry URLs come from any podcast app — Spotify, Apple Podcasts, Pocket Casts, or a direct RSS feed. Transcripts may or may not exist; when they don't, ASR is an acceptable fallback.

---

## Approach

Two-phase extraction: a fast synchronous phase that creates the node immediately, and an async background phase that discovers or generates the transcript.

This matches the existing pattern for embeddings (`chunk_status`) and keeps the Quick-Add flow feeling instant.

---

## Architecture

### New files

- `src/services/typescript/extractors/podcast.ts` — synchronous phase: URL normalization, app-link resolution, episode metadata extraction. Returns immediately.
- `src/services/typescript/extractors/podcast-transcript.ts` — async phase: publisher page → RSS tag → Podcast Index → ASR prompt.
- `src/tools/other/podcastExtract.ts` — tool wrapper for agents/MCP.

### Modified files

- `src/services/agents/quickAdd.ts` — add `'podcast'` to `detectInputType()` for recognized hostnames.

No new API routes. No schema changes.

---

## URL Resolution (Sync Phase)

Convert app-specific share links to canonical episode metadata.

| Source | Method | Gets RSS? |
|---|---|---|
| Apple Podcasts (`podcasts.apple.com`) | iTunes Search API (free, no auth) | Yes |
| Pocket Casts (`pca.st`, `play.pocketcasts.com`) | Cheerio scrape of web player (JSON-LD) | Sometimes |
| Spotify (`open.spotify.com/episode`) | oEmbed endpoint (free, no auth) | No — metadata only |
| RSS feed URL directly | Parse XML directly | Yes |
| Unknown URL | Existing website extractor fallback | No |

**Spotify limitation:** Spotify does not expose RSS feeds in any public API and streams are DRM-protected. For Spotify URLs, the node is created with oEmbed metadata, `transcript_status: 'asr_pending_user'`, and the user is informed clearly in the UI.

---

## Transcript Discovery (Async Phase)

Runs in background after node creation. Steps in priority order:

1. **Publisher episode page** — scrape `episode_url`, extract long-form text content. Trust: medium (may be partial show notes, not full transcript).
2. **RSS `podcast:transcript` tag** — if `rss_feed_url` was resolved, fetch feed XML, look for `<podcast:transcript url="…" type="…" />`. Trust: high.
3. **Podcast Index API** — free, no auth. Given feed URL or episode, returns known transcript URLs. Trust: high.
4. **ASR** — only if steps 1–3 found nothing. Does not auto-trigger. See ASR UX below.

---

## ASR UX

When the transcript pipeline exhausts all free sources, the node surfaces a user prompt (inline on the node card):

> *No transcript found for this episode.*
>
> **[Transcribe free]** — local Whisper, slower, no cost
> **[Use OpenAI API ~$X.XX]** — fast, best quality *(shown only if OpenAI API key is configured)*

- Estimated price = `$0.006 × duration_minutes`, derived from `audio_url` metadata.
- User dismissing the prompt sets `transcript_status: 'unavailable'` — no error, just no transcript.
- If audio URL is inaccessible (Spotify CDN), the free path is disabled and the user is told why.

### Settings

New preference in Settings under "AI / Extraction":

**Local transcription model**
- `whisper-small` — faster, ~150MB download *(default)*
- `whisper-medium` — better accuracy, ~300MB download

Model is downloaded on first use via `@huggingface/transformers`, cached locally. Only affects the "Transcribe free" path. The API path always uses `whisper-large-v2`.

---

## Data Model

All podcast-specific data lives in `node.metadata` (existing JSON field). No schema migration needed.

```typescript
metadata: {
  // populated synchronously at node creation
  source: 'podcast_episode',
  podcast_name: string,
  episode_title: string,
  episode_url: string,
  rss_feed_url?: string,
  audio_url?: string,
  published_at?: string,
  duration_minutes?: number,
  cover_image_url?: string,
  resolution_source: 'itunes_api' | 'rss_direct' | 'pocket_casts_scrape' | 'spotify_oembed' | 'website_fallback',

  // populated asynchronously
  transcript_status: 'queued' | 'processing' | 'available' | 'asr_pending_user' | 'asr_processing' | 'unavailable',
  transcript_source?: 'publisher_page' | 'rss_tag' | 'podcast_index' | 'whisper_local' | 'whisper_api',
  transcript_url?: string,
  transcript_confidence?: 'high' | 'medium' | 'low',
  asr_model?: string,
  asr_cost_usd?: number,
}
```

`node.chunk` receives the final transcript text. The existing chunking/embedding pipeline picks it up automatically when `chunk_status` is set to `'not_chunked'`.

`node.link` stores the original URL pasted by the user.

---

## Error Handling

| Situation | Behavior |
|---|---|
| URL resolution fails entirely | Fall back to website extractor, always create node |
| Individual transcript step fails | Fail silently, try next step |
| All free transcript sources fail | Set `transcript_status: 'asr_pending_user'`, prompt user |
| Local model download fails | Surface error, offer API path as alternative |
| OpenAI API call fails | Show error on node, allow retry, roll back to `'asr_pending_user'` |
| Spotify DRM / audio inaccessible | Set `transcript_status: 'unavailable'`, inform user clearly |

---

## Out of Scope

- Feed subscription / automatic sync of new episodes
- Speaker diarization (identifying who said what)
- Chapter markers / timestamped sections
- Manual audio file upload for ASR (future feature)
