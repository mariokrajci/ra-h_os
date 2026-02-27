/**
 * Async podcast transcript discovery pipeline
 * Tries three sources in order:
 *   1. Publisher episode page (HTML scrape)
 *   2. RSS podcast:transcript tag
 *   3. Podcast Index API
 *
 * On success:  updates node.chunk + chunk_status + metadata.transcript_*
 * On failure:  sets metadata.transcript_status = 'asr_pending_user'
 */
import * as cheerio from 'cheerio';
import { nodeService } from '@/services/database';
import { parseRssFeed } from './podcast';

type TranscriptResult = {
  text: string;
  source: 'publisher_page' | 'rss_tag' | 'podcast_index' | 'podscripts';
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

/**
 * Search Podscripts (podscripts.co) by episode title + show name and return the transcript text.
 * Podscripts indexes publisher-hosted transcripts, so this serves as a structural mirror if the
 * publisher page layout changes or is otherwise unscrapeable.
 */
async function scrapePodscrips(episodeTitle: string, showName: string): Promise<TranscriptResult | null> {
  try {
    const q = encodeURIComponent(`${showName} ${episodeTitle}`.substring(0, 120));
    const searchRes = await fetch(`https://www.podscripts.co/search?q=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' },
    });
    if (!searchRes.ok) return null;
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);

    // Find first episode result link
    const link = $('a[href*="/episode"], a[href*="/podcast"]').first().attr('href');
    if (!link) return null;
    const episodeUrl = link.startsWith('http') ? link : `https://www.podscripts.co${link}`;

    const epRes = await fetch(episodeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' },
    });
    if (!epRes.ok) return null;
    const epHtml = await epRes.text();
    const $ep = cheerio.load(epHtml);

    const text = $ep('[class*="transcript"], article, main').first().text().trim();
    if (text.length > 500) {
      return { text, source: 'podscripts', url: episodeUrl, confidence: 'medium' };
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

  // Step 1: Publisher episode page.
  // Prefer publisher_url (the show's own website) over episode_url which may be
  // a streaming service URL (Spotify, Apple, Pocket Casts) that won't have a transcript.
  const publisherUrl: string | null =
    meta.publisher_url ||
    (meta.episode_url && !isStreamingServiceUrl(meta.episode_url) ? meta.episode_url : null);
  if (publisherUrl) {
    result = await scrapePublisherPage(publisherUrl);
  }

  // Step 2: RSS podcast:transcript tag
  if (!result && meta.rss_feed_url) {
    result = await fetchRssTranscript(meta.rss_feed_url, meta.episode_url);
  }

  // Step 3: Podcast Index API
  if (!result && meta.rss_feed_url) {
    result = await fetchPodcastIndexTranscript(meta.rss_feed_url, meta.episode_url);
  }

  // Step 4: Podscripts transcript mirror (searches by show + episode title)
  if (!result && meta.episode_title && meta.podcast_name) {
    result = await scrapePodscrips(meta.episode_title, meta.podcast_name);
  }

  if (result && result.text.length > 200) {
    await updateNodeWithTranscript(nodeId, result, meta);
  } else {
    await updateNodeTranscriptStatus(nodeId, 'asr_pending_user', meta);
  }
}
