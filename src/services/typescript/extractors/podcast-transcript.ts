/**
 * Async podcast transcript discovery pipeline
 * Tries sources in order:
 *   1. RSS podcast:transcript tag (Podcasting 2.0 standard — highest fidelity)
 *   2. Publisher episode page (HTML scrape)
 *   3. Podcast Index API (optional — requires PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET)
 *
 * On success:  updates node.chunk + chunk_status + metadata.transcript_*
 * On failure:  sets metadata.transcript_status = 'asr_pending_user'
 */
import * as cheerio from 'cheerio';
import { nodeService } from '@/services/database';
import { parseRssFeed, buildPodcastIndexHeaders } from './podcast';

type TranscriptResult = {
  text: string;
  source: 'publisher_page' | 'rss_tag' | 'podcast_index';
  url?: string;
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Strip VTT/SRT timing metadata and sequence numbers to return plain prose text.
 * For JSON transcripts (Podcast Index format), concatenates segment bodies.
 */
function parseTimedTranscript(raw: string, type: string): string {
  const t = type.toLowerCase();
  if (t.includes('vtt') || t.includes('webvtt')) {
    return raw
      .replace(/^WEBVTT.*$/m, '')
      .replace(/^\d{2}:\d{2}:\d{2}\.\d+ --> .+$/gm, '')
      .replace(/^\d+\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (t.includes('srt')) {
    return raw
      .replace(/^\d+\s*$/gm, '')
      .replace(/^\d{2}:\d{2}:\d{2},\d+ --> .+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (t.includes('json')) {
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj.segments)) {
        return obj.segments.map((s: any) => s.body || s.text || '').join(' ').trim();
      }
      if (typeof obj.transcript === 'string') return obj.transcript.trim();
    } catch { /* fall through to raw */ }
  }
  return raw.trim();
}

async function scrapePublisherPage(episodeUrl: string): Promise<TranscriptResult | null> {
  try {
    const res = await fetch(episodeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Priority 1: dedicated transcript container by class/id/aria
    for (const sel of ['[class*="transcript"]', '[id*="transcript"]', '[aria-label*="transcript" i]']) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().trim();
        if (text.length > 500) {
          return { text, source: 'publisher_page', url: episodeUrl, confidence: 'high' };
        }
      }
    }

    // Priority 2: content that follows a "Transcript" heading (e.g. Freakonomics "## Episode Transcript")
    let afterHeading: string | null = null;
    $('h1, h2, h3, h4').each((_, el) => {
      if (afterHeading) return;
      if ($(el).text().toLowerCase().includes('transcript')) {
        const parts: string[] = [];
        $(el).nextAll().each((__, sib) => { parts.push($(sib).text()); });
        const text = parts.join('\n').trim();
        if (text.length > 500) afterHeading = text;
      }
    });
    if (afterHeading) {
      return { text: afterHeading, source: 'publisher_page', url: episodeUrl, confidence: 'high' };
    }

    // Priority 3: generic article / show-notes fallback
    for (const sel of ['article', '.show-notes', '#show-notes']) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().trim();
        if (text.length > 500) {
          return { text, source: 'publisher_page', url: episodeUrl, confidence: 'low' };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** True for URLs belonging to podcast streaming apps (not the publisher's own website). */
function isStreamingServiceUrl(url: string): boolean {
  return /open\.spotify\.com|podcasts\.apple\.com|pca\.st|play\.pocketcasts\.com/i.test(url);
}

async function fetchRssTranscript(
  rssFeedUrl: string,
  episodeTitle: string,
): Promise<TranscriptResult | null> {
  try {
    const res = await fetch(rssFeedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' }
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const feed = parseRssFeed(xml);

    // Match by title — episode_url in metadata may be a streaming service URL
    // that won't match the publisher link stored in RSS <link>.
    const titleLower = episodeTitle.toLowerCase();
    const episode = feed.episodes.find(ep => {
      const t = ep.episode_title.toLowerCase();
      return t.includes(titleLower.substring(0, 40)) || titleLower.includes(t.substring(0, 40));
    });
    if (!episode?.transcript_url) return null;

    const transcriptRes = await fetch(episode.transcript_url);
    if (!transcriptRes.ok) return null;
    const contentType = transcriptRes.headers.get('content-type') || '';
    const raw = await transcriptRes.text();

    let text: string;
    if (contentType.includes('html')) {
      const $ = cheerio.load(raw);
      text = $.text().trim();
    } else {
      // transcript_type from RSS (vtt, srt, application/json, text/plain, etc.)
      text = parseTimedTranscript(raw, episode.transcript_type || contentType);
    }

    return {
      text,
      source: 'rss_tag',
      url: episode.transcript_url,
      confidence: 'high',
    };
  } catch {
    return null;
  }
}

async function fetchPodcastIndexTranscript(
  rssFeedUrl: string,
  episodeTitle: string,
): Promise<TranscriptResult | null> {
  const headers = buildPodcastIndexHeaders();
  if (!headers) return null; // API key not configured — skip silently

  try {
    const apiUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedurl?url=${encodeURIComponent(rssFeedUrl)}&max=20`;
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = data.items || [];

    // Match by title
    const titleLower = episodeTitle.toLowerCase();
    const episode = items.find((item: any) => {
      const t: string = (item.title || '').toLowerCase();
      return t.includes(titleLower.substring(0, 40)) || titleLower.includes(t.substring(0, 40));
    });
    if (!episode?.transcripts?.length) return null;

    const transcript = episode.transcripts[0];
    const transcriptRes = await fetch(transcript.url);
    if (!transcriptRes.ok) return null;
    const contentType = transcriptRes.headers.get('content-type') || '';
    const raw = await transcriptRes.text();

    const text = contentType.includes('html')
      ? cheerio.load(raw).text().trim()
      : parseTimedTranscript(raw, transcript.type || contentType);

    return {
      text,
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
  transcript: TranscriptResult,
  existingMetadata: any
): Promise<void> {
  // updateNode replaces metadata entirely, so spread existing fields to preserve them
  await nodeService.updateNode(nodeId, {
    chunk: transcript.text,
    chunk_status: 'not_chunked',
    metadata: {
      ...existingMetadata,
      transcript_status: 'available',
      transcript_source: transcript.source,
      transcript_url: transcript.url,
      transcript_confidence: transcript.confidence,
    },
  });
  // NOTE: nodeService.updateNode already broadcasts NODE_UPDATED internally
}

async function updateNodeTranscriptStatus(
  nodeId: number,
  status: 'asr_pending_user' | 'unavailable',
  existingMetadata: any
): Promise<void> {
  // updateNode replaces metadata entirely, so spread existing fields to preserve them
  await nodeService.updateNode(nodeId, {
    metadata: {
      ...existingMetadata,
      transcript_status: status,
    },
  });
  // NOTE: nodeService.updateNode already broadcasts NODE_UPDATED internally
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

  // Step 1: RSS podcast:transcript tag (Podcasting 2.0 standard — highest fidelity, no scraping needed)
  if (meta.rss_feed_url && meta.episode_title) {
    result = await fetchRssTranscript(meta.rss_feed_url, meta.episode_title);
  }

  // Step 2: Publisher episode page scrape
  // Prefer publisher_url (the show's own website) over episode_url which may be
  // a streaming service URL (Spotify, Apple, Pocket Casts) that won't have a transcript.
  if (!result) {
    const publisherUrl: string | null =
      meta.publisher_url ||
      (meta.episode_url && !isStreamingServiceUrl(meta.episode_url) ? meta.episode_url : null);
    if (publisherUrl) {
      result = await scrapePublisherPage(publisherUrl);
    }
  }

  // Step 3: Podcast Index API (optional — only runs when API key is configured)
  if (!result && meta.rss_feed_url && meta.episode_title) {
    result = await fetchPodcastIndexTranscript(meta.rss_feed_url, meta.episode_title);
  }

  if (result && result.text.length > 200) {
    await updateNodeWithTranscript(nodeId, result, meta);
  } else {
    await updateNodeTranscriptStatus(nodeId, 'asr_pending_user', meta);
  }
}
