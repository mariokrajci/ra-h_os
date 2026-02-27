import { describe, it, expect } from 'vitest';
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
