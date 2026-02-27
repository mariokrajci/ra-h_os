# Podcast Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add podcast episode support so users can paste any podcast app URL (Spotify, Apple, Pocket Casts, RSS), get a node created immediately, and receive a transcript asynchronously — either from hosted sources or via Whisper ASR.

**Architecture:** Two-phase extraction. Phase 1 (sync) resolves the URL to episode metadata and creates the node immediately. Phase 2 (async background) discovers or generates the transcript, updating the node when done. ASR requires explicit user confirmation before triggering.

**Tech Stack:** Next.js API routes, Vercel AI `tool()`, Cheerio for HTML/XML parsing, `@huggingface/transformers` for local Whisper, existing `openai` package for Whisper API, Vitest for tests.

---

## Task 1: Install dependency and add podcast URL detection

**Files:**
- Modify: `package.json`
- Modify: `src/services/agents/quickAdd.ts:11,27-51,54,56-60`
- Create: `src/services/typescript/extractors/__tests__/podcast-detection.test.ts`

**Step 1: Install @huggingface/transformers**

```bash
npm install @huggingface/transformers
```

Expected: package added to `node_modules`, `package.json` updated.

**Step 2: Write failing test for URL detection**

Create `src/services/typescript/extractors/__tests__/podcast-detection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectInputType } from '@/services/agents/quickAdd';

describe('detectInputType — podcast', () => {
  it('detects Spotify episode URL', () => {
    expect(detectInputType('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk')).toBe('podcast');
  });

  it('detects Apple Podcasts URL', () => {
    expect(detectInputType('https://podcasts.apple.com/us/podcast/lex-fridman-podcast/id1434243584?i=1000696785236')).toBe('podcast');
  });

  it('detects Pocket Casts short URL', () => {
    expect(detectInputType('https://pca.st/episode/abc123')).toBe('podcast');
  });

  it('detects Pocket Casts player URL', () => {
    expect(detectInputType('https://play.pocketcasts.com/podcasts/listen/abc123')).toBe('podcast');
  });

  it('detects RSS feed URL', () => {
    expect(detectInputType('https://feeds.simplecast.com/54nAGcIl')).toBe('podcast');
  });

  it('does NOT catch a regular website', () => {
    expect(detectInputType('https://example.com/blog/post')).toBe('website');
  });

  it('still detects YouTube before podcast check', () => {
    expect(detectInputType('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
  });
});
```

**Step 3: Run test to confirm it fails**

```bash
npm run test -- src/services/typescript/extractors/__tests__/podcast-detection.test.ts
```

Expected: FAIL — `'podcast'` type does not exist yet.

**Step 4: Add `'podcast'` to `QuickAddInputType` and detection logic**

In `src/services/agents/quickAdd.ts`, apply these changes:

Change line 11:
```typescript
// Before:
export type QuickAddInputType = 'youtube' | 'website' | 'pdf' | 'note' | 'chat';

// After:
export type QuickAddInputType = 'youtube' | 'podcast' | 'website' | 'pdf' | 'note' | 'chat';
```

In `detectInputType`, add the podcast check after the YouTube check and before the PDF check:
```typescript
export function detectInputType(raw: string, mode?: QuickAddMode): QuickAddInputType {
  if (mode === 'chat') return 'chat';
  if (mode === 'note') return 'note';

  const input = raw.trim();
  if (/youtu(\.be|be\.com)/i.test(input)) return 'youtube';
  // ADD THIS BLOCK:
  if (
    /open\.spotify\.com\/episode/i.test(input) ||
    /podcasts\.apple\.com/i.test(input) ||
    /pca\.st\//i.test(input) ||
    /play\.pocketcasts\.com/i.test(input) ||
    /feeds\.[a-z0-9-]+\.(com|fm|net|io)/i.test(input) ||
    /\/(feed|rss)(\/|$|\?)/i.test(input)
  ) return 'podcast';
  // END BLOCK
  if (/\.pdf($|\?)/i.test(input) || /arxiv\.org\//i.test(input)) return 'pdf';
  if (/^https?:\/\//i.test(input)) return 'website';
  if (!mode && isLikelyChatTranscript(input)) return 'chat';
  return 'note';
}
```

Add `'podcast'` case to `buildTaskPrompt`:
```typescript
case 'podcast':
  return `Quick Add: extract podcast episode and create node → ${input}`;
```

**Step 5: Run tests to confirm they pass**

```bash
npm run test -- src/services/typescript/extractors/__tests__/podcast-detection.test.ts
```

Expected: 7 passing.

**Step 6: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/services/agents/quickAdd.ts src/services/typescript/extractors/__tests__/podcast-detection.test.ts package.json package-lock.json
git commit -m "feat: add podcast URL detection and @huggingface/transformers dependency"
```

---

## Task 2: Create podcast.ts sync extractor

**Files:**
- Create: `src/services/typescript/extractors/podcast.ts`
- Create: `src/services/typescript/extractors/__tests__/podcast-resolver.test.ts`

**Step 1: Write failing tests**

Create `src/services/typescript/extractors/__tests__/podcast-resolver.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { detectPodcastSource, parseRssFeed, extractAudioUrl } from '@/services/typescript/extractors/podcast';

