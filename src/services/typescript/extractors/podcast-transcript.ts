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
    await updateNodeWithTranscript(nodeId, result, meta);
  } else {
    await updateNodeTranscriptStatus(nodeId, 'asr_pending_user', meta);
  }
}
