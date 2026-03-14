import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPodscriptsTranscriptUrl,
  discoverTranscript,
  extractPodscriptsTranscriptText,
} from '@/services/typescript/extractors/podcast-transcript';

const {
  getNodeByIdMock,
  updateNodeMock,
  enqueueMock,
} = vi.hoisted(() => ({
  getNodeByIdMock: vi.fn(),
  updateNodeMock: vi.fn(),
  enqueueMock: vi.fn(),
}));

vi.mock('@/services/database', () => ({
  nodeService: {
    getNodeById: getNodeByIdMock,
    updateNode: updateNodeMock,
  },
}));

vi.mock('@/services/embedding/autoEmbedQueue', () => ({
  autoEmbedQueue: {
    enqueue: enqueueMock,
  },
}));

describe('podcast transcript helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a Podscripts transcript URL from show and episode titles', () => {
    expect(
      buildPodscriptsTranscriptUrl(
        'No Stupid Questions',
        '40. Have We All Lost Our Ability to Compromise?',
      ),
    ).toBe(
      'https://podscripts.co/podcasts/no-stupid-questions/40-have-we-all-lost-our-ability-to-compromise',
    );
  });

  it('extracts transcript body from a Podscripts page', () => {
    const html = `
      <html>
        <body>
          <div id="episodesingle">
            <div class="podcast-transcript">
              <div data-group-id="0" class="single-sentence">
                <span class="pod_timestamp_indicator">Starting point is 00:00:00</span>
                <span class="pod_text transcript-text">Look at me! I'm a paragon of integrity.</span>
                <span class="pod_text transcript-text">I'm Angela Duckworth.</span>
                <span class="pod_text transcript-text">I'm Stephen Dubner.</span>
              </div>
              <div data-group-id="1" class="single-sentence">
                <span class="pod_timestamp_indicator">Starting point is 00:00:23</span>
                <span class="pod_text transcript-text">And you're listening to No Stupid Questions.</span>
              </div>
            </div>
          </div>
          <footer>
            <div>PodScripts.co - Podcast transcripts and discussion</div>
            <script>console.log('junk')</script>
          </footer>
        </body>
      </html>
    `;

    const text = extractPodscriptsTranscriptText(html);

    expect(text).toContain("00:00:00\nLook at me! I'm a paragon of integrity. I'm Angela Duckworth. I'm Stephen Dubner.");
    expect(text).toContain("00:00:23\nAnd you're listening to No Stupid Questions.");
    expect(text).not.toContain('00:00:00 - ');
    expect(text).not.toContain('PodScripts.co - Podcast transcripts and discussion');
    expect(text).not.toContain('Starting point is');
  });

  it('stores transcript source without auto-generating notes', async () => {
    getNodeByIdMock.mockResolvedValue({
      id: 42,
      metadata: {
        source: 'podcast_episode',
        source_status: 'pending',
        notes_status: 'pending',
        transcript_status: 'queued',
        rss_feed_url: 'https://example.com/feed.xml',
        episode_title: 'Episode 42',
      },
    });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `<?xml version="1.0"?>
<rss xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <item>
      <title>Episode 42</title>
      <podcast:transcript url="https://example.com/transcript.txt" type="text/plain"/>
    </item>
  </channel>
</rss>`,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: async () => 'Transcript text '.repeat(30),
      }));

    await discoverTranscript(42);

    expect(updateNodeMock).toHaveBeenNthCalledWith(1, 42, {
      metadata: expect.objectContaining({
        transcript_status: 'processing',
      }),
    });
    expect(updateNodeMock).toHaveBeenNthCalledWith(
      2,
      42,
      expect.objectContaining({
        chunk: expect.stringContaining('Transcript text'),
        chunk_status: 'not_chunked',
        metadata: expect.objectContaining({
          source_status: 'available',
          transcript_status: 'available',
          transcript_source: 'rss_tag',
          transcript_url: 'https://example.com/transcript.txt',
        }),
      }),
    );
    expect(updateNodeMock.mock.calls[1]?.[1]?.metadata).not.toHaveProperty('notes_status');
    expect(enqueueMock).toHaveBeenCalledWith(42, { reason: 'podcast_transcript_ready' });

    vi.unstubAllGlobals();
  });
});