describe('detectPodcastSource', () => {
  it('identifies spotify URLs', () => {
    expect(detectPodcastSource('https://open.spotify.com/episode/abc')).toBe('spotify');
  });

  it('identifies apple podcast URLs', () => {
    expect(detectPodcastSource('https://podcasts.apple.com/us/podcast/show/id123')).toBe('apple');
  });

  it('identifies pocket casts short URLs', () => {
    expect(detectPodcastSource('https://pca.st/episode/abc')).toBe('pocket_casts');
  });

  it('identifies direct RSS feed URLs', () => {
    expect(detectPodcastSource('https://feeds.simplecast.com/54nAGcIl')).toBe('rss_direct');
  });

  it('falls back to website for unknown URLs', () => {
    expect(detectPodcastSource('https://example.com/episode/123')).toBe('website_fallback');
  });
});

describe('parseRssFeed', () => {
  it('extracts episodes from RSS XML', () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>My Podcast</title>
    <item>
      <title>Episode 42: Great stuff</title>
      <link>https://example.com/ep42</link>
      <enclosure url="https://cdn.example.com/ep42.mp3" type="audio/mpeg" length="12345"/>
      <itunes:duration>1800</itunes:duration>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
      <podcast:transcript url="https://example.com/ep42.txt" type="text/plain"/>
    </item>
  </channel>
</rss>`;
    const result = parseRssFeed(xml);
    expect(result.podcast_name).toBe('My Podcast');
    expect(result.episodes).toHaveLength(1);
    expect(result.episodes[0].episode_title).toBe('Episode 42: Great stuff');
    expect(result.episodes[0].audio_url).toBe('https://cdn.example.com/ep42.mp3');
    expect(result.episodes[0].duration_minutes).toBe(30);
    expect(result.episodes[0].transcript_url).toBe('https://example.com/ep42.txt');
  });
});

describe('extractAudioUrl', () => {
  it('returns audio URL from enclosure tag', () => {
    const xml = `<item><enclosure url="https://cdn.example.com/ep.mp3" type="audio/mpeg"/></item>`;
    expect(extractAudioUrl(xml)).toBe('https://cdn.example.com/ep.mp3');
  });

  it('returns null when no enclosure', () => {
    expect(extractAudioUrl('<item><title>No audio</title></item>')).toBeNull();
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
npm run test -- src/services/typescript/extractors/__tests__/podcast-resolver.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement podcast.ts**

Create `src/services/typescript/extractors/podcast.ts`:

```typescript
import * as cheerio from 'cheerio';

export type PodcastSource = 'spotify' | 'apple' | 'pocket_casts' | 'rss_direct' | 'website_fallback';

export interface PodcastEpisodeResult {
  podcast_name: string;
  episode_title: string;
  episode_url: string;
  rss_feed_url?: string;
  audio_url?: string;
  published_at?: string;
  duration_minutes?: number;
  cover_image_url?: string;
  description?: string;
  transcript_url?: string;
  resolution_source: PodcastSource;
}

export interface RssFeedResult {
  podcast_name: string;
  episodes: Array<{
    episode_title: string;
    episode_url: string;
    audio_url?: string;
    published_at?: string;
    duration_minutes?: number;
    description?: string;
    transcript_url?: string;
    transcript_type?: string;
  }>;
}

export interface ExtractionResult {
  success: boolean;
  content: string;
  chunk: string;
  metadata: PodcastEpisodeResult & {
    source: 'podcast_episode';
    transcript_status: 'queued' | 'available' | 'unavailable';
    transcript_source?: string;
    transcript_confidence?: 'high' | 'medium' | 'low';
  };
  error?: string;
}

export function detectPodcastSource(url: string): PodcastSource {
  if (/open\.spotify\.com\/episode/i.test(url)) return 'spotify';
  if (/podcasts\.apple\.com/i.test(url)) return 'apple';
  if (/pca\.st\//i.test(url) || /play\.pocketcasts\.com/i.test(url)) return 'pocket_casts';
  if (
    /feeds\.[a-z0-9-]+\.(com|fm|net|io)/i.test(url) ||
    /\/(feed|rss)(\/|$|\?)/i.test(url)
  ) return 'rss_direct';
  return 'website_fallback';
}

export function parseRssFeed(xml: string): RssFeedResult {
  const $ = cheerio.load(xml, { xmlMode: true });
  const podcast_name = $('channel > title').first().text().trim() || 'Unknown Podcast';

  const episodes: RssFeedResult['episodes'] = [];
  $('item').each((_, item) => {
    const $item = $(item);
    const enclosure = $item.find('enclosure');
    const audioUrl = enclosure.attr('url');
    const transcriptEl = $item.find('podcast\\:transcript, transcript');
    const durationRaw = $item.find('itunes\\:duration, duration').first().text().trim();

    let duration_minutes: number | undefined;
    if (durationRaw) {
      if (durationRaw.includes(':')) {
        const parts = durationRaw.split(':').map(Number);
        if (parts.length === 3) duration_minutes = parts[0] * 60 + parts[1] + parts[2] / 60;
        else if (parts.length === 2) duration_minutes = parts[0] + parts[1] / 60;
      } else {
        const secs = parseInt(durationRaw, 10);
        if (!isNaN(secs)) duration_minutes = secs / 60;
      }
      if (duration_minutes !== undefined) duration_minutes = Math.round(duration_minutes);
    }

    episodes.push({
      episode_title: $item.find('title').first().text().trim(),
      episode_url: $item.find('link').first().text().trim() || $item.find('guid').text().trim(),
      audio_url: audioUrl || undefined,
      published_at: $item.find('pubDate').text().trim() || undefined,
      duration_minutes,
      description: $item.find('description, itunes\\:summary').first().text().trim() || undefined,
      transcript_url: transcriptEl.attr('url') || undefined,
      transcript_type: transcriptEl.attr('type') || undefined,
    });
  });

  return { podcast_name, episodes };
}

export function extractAudioUrl(xml: string): string | null {
  const $ = cheerio.load(xml, { xmlMode: true });
  const url = $('enclosure').attr('url');
  return url || null;
}

async function resolveApplePodcastsUrl(url: string): Promise<Partial<PodcastEpisodeResult> | null> {
  try {
    // Extract the episode ID from the URL (?i=<episodeId>)
    const episodeIdMatch = url.match(/[?&]i=(\d+)/);
    const showIdMatch = url.match(/\/id(\d+)/);
    if (!showIdMatch) return null;

    const showId = showIdMatch[1];
    const lookupUrl = episodeIdMatch
      ? `https://itunes.apple.com/lookup?id=${episodeIdMatch[1]}&entity=podcastEpisode`
      : `https://itunes.apple.com/lookup?id=${showId}&entity=podcastEpisode&limit=1`;

    const res = await fetch(lookupUrl);
    if (!res.ok) return null;
    const data = await res.json();

    const results: any[] = data.results || [];
    // results[0] is the show; results[1+] are episodes (when entity=podcastEpisode)
    const episode = results.find((r: any) => r.kind === 'podcast-episode') || results[0];
    const show = results.find((r: any) => r.kind === 'podcast') || results[0];

    return {
      podcast_name: show?.collectionName || episode?.collectionName || 'Unknown',
      episode_title: episode?.trackName || 'Unknown Episode',
      episode_url: episode?.trackViewUrl || url,
      audio_url: episode?.episodeUrl,
      rss_feed_url: show?.feedUrl,
      published_at: episode?.releaseDate,
      duration_minutes: episode?.trackTimeMillis ? Math.round(episode.trackTimeMillis / 60000) : undefined,
      cover_image_url: show?.artworkUrl600 || episode?.artworkUrl600,
      description: episode?.description,
      resolution_source: 'apple' as PodcastSource,
    };
  } catch {
    return null;
  }
}

async function resolveSpotifyUrl(url: string): Promise<Partial<PodcastEpisodeResult> | null> {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      episode_title: data.title || 'Unknown Episode',
      podcast_name: data.provider_name || 'Spotify Podcast',
      episode_url: url,
      cover_image_url: data.thumbnail_url,
      // No RSS feed or audio URL — Spotify streams are DRM-protected
      resolution_source: 'spotify' as PodcastSource,
    };
  } catch {
    return null;
  }
}

async function resolvePocketCastsUrl(url: string): Promise<Partial<PodcastEpisodeResult> | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Try JSON-LD first
    let jsonLd: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        if (parsed['@type'] === 'PodcastEpisode' || parsed['@type'] === 'Episode') {
          jsonLd = parsed;
        }
      } catch { /* ignore parse errors */ }
    });

    if (jsonLd) {
      return {
        episode_title: jsonLd.name || jsonLd.headline,
        podcast_name: jsonLd.partOfSeries?.name || jsonLd.isPartOf?.name || 'Unknown',
        episode_url: jsonLd.url || url,
        audio_url: jsonLd.associatedMedia?.contentUrl || jsonLd.contentUrl,
        published_at: jsonLd.datePublished,
        description: jsonLd.description,
        resolution_source: 'pocket_casts' as PodcastSource,
      };
    }

    // Fallback: meta tags
    return {
      episode_title: $('meta[property="og:title"]').attr('content') || $('title').text().trim(),
      podcast_name: $('meta[property="og:site_name"]').attr('content') || 'Unknown',
      episode_url: url,
      cover_image_url: $('meta[property="og:image"]').attr('content'),
      description: $('meta[property="og:description"]').attr('content'),
      resolution_source: 'pocket_casts' as PodcastSource,
    };
  } catch {
    return null;
  }
}

