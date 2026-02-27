import { describe, it, expect, vi } from 'vitest';

vi.mock('@/tools/other/youtubeExtract', () => ({ youtubeExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/websiteExtract', () => ({ websiteExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/paperExtract', () => ({ paperExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/other/podcastExtract', () => ({ podcastExtractTool: { execute: vi.fn() } }));
vi.mock('@/tools/infrastructure/nodeFormatter', () => ({ formatNodeForChat: vi.fn() }));
vi.mock('@/services/agents/transcriptSummarizer', () => ({ summarizeTranscript: vi.fn() }));
vi.mock('@/services/events', () => ({ eventBroadcaster: { broadcast: vi.fn() } }));

import { detectInputType } from '@/services/agents/quickAdd';

describe('detectInputType — podcast', () => {
  it('detects Spotify episode URL', () => {
    expect(detectInputType('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk')).toBe('podcast');
  });

  it('detects Spotify episode URL without protocol', () => {
    expect(detectInputType('open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk')).toBe('podcast');
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

  it('detects a regular website without protocol', () => {
    expect(detectInputType('example.com/blog/post')).toBe('website');
  });

  it('still detects YouTube before podcast check', () => {
    expect(detectInputType('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
  });
});
