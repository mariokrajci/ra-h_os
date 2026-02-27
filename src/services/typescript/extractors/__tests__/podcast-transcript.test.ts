import { describe, expect, it } from 'vitest';
import {
  buildPodscriptsTranscriptUrl,
  extractPodscriptsTranscriptText,
} from '@/services/typescript/extractors/podcast-transcript';

describe('podcast transcript helpers', () => {
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
});