async function resolveRssFeed(url: string): Promise<Partial<PodcastEpisodeResult> | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' }
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const feed = parseRssFeed(xml);
    const latest = feed.episodes[0];
    if (!latest) return null;
    return {
      podcast_name: feed.podcast_name,
      episode_title: latest.episode_title,
      episode_url: latest.episode_url,
      rss_feed_url: url,
      audio_url: latest.audio_url,
      published_at: latest.published_at,
      duration_minutes: latest.duration_minutes,
      description: latest.description,
      transcript_url: latest.transcript_url,
      resolution_source: 'rss_direct' as PodcastSource,
    };
  } catch {
    return null;
  }
}

async function resolveWebsiteFallback(url: string): Promise<Partial<PodcastEpisodeResult>> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' }
    });
    const html = res.ok ? await res.text() : '';
    const $ = cheerio.load(html);
    return {
      episode_title: $('meta[property="og:title"]').attr('content') || $('title').text().trim() || url,
      podcast_name: $('meta[property="og:site_name"]').attr('content') || new URL(url).hostname,
      episode_url: url,
      cover_image_url: $('meta[property="og:image"]').attr('content'),
      description: $('meta[property="og:description"]').attr('content'),
      resolution_source: 'website_fallback' as PodcastSource,
    };
  } catch {
    return {
      episode_title: url,
      podcast_name: 'Unknown Podcast',
      episode_url: url,
      resolution_source: 'website_fallback',
    };
  }
}

