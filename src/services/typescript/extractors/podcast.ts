/**
 * Podcast episode extraction for RA-H knowledge management system
 * Resolves podcast app URLs (Spotify, Apple, Pocket Casts, RSS) to episode metadata.
 * Transcript discovery runs asynchronously via podcast-transcript.ts.
 */
import * as cheerio from 'cheerio';
import { createHmac } from 'crypto';

export type PodcastSource = 'spotify' | 'apple' | 'pocket_casts' | 'rss_direct' | 'website_fallback';

export interface PodcastEpisodeResult {
  podcast_name: string;
  episode_title: string;
  episode_url: string;
  /** Publisher's own episode page, distinct from the streaming service URL that was submitted */
  publisher_url?: string;
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
    source_status: 'pending' | 'available' | 'failed';
    notes_status: 'pending' | 'available' | 'failed';
    transcript_status: 'queued' | 'processing' | 'available' | 'unavailable';
    transcript_source?: string;
    transcript_confidence?: 'high' | 'medium' | 'low';
  };
  // `error` is reserved for callers that wrap this function and may inject a
  // failure result. `extractPodcast` itself always returns `success: true`
  // because the website_fallback resolver guarantees a non-null result.
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

    // Try escaped namespace selector first, then fall back to attribute-based search
    let durationRaw = $item.find('itunes\\:duration').first().text().trim();
    if (!durationRaw) {
      // Fallback: search by tag name substring match via each
      $item.find('*').each((__, el) => {
        const tagName = (el as any).name || '';
        if (tagName === 'itunes:duration') {
          const text = $(el).text().trim();
          if (text) durationRaw = text;
        }
      });
    }

    // Try escaped namespace selector for transcript, then fall back
    let transcriptEl = $item.find('podcast\\:transcript');
    if (!transcriptEl.length) {
      $item.find('*').each((__, el) => {
        const tagName = (el as any).name || '';
        if (tagName === 'podcast:transcript' || tagName === 'itunes:transcript') {
          transcriptEl = $(el);
        }
      });
    }

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

    let descriptionRaw = $item.find('description').first().text().trim();
    if (!descriptionRaw) {
      $item.find('*').each((__, el) => {
        const tagName = (el as any).name || '';
        if (tagName === 'itunes:summary' || tagName.endsWith(':summary')) {
          const text = $(el).text().trim();
          if (text) descriptionRaw = text;
        }
      });
    }

    episodes.push({
      episode_title: $item.find('title').first().text().trim(),
      episode_url: $item.find('link').first().text().trim() || $item.find('guid').text().trim(),
      audio_url: audioUrl || undefined,
      published_at: $item.find('pubDate').text().trim() || undefined,
      duration_minutes,
      description: descriptionRaw || undefined,
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

/**
 * Build Podcast Index API authentication headers.
 * Requires PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET env vars.
 * Returns null when credentials are not configured (Podcast Index is optional).
 * Auth spec: https://podcastindex-org.github.io/docs-api/#auth
 */
export function buildPodcastIndexHeaders(): Record<string, string> | null {
  const apiKey = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  const authDate = String(Math.floor(Date.now() / 1000));
  const hash = createHmac('sha1', apiSecret)
    .update(apiKey + apiSecret + authDate)
    .digest('hex');
  return {
    'User-Agent': 'RAH-knowledgebase/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': authDate,
    'Authorization': hash,
  };
}

async function resolveApplePodcastsUrl(url: string): Promise<Partial<PodcastEpisodeResult> | null> {
  try {
    const episodeIdMatch = url.match(/[?&]i=(\d+)/);
    const showIdMatch = url.match(/\/id(\d+)/);
    if (!showIdMatch) return null;

    const showId = showIdMatch[1];
    // When an episode ID is present we pass it as the `id` param with
    // `entity=podcastEpisode`. The iTunes API returns the parent show as
    // results[0] and the matching episode in subsequent results, so we use
    // `.find(r => r.kind === 'podcast-episode')` below to locate the episode.
    // Without an episode ID we fall back to the show ID and fetch one episode.
    const lookupUrl = episodeIdMatch
      ? `https://itunes.apple.com/lookup?id=${episodeIdMatch[1]}&entity=podcastEpisode`
      : `https://itunes.apple.com/lookup?id=${showId}&entity=podcastEpisode&limit=1`;

    const res = await fetch(lookupUrl);
    if (!res.ok) return null;
    const data = await res.json();

    const results: any[] = data.results || [];
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

/**
 * Search iTunes for a podcast by show name and return its RSS feed URL.
 * Free, no API key required.
 */
async function searchItunesPodcast(showName: string): Promise<{ feedUrl: string } | null> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(showName)}&entity=podcast&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const podcast = (data.results as any[])?.[0];
    return podcast?.feedUrl ? { feedUrl: podcast.feedUrl as string } : null;
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

    // oEmbed gives the episode title reliably, but provider_name is always "Spotify".
    // Fetch the episode page HTML to parse the real show name from <title>:
    // "{episode_title} - {show_name} | Podcast on Spotify"
    const episodeTitle: string = data.title || 'Unknown Episode';
    let showName = 'Unknown Podcast';
    try {
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' },
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          const fullTitle = titleMatch[1].replace(' | Podcast on Spotify', '').trim();
          // Format: "{episode_title} - {show_name}" — split on the last " - "
          const lastDash = fullTitle.lastIndexOf(' - ');
          if (lastDash >= 0) showName = fullTitle.slice(lastDash + 3).trim();
        }
      }
    } catch { /* proceed with Unknown Podcast */ }

    // Resolve RSS feed URL via iTunes show search (deterministic by show name).
    // Podcast Index is the fallback for indie podcasts not in iTunes.
    // Episode search is intentionally avoided — it's non-deterministic across requests.
    let rss_feed_url: string | undefined;
    const itunesShow = await searchItunesPodcast(showName);
    if (itunesShow?.feedUrl) {
      rss_feed_url = itunesShow.feedUrl;
    } else {
      const piHeaders = buildPodcastIndexHeaders();
      if (piHeaders) {
        try {
          const piUrl = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(showName)}&max=1`;
          const piRes = await fetch(piUrl, { headers: piHeaders });
          if (piRes.ok) {
            const piData = await piRes.json();
            const feed = (piData.feeds as any[])?.[0];
            if (feed?.url) rss_feed_url = feed.url as string;
          }
        } catch { /* no feed found */ }
      }
    }

    // Parse the RSS feed to find this specific episode by title.
    // RSS enclosure gives the audio URL; RSS <link> may give the publisher page.
    let audio_url: string | undefined;
    let publisher_url: string | undefined;
    let duration_minutes: number | undefined;
    let published_at: string | undefined;
    let description: string | undefined;
    let transcript_url: string | undefined;

    if (rss_feed_url) {
      try {
        const rssRes = await fetch(rss_feed_url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RAH-bot/1.0)' },
        });
        if (rssRes.ok) {
          const xml = await rssRes.text();
          const feed = parseRssFeed(xml);
          const epLower = episodeTitle.toLowerCase();
          const rssEp = feed.episodes.find(ep => {
            const t = ep.episode_title.toLowerCase();
            return t.includes(epLower.substring(0, 40)) || epLower.includes(t.substring(0, 40));
          });
          if (rssEp) {
            audio_url = rssEp.audio_url;
            duration_minutes = rssEp.duration_minutes;
            published_at = rssEp.published_at;
            description = rssEp.description;
            transcript_url = rssEp.transcript_url;
            // Only store RSS <link> as publisher_url if it's an episode-specific page
            // (not the show homepage). Heuristic: path must be longer than "/".
            if (rssEp.episode_url) {
              try {
                const parsed = new URL(rssEp.episode_url);
                if (parsed.pathname.length > 1 && !/spotify\.com/i.test(rssEp.episode_url)) {
                  publisher_url = rssEp.episode_url;
                }
              } catch { /* invalid URL */ }
            }
          }
        }
      } catch { /* rss_feed_url still set, episode fields remain undefined */ }
    }

    return {
      episode_title: episodeTitle,
      podcast_name: showName,
      episode_url: url,
      publisher_url,
      rss_feed_url,
      audio_url,
      duration_minutes,
      published_at,
      description,
      transcript_url,
      cover_image_url: data.thumbnail_url,
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

  if (!resolved) {
    resolved = await resolveWebsiteFallback(url);
  }

  const metadata: ExtractionResult['metadata'] = {
    source: 'podcast_episode',
    podcast_name: resolved.podcast_name || 'Unknown Podcast',
    episode_title: resolved.episode_title || 'Unknown Episode',
    episode_url: resolved.episode_url || url,
    publisher_url: resolved.publisher_url,
    rss_feed_url: resolved.rss_feed_url,
    audio_url: resolved.audio_url,
    published_at: resolved.published_at,
    duration_minutes: resolved.duration_minutes,
    cover_image_url: resolved.cover_image_url,
    description: resolved.description,
    resolution_source: resolved.resolution_source || 'website_fallback',
    source_status: 'pending',
    notes_status: 'pending',
    transcript_status: 'queued',
    transcript_source: undefined,
    transcript_url: resolved.transcript_url,
    transcript_confidence: undefined,
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
    chunk: '',
    metadata,
  };
}
