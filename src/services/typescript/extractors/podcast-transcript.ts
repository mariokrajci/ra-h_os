/**
 * Async podcast transcript discovery pipeline
 * Tries sources in order:
 *   1. RSS podcast:transcript tag (Podcasting 2.0 standard — highest fidelity)
 *   2. Podscripts transcript mirror (pragmatic fallback for podcast apps)
 *   3. Publisher episode page (HTML scrape)
 *   4. Podcast Index API (optional — requires PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET)
 *
 * On success:  updates node.chunk + chunk_status + metadata.transcript_*
 * On failure:  sets metadata.transcript_status = 'unavailable'
 */
import * as cheerio from 'cheerio';
import { nodeService } from '@/services/database';
import { autoEmbedQueue } from '@/services/embedding/autoEmbedQueue';
import { parseRssFeed, buildPodcastIndexHeaders } from './podcast';

type TranscriptResult = {
  text: string;
  source: 'publisher_page' | 'rss_tag' | 'podscripts' | 'podcast_index';
  url?: string;
  confidence: 'high' | 'medium' | 'low';
};

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function buildPodscriptsTranscriptUrl(showTitle: string, episodeTitle: string): string {
  return `https://podscripts.co/podcasts/${slugifySegment(showTitle)}/${slugifySegment(episodeTitle)}`;
}

function normalizeTimestamp(label: string): string {
  const match = label.match(/(\d{2}:\d{2}:\d{2}|\d{1,2}:\d{2})/);
  return match?.[1] || label.trim();
}

export function extractPodscriptsTranscriptText(html: string): string {
  const $ = cheerio.load(html);
  const groups = $('.podcast-transcript .single-sentence');
  if (!groups.length) return '';

  const segments: string[] = [];

  groups.each((_, el) => {
    const group = $(el);
    const timestamp = normalizeTimestamp(group.find('.pod_timestamp_indicator').first().text().trim());
    const parts = group
      .find('.transcript-text, .pod_text')
      .map((__, span) => $(span).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);

    if (!timestamp || parts.length === 0) return;
    segments.push(`${timestamp}\n${parts.join(' ')}`);
  });

  return segments.join('\n\n').trim();
}

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

async function fetchPodscriptsTranscript(
  podcastName: string,
  episodeTitle: string,
): Promise<TranscriptResult | null> {
  const transcriptUrl = buildPodscriptsTranscriptUrl(podcastName, episodeTitle);

  try {
    const res = await fetch(transcriptUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const text = extractPodscriptsTranscriptText(html);
    if (text.length < 500) return null;

    return {
      text,
      source: 'podscripts',
      url: transcriptUrl,
      confidence: 'medium',
    };
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
  const { notes_status: _notesStatus, ...metadataWithoutNotesStatus } = existingMetadata || {};

  // updateNode replaces metadata entirely, so spread existing fields to preserve them
  await nodeService.updateNode(nodeId, {
    chunk: transcript.text,
    chunk_status: 'not_chunked',
    metadata: {
      ...metadataWithoutNotesStatus,
      source_status: 'available',
      transcript_status: 'available',
      transcript_source: transcript.source,
      transcript_url: transcript.url,
      transcript_confidence: transcript.confidence,
    },
  });
  // NOTE: nodeService.updateNode already broadcasts NODE_UPDATED internally
  autoEmbedQueue.enqueue(nodeId, { reason: 'podcast_transcript_ready' });
}

async function updateNodeTranscriptStatus(
  nodeId: number,
  status: 'unavailable',
  existingMetadata: any
): Promise<void> {
  // updateNode replaces metadata entirely, so spread existing fields to preserve them
  await nodeService.updateNode(nodeId, {
    metadata: {
      ...existingMetadata,
      source_status: 'failed',
      notes_status: 'failed',
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

  // Step 2: Podscripts transcript mirror
  if (!result && meta.podcast_name && meta.episode_title) {
    result = await fetchPodscriptsTranscript(meta.podcast_name, meta.episode_title);
  }

  // Step 3: Publisher episode page scrape
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

  // Step 4: Podcast Index API (optional — only runs when API key is configured)
  if (!result && meta.rss_feed_url && meta.episode_title) {
    result = await fetchPodcastIndexTranscript(meta.rss_feed_url, meta.episode_title);
  }

  if (result && result.text.length > 200) {
    await updateNodeWithTranscript(nodeId, result, meta);
  } else {
    await updateNodeTranscriptStatus(nodeId, 'unavailable', meta);
  }
}