export async function extractPodcast(url: string): Promise<ExtractionResult> {
  const source = detectPodcastSource(url);

  let resolved: Partial<PodcastEpisodeResult> | null = null;

  switch (source) {
    case 'apple':
      resolved = await resolveApplePodcastsUrl(url);
      break;
    case 'spotify':
      resolved = await resolveSpotifyUrl(url);
      break;
    case 'pocket_casts':
      resolved = await resolvePocketCastsUrl(url);
      break;
    case 'rss_direct':
      resolved = await resolveRssFeed(url);
      break;
    case 'website_fallback':
      resolved = null;
      break;
  }

  // Always have a result
  if (!resolved) {
    resolved = await resolveWebsiteFallback(url);
  }

  const metadata: ExtractionResult['metadata'] = {
    source: 'podcast_episode',
    podcast_name: resolved.podcast_name || 'Unknown Podcast',
    episode_title: resolved.episode_title || 'Unknown Episode',
    episode_url: resolved.episode_url || url,
    rss_feed_url: resolved.rss_feed_url,
    audio_url: resolved.audio_url,
    published_at: resolved.published_at,
    duration_minutes: resolved.duration_minutes,
    cover_image_url: resolved.cover_image_url,
    description: resolved.description,
    resolution_source: resolved.resolution_source || 'website_fallback',
    // If we already have a transcript URL from RSS, mark as available
    transcript_status: resolved.transcript_url ? 'available' : 'queued',
    transcript_source: resolved.transcript_url ? 'rss_tag' : undefined,
    transcript_url: resolved.transcript_url,
    transcript_confidence: resolved.transcript_url ? 'high' : undefined,
  };

  const contentLines = [
    `# ${metadata.episode_title}`,
    `**Podcast:** ${metadata.podcast_name}`,
    metadata.published_at ? `**Published:** ${metadata.published_at}` : '',
    metadata.duration_minutes ? `**Duration:** ${metadata.duration_minutes} min` : '',
    '',
    metadata.description || '',
  ].filter(Boolean);

  const content = contentLines.join('\n');

  return {
    success: true,
    content,
    chunk: metadata.description || content,
    metadata,
  };
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm run test -- src/services/typescript/extractors/__tests__/podcast-resolver.test.ts
```

Expected: all passing.

**Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/services/typescript/extractors/podcast.ts src/services/typescript/extractors/__tests__/podcast-resolver.test.ts
git commit -m "feat: add podcast sync extractor with Apple/Spotify/PocketCasts/RSS resolution"
```

---

## Task 3: Create podcast-transcript.ts async discovery pipeline

**Files:**
- Create: `src/services/typescript/extractors/podcast-transcript.ts`

**Step 1: Write the module**

Create `src/services/typescript/extractors/podcast-transcript.ts`:

```typescript
import * as cheerio from 'cheerio';
import { nodeService } from '@/services/database';
import { eventBroadcaster } from '@/services/events';
import { parseRssFeed } from './podcast';

type TranscriptResult = {
  text: string;
  source: 'publisher_page' | 'rss_tag' | 'podcast_index';
  url?: string;
  confidence: 'high' | 'medium' | 'low';
};

async function scrapePublisherPage(episodeUrl: string): Promise<TranscriptResult | null> {
  try {
    const res = await fetch(episodeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Look for transcript sections by common class/id names and aria labels
    const selectors = [
      '[class*="transcript"]',
      '[id*="transcript"]',
      '[aria-label*="transcript" i]',
      'article',
      '.show-notes',
      '#show-notes',
    ];

    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().trim();
        // Require minimum length to avoid empty containers
        if (text.length > 500) {
          return {
            text,
            source: 'publisher_page',
            url: episodeUrl,
            confidence: sel.includes('transcript') ? 'high' : 'low',
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchRssTranscript(rssFeedUrl: string, episodeUrl: string): Promise<TranscriptResult | null> {
  try {
    const res = await fetch(rssFeedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' }
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const feed = parseRssFeed(xml);

    // Find the matching episode
    const episode = feed.episodes.find(ep =>
      ep.episode_url === episodeUrl ||
      ep.transcript_url !== undefined
    );
    if (!episode?.transcript_url) return null;

    // Fetch the transcript content
    const transcriptRes = await fetch(episode.transcript_url);
    if (!transcriptRes.ok) return null;
    const contentType = transcriptRes.headers.get('content-type') || '';
    let text = await transcriptRes.text();

    // Strip HTML if needed
    if (contentType.includes('html')) {
      const $ = cheerio.load(text);
      text = $.text();
    }

    return {
      text: text.trim(),
      source: 'rss_tag',
      url: episode.transcript_url,
      confidence: 'high',
    };
  } catch {
    return null;
  }
}

async function fetchPodcastIndexTranscript(rssFeedUrl: string, episodeUrl: string): Promise<TranscriptResult | null> {
  try {
    // Podcast Index API — free, no auth required for basic lookups
    // Using the feed URL to find episode transcripts
    const apiUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedurl?url=${encodeURIComponent(rssFeedUrl)}&max=20`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'RAH-knowledgebase/1.0',
        'X-Auth-Date': String(Math.floor(Date.now() / 1000)),
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = data.items || [];

    const episode = items.find((item: any) =>
      item.link === episodeUrl ||
      item.enclosureUrl === episodeUrl
    );

    if (!episode?.transcripts?.length) return null;
    const transcript = episode.transcripts[0];

    const transcriptRes = await fetch(transcript.url);
    if (!transcriptRes.ok) return null;
    const text = await transcriptRes.text();

    return {
      text: text.trim(),
      source: 'podcast_index',
      url: transcript.url,
      confidence: 'high',
    };
  } catch {
    return null;
  }
}

async function updateNodeWithTranscript(
  nodeId: number,
  transcript: TranscriptResult
): Promise<void> {
  await nodeService.updateNode(nodeId, {
    chunk: transcript.text,
    chunk_status: 'not_chunked',
    metadata: {
      transcript_status: 'available',
      transcript_source: transcript.source,
      transcript_url: transcript.url,
      transcript_confidence: transcript.confidence,
    },
  });
  eventBroadcaster.broadcast({ type: 'NODE_UPDATED', nodeId });
}

async function updateNodeTranscriptStatus(
  nodeId: number,
  status: 'asr_pending_user' | 'unavailable',
  existingMetadata: any
): Promise<void> {
  await nodeService.updateNode(nodeId, {
    metadata: {
      ...existingMetadata,
      transcript_status: status,
    },
  });
  eventBroadcaster.broadcast({ type: 'NODE_UPDATED', nodeId });
}

export async function discoverTranscript(nodeId: number): Promise<void> {
  const node = await nodeService.getNodeById(nodeId);
  if (!node?.metadata) return;

  const meta = node.metadata;

  // Update status to 'processing'
  await nodeService.updateNode(nodeId, {
    metadata: { ...meta, transcript_status: 'processing' },
  });

  let result: TranscriptResult | null = null;

  // Step 1: Publisher episode page
  if (meta.episode_url) {
    result = await scrapePublisherPage(meta.episode_url);
  }

  // Step 2: RSS podcast:transcript tag
  if (!result && meta.rss_feed_url) {
    result = await fetchRssTranscript(meta.rss_feed_url, meta.episode_url);
  }

  // Step 3: Podcast Index API
  if (!result && meta.rss_feed_url) {
    result = await fetchPodcastIndexTranscript(meta.rss_feed_url, meta.episode_url);
  }

  if (result && result.text.length > 200) {
    await updateNodeWithTranscript(nodeId, result);
  } else {
    await updateNodeTranscriptStatus(nodeId, 'asr_pending_user', meta);
  }
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/services/typescript/extractors/podcast-transcript.ts
git commit -m "feat: add async podcast transcript discovery pipeline (publisher page, RSS, Podcast Index)"
```

---

## Task 4: Create podcastExtract.ts tool wrapper

**Files:**
- Create: `src/tools/other/podcastExtract.ts`

**Step 1: Create the tool wrapper**

Create `src/tools/other/podcastExtract.ts`. Study `src/tools/other/youtubeExtract.ts` first — this follows the same pattern but adapts for podcasts.

```typescript
import { tool } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { extractPodcast } from '@/services/typescript/extractors/podcast';
import { discoverTranscript } from '@/services/typescript/extractors/podcast-transcript';
import { formatNodeForChat } from '../infrastructure/nodeFormatter';
import { getOpenAIChatModel } from '@/config/openaiModels';
import { logAiUsage, normalizeUsageFromAiSdk } from '@/services/analytics/usageLogger';

async function analyzePodcastWithAI(episodeTitle: string, podcastName: string, description: string) {
  try {
    const prompt = `Analyze this podcast episode for a knowledge graph entry.

Podcast: "${podcastName}"
Episode: "${episodeTitle}"
Description: "${description}"

CRITICAL — nodeDescription rules (max 280 chars):
1. Say WHAT this literally is: "Podcast episode where…", "Interview with…"
2. Name the podcast and guest/host by role.
3. State the actual topic or thesis — don't be vague.
4. End with why it's interesting — one concrete phrase.
5. FORBIDDEN: "discusses", "explores", "examines", "delves into".

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "nodeDescription": "<280-char description>",
  "tags": ["relevant", "semantic", "tags"],
  "reasoning": "Brief explanation"
}`;

    const response = await generateText({
      model: openai(getOpenAIChatModel()),
      prompt,
      maxOutputTokens: 400,
    });

    const usage = normalizeUsageFromAiSdk(response);
    if (usage) {
      logAiUsage({
        feature: 'podcast_content_analysis',
        provider: 'openai',
        modelId: getOpenAIChatModel(),
        usage,
      });
    }

    let content = response.text || '{}';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(content);

    return {
      nodeDescription: typeof result.nodeDescription === 'string'
        ? result.nodeDescription.slice(0, 280)
        : undefined,
      tags: Array.isArray(result.tags) ? result.tags : [],
    };
  } catch {
    return { nodeDescription: undefined, tags: [] };
  }
}

export const podcastExtractTool = tool({
  description: 'Extract podcast episode metadata, create a knowledge node, and discover the transcript asynchronously.',
  inputSchema: z.object({
    url: z.string().describe('The podcast episode URL (Spotify, Apple, Pocket Casts, RSS feed, or episode page)'),
    title: z.string().optional().describe('Optional override for the episode title'),
    dimensions: z.array(z.string()).min(1).max(5).optional().describe('Dimensions/tags for the node'),
  }),
  execute: async ({ url, title, dimensions }) => {
    // Phase 1: Synchronous extraction
    const extraction = await extractPodcast(url);

    if (!extraction.success) {
      return {
        success: false,
        error: extraction.error || 'Failed to extract podcast metadata',
        data: null,
      };
    }

    const meta = extraction.metadata;
    const episodeTitle = title || meta.episode_title;

    // AI analysis (optional — falls back gracefully)
    const ai = await analyzePodcastWithAI(
      episodeTitle,
      meta.podcast_name,
      meta.description || ''
    );

    const nodeDimensions = [
      ...(dimensions || []),
      ...(ai.tags || []),
      'podcast',
    ].slice(0, 8);

    // Create node immediately
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: episodeTitle,
        description: ai.nodeDescription || `${meta.podcast_name} — ${episodeTitle}`,
        link: url,
        dimensions: nodeDimensions,
        chunk: extraction.chunk || undefined,
        chunk_status: extraction.chunk?.length ? 'not_chunked' : null,
        metadata: meta,
      }),
    });

    const nodeData = await response.json();
    const nodeId: number = nodeData?.data?.id;

    if (!nodeId) {
      return {
        success: false,
        error: 'Failed to create node',
        data: null,
      };
    }

    // Phase 2: Trigger async transcript discovery (fire-and-forget)
    // Only if transcript not already found during URL resolution
    if (meta.transcript_status === 'queued') {
      setImmediate(() => {
        discoverTranscript(nodeId).catch(err =>
          console.error(`[podcast] transcript discovery failed for node ${nodeId}:`, err)
        );
      });
    }

    const node = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/nodes/${nodeId}`
    ).then(r => r.json()).catch(() => null);

    return {
      success: true,
      data: { nodeId, title: episodeTitle },
      message: `Created podcast node: ${episodeTitle}. Transcript discovery running in background.`,
      nodeReference: node?.data ? formatNodeForChat(node.data) : `Node #${nodeId}: ${episodeTitle}`,
    };
  },
});
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/tools/other/podcastExtract.ts
git commit -m "feat: add podcastExtract tool wrapper with async transcript discovery"
```

---

## Task 5: Wire podcast into quickAdd

**Files:**
- Modify: `src/services/agents/quickAdd.ts`

**Step 1: Read the file to see the current EXTRACTION_TOOL_MAP and ExtractionQuickAddType**

Lines 54–60 of `src/services/agents/quickAdd.ts`.

**Step 2: Add podcast to the tool map**

Add the import at the top of `quickAdd.ts`:
```typescript
import { podcastExtractTool } from '@/tools/other/podcastExtract';
```

Change line 54:
```typescript
// Before:
type ExtractionQuickAddType = Extract<QuickAddInputType, 'youtube' | 'website' | 'pdf'>;

// After:
type ExtractionQuickAddType = Extract<QuickAddInputType, 'youtube' | 'podcast' | 'website' | 'pdf'>;
```

Add to `EXTRACTION_TOOL_MAP`:
```typescript
const EXTRACTION_TOOL_MAP = {
  youtube: { toolName: 'youtubeExtract' as const, execute: youtubeExtractTool.execute },
  podcast: { toolName: 'podcastExtract' as const, execute: podcastExtractTool.execute },
  website: { toolName: 'websiteExtract' as const, execute: websiteExtractTool.execute },
  pdf: { toolName: 'paperExtract' as const, execute: paperExtractTool.execute },
};
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 4: Run all tests**

```bash
npm run test
```

Expected: all passing.

**Step 5: Commit**

```bash
git add src/services/agents/quickAdd.ts
git commit -m "feat: wire podcast into quickAdd extraction pipeline"
```

---

## Task 6: Create podcast-asr.ts (local Whisper + OpenAI API)

**Files:**
- Create: `src/services/typescript/extractors/podcast-asr.ts`

**Step 1: Create the ASR module**

Create `src/services/typescript/extractors/podcast-asr.ts`:

```typescript
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createReadStream } from 'fs';
import OpenAI from 'openai';

export type WhisperLocalModel = 'whisper-small' | 'whisper-medium';

export interface ASRResult {
  transcript: string;
  model: string;
  cost_usd?: number;
}

async function downloadAudioToTemp(audioUrl: string): Promise<string> {
  const res = await fetch(audioUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' },
  });
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status} ${audioUrl}`);

  const contentType = res.headers.get('content-type') || 'audio/mpeg';
  const ext = contentType.includes('ogg') ? '.ogg' : contentType.includes('wav') ? '.wav' : '.mp3';
  const tempPath = join(tmpdir(), `rah-podcast-${Date.now()}${ext}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(tempPath, buffer);
  return tempPath;
}

export async function transcribeWithLocalWhisper(
  audioUrl: string,
  model: WhisperLocalModel = 'whisper-small'
): Promise<ASRResult> {
  // Dynamic import so the large @huggingface/transformers package
  // is only loaded when local ASR is actually requested.
  const { pipeline } = await import('@huggingface/transformers');

  const modelId = model === 'whisper-medium'
    ? 'Xenova/whisper-medium'
    : 'Xenova/whisper-small';

  const tempPath = await downloadAudioToTemp(audioUrl);

  try {
    const transcriber = await pipeline('automatic-speech-recognition', modelId);
    const result = await transcriber(tempPath, { return_timestamps: false }) as { text: string };
    return {
      transcript: result.text.trim(),
      model: modelId,
    };
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

export async function transcribeWithOpenAIApi(
  audioUrl: string,
  durationMinutes?: number
): Promise<ASRResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const tempPath = await downloadAudioToTemp(audioUrl);

  try {
    const client = new OpenAI({ apiKey });
    const transcription = await client.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'text',
    });

    const cost_usd = durationMinutes ? Math.round(durationMinutes * 0.006 * 100) / 100 : undefined;

    return {
      transcript: typeof transcription === 'string' ? transcription.trim() : '',
      model: 'whisper-1',
      cost_usd,
    };
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

export function estimateAsrCost(durationMinutes: number | undefined): string | null {
  if (!durationMinutes) return null;
  return `$${(durationMinutes * 0.006).toFixed(2)}`;
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/services/typescript/extractors/podcast-asr.ts
git commit -m "feat: add podcast ASR module (local Whisper via transformers.js + OpenAI Whisper API)"
```

---

## Task 7: Add POST /api/nodes/[id]/podcast-transcript route

**Files:**
- Create: `app/api/nodes/[id]/podcast-transcript/route.ts`

**Step 1: Read the existing `app/api/nodes/[id]/route.ts`**

Read the file to understand the pattern (how params are received, how nodeService is used, error response shape).

**Step 2: Create the route**

Create `app/api/nodes/[id]/podcast-transcript/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { eventBroadcaster } from '@/services/events';
import { transcribeWithLocalWhisper, transcribeWithOpenAIApi } from '@/services/typescript/extractors/podcast-asr';
import type { WhisperLocalModel } from '@/services/typescript/extractors/podcast-asr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const nodeId = parseInt(id, 10);
  if (isNaN(nodeId)) {
    return NextResponse.json({ error: 'Invalid node ID' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const method: 'local' | 'api' = body.method === 'api' ? 'api' : 'local';
  const model: WhisperLocalModel = body.model === 'whisper-medium' ? 'whisper-medium' : 'whisper-small';

  const node = await nodeService.getNodeById(nodeId);
  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  const meta = node.metadata || {};

  if (!meta.audio_url) {
    return NextResponse.json({ error: 'No audio URL available for this episode' }, { status: 422 });
  }

  if (meta.transcript_status !== 'asr_pending_user') {
    return NextResponse.json(
      { error: `Unexpected transcript_status: ${meta.transcript_status}` },
      { status: 409 }
    );
  }

  // Mark as processing immediately
  await nodeService.updateNode(nodeId, {
    metadata: { ...meta, transcript_status: 'asr_processing' },
  });
  eventBroadcaster.broadcast({ type: 'NODE_UPDATED', nodeId });

  // Run ASR in background — respond immediately
  setImmediate(async () => {
    try {
      const result = method === 'api'
        ? await transcribeWithOpenAIApi(meta.audio_url, meta.duration_minutes)
        : await transcribeWithLocalWhisper(meta.audio_url, model);

      await nodeService.updateNode(nodeId, {
        chunk: result.transcript,
        chunk_status: 'not_chunked',
        metadata: {
          ...meta,
          transcript_status: 'available',
          transcript_source: method === 'api' ? 'whisper_api' : 'whisper_local',
          transcript_confidence: 'high',
          asr_model: result.model,
          asr_cost_usd: result.cost_usd,
        },
      });

      // Trigger embedding pipeline
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ingestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });

      eventBroadcaster.broadcast({ type: 'NODE_UPDATED', nodeId });
    } catch (err) {
      console.error(`[podcast-asr] ASR failed for node ${nodeId}:`, err);
      await nodeService.updateNode(nodeId, {
        metadata: { ...meta, transcript_status: 'asr_pending_user' },
      });
      eventBroadcaster.broadcast({ type: 'NODE_UPDATED', nodeId });
    }
  });

  return NextResponse.json({ success: true, message: 'Transcription started' });
}
```

**Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 4: Commit**

```bash
git add app/api/nodes/[id]/podcast-transcript/route.ts
git commit -m "feat: add POST /api/nodes/[id]/podcast-transcript route for ASR triggering"
```

---

## Task 8: Add ASR prompt UI to node detail view

**Files:**
- Locate the node detail/focus panel component (likely `src/components/FocusPanel` or similar)
- Create: `src/components/PodcastTranscriptPrompt.tsx`

**Step 1: Find the correct component**

```bash
grep -r "transcript_status\|chunk_status\|node\.metadata" src/components --include="*.tsx" -l
```

Also look for where `node.metadata` is rendered in the node detail view. The file showing node metadata is likely in `src/components/` — check `FocusPanel.tsx`, `NodeDetail.tsx`, or similar.

**Step 2: Create PodcastTranscriptPrompt.tsx**

Create `src/components/PodcastTranscriptPrompt.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';

interface Props {
  nodeId: number;
  audioUrl?: string;
  durationMinutes?: number;
  onTranscriptStarted?: () => void;
}

export function PodcastTranscriptPrompt({ nodeId, audioUrl, durationMinutes, onTranscriptStarted }: Props) {
  const [loading, setLoading] = useState<'local' | 'api' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<'whisper-small' | 'whisper-medium'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('podcast_whisper_model') as 'whisper-small' | 'whisper-medium') || 'whisper-small';
    }
    return 'whisper-small';
  });

  const hasOpenAIKey = !!process.env.NEXT_PUBLIC_OPENAI_KEY_CONFIGURED;
  const hasAudio = !!audioUrl;
  const estimatedCost = durationMinutes ? `~$${(durationMinutes * 0.006).toFixed(2)}` : null;

  const isSpotifyAudio = audioUrl?.includes('spotify') || audioUrl?.includes('scdn.co');

  function handleModelChange(newModel: 'whisper-small' | 'whisper-medium') {
    setModel(newModel);
    localStorage.setItem('podcast_whisper_model', newModel);
  }

  async function triggerASR(method: 'local' | 'api') {
    setLoading(method);
    setError(null);
    try {
      const res = await fetch(`/api/nodes/${nodeId}/podcast-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, model }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed: ${res.status}`);
      }
      onTranscriptStarted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(null);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-3">
      <p className="text-amber-800 font-medium">No transcript found for this episode.</p>

      {!hasAudio && (
        <p className="text-amber-700 text-xs">
          No audio URL was found — transcription is not available for this episode.
          {isSpotifyAudio && ' Spotify streams are DRM-protected and cannot be downloaded.'}
        </p>
      )}

      {hasAudio && !isSpotifyAudio && (
        <>
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <span>Local model:</span>
            <select
              value={model}
              onChange={e => handleModelChange(e.target.value as 'whisper-small' | 'whisper-medium')}
              className="border border-amber-300 rounded px-1 py-0.5 bg-white text-amber-800"
            >
              <option value="whisper-small">whisper-small (~150 MB)</option>
              <option value="whisper-medium">whisper-medium (~300 MB, better accuracy)</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => triggerASR('local')}
              disabled={loading !== null}
              className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {loading === 'local' ? 'Transcribing…' : 'Transcribe free'}
            </button>

            {hasOpenAIKey && estimatedCost && (
              <button
                onClick={() => triggerASR('api')}
                disabled={loading !== null}
                className="px-3 py-1.5 rounded border border-amber-600 text-amber-700 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
              >
                {loading === 'api' ? 'Sending to API…' : `Use OpenAI API ${estimatedCost}`}
              </button>
            )}
          </div>
        </>
      )}

      {isSpotifyAudio && (
        <p className="text-amber-700 text-xs">
          Spotify audio streams cannot be downloaded for transcription.
        </p>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}
```

**Step 3: Find where to render it**

Search for the component that renders node metadata or the node detail panel:

```bash
grep -r "node\.metadata\|node\.chunk" src/components --include="*.tsx" -l
```

Open the relevant file. Find the section that renders `node.metadata` or the node's content. Add the `PodcastTranscriptPrompt` there, conditional on `node.metadata?.transcript_status === 'asr_pending_user'`.

Example insertion (adapt to the actual component structure):
```tsx
{node.metadata?.transcript_status === 'asr_pending_user' && (
  <PodcastTranscriptPrompt
    nodeId={node.id}
    audioUrl={node.metadata.audio_url}
    durationMinutes={node.metadata.duration_minutes}
    onTranscriptStarted={() => {/* node will update via SSE/polling */}}
  />
)}
```

**Step 4: Add NEXT_PUBLIC_OPENAI_KEY_CONFIGURED env var**

In `.env.local` (create if it doesn't exist), add:
```
NEXT_PUBLIC_OPENAI_KEY_CONFIGURED=true
```

This is set when the app detects an OpenAI API key is configured. Check how the app currently exposes this — if it already has a mechanism for detecting API key presence, reuse it rather than adding a new env var. If not, this env var is the simplest approach.

**Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/components/PodcastTranscriptPrompt.tsx
git commit -m "feat: add PodcastTranscriptPrompt UI component with local/API ASR options and model preference"
```

---

## Task 9: Manual smoke test and final integration check

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Test Apple Podcasts URL**

Open Quick-Add, paste an Apple Podcasts episode URL (e.g., `https://podcasts.apple.com/us/podcast/some-show/id123456789?i=1000696785236`).

Expected:
- Node is created immediately
- Node title = episode title from iTunes API
- Metadata shows `source: 'podcast_episode'`, `resolution_source: 'apple'`
- Background transcript discovery runs silently
- If no transcript found, node shows the ASR prompt

**Step 3: Test RSS feed URL**

Paste a known RSS feed (e.g., `https://feeds.simplecast.com/54nAGcIl`).

Expected:
- Node created with podcast name and latest episode
- If RSS had `podcast:transcript`, transcript appears

**Step 4: Test Spotify URL**

Paste a Spotify episode URL.

Expected:
- Node created with title + podcast name from oEmbed
- `resolution_source: 'spotify_oembed'`
- ASR prompt appears; "Transcribe free" is disabled with Spotify CDN message

**Step 5: Test local ASR (if OpenAI key not configured)**

On a node with `transcript_status: 'asr_pending_user'` and a valid `audio_url`, click "Transcribe free".

Expected:
- `transcript_status` changes to `'asr_processing'` (spinner/status change in UI)
- After processing: transcript populates `node.chunk`
- `transcript_status: 'available'`
- Chunking/embedding kicks off

**Step 6: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

**Step 7: Final type-check**

```bash
npm run type-check
```

Expected: no errors.

**Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete podcast extraction with transcript discovery and ASR support"
```

---

## Summary of new files

| File | Purpose |
|---|---|
| `src/services/typescript/extractors/podcast.ts` | Sync URL resolver + episode metadata extractor |
| `src/services/typescript/extractors/podcast-transcript.ts` | Async transcript discovery (publisher page, RSS, Podcast Index) |
| `src/services/typescript/extractors/podcast-asr.ts` | ASR (local Whisper + OpenAI Whisper API) |
| `src/tools/other/podcastExtract.ts` | Tool wrapper for agent/MCP use |
| `app/api/nodes/[id]/podcast-transcript/route.ts` | API route for user-triggered ASR |
| `src/components/PodcastTranscriptPrompt.tsx` | UI prompt for ASR consent |
| `src/services/typescript/extractors/__tests__/podcast-detection.test.ts` | URL detection tests |
| `src/services/typescript/extractors/__tests__/podcast-resolver.test.ts` | RSS parser tests |

## Summary of modified files

| File | Change |
|---|---|
| `src/services/agents/quickAdd.ts` | Add `'podcast'` type + URL patterns + EXTRACTION_TOOL_MAP entry |
| `package.json` | Add `@huggingface/transformers` |
