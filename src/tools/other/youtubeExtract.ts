import { tool } from 'ai';
import { z } from 'zod';
import { formatNodeForChat } from '../infrastructure/nodeFormatter';
import { finalizeYouTubeNode } from '@/services/ingestion/finalizeSourceNode';

function extractVideoId(url: string): string | null {
  if (url.includes('youtu.be')) {
    return url.split('/').pop()?.split('?')[0] || null;
  }
  if (url.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    return urlParams.get('v');
  }
  if (url.includes('youtube.com/live')) {
    return url.split('/live/')[1]?.split('?')[0] || null;
  }
  return null;
}

async function fetchYouTubeBasicMetadata(url: string): Promise<{ title: string; channelName?: string; channelUrl?: string; thumbnailUrl?: string; videoId?: string }> {
  const videoId = extractVideoId(url) || undefined;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || `YouTube Video ${videoId || ''}`.trim(),
        channelName: data.author_name || undefined,
        channelUrl: data.author_url || undefined,
        thumbnailUrl: data.thumbnail_url || undefined,
        videoId,
      };
    }
  } catch {
    // ignore and fall back
  }

  return {
    title: `YouTube Video ${videoId || ''}`.trim(),
    videoId,
  };
}

function buildYouTubeDescription(title: string, channelName?: string): string {
  if (channelName) {
    return `YouTube video by ${channelName}: ${title.slice(0, 220)}`;
  }
  return `YouTube video: ${title.slice(0, 220)}`;
}

export const youtubeExtractTool = tool({
  description: 'Create a YouTube node immediately, then fetch transcript and notes in the background',
  inputSchema: z.object({
    url: z.string().describe('The YouTube video URL to add to knowledge base'),
    title: z.string().optional().describe('Custom title (auto-generated if not provided)'),
    dimensions: z.array(z.string()).min(1).max(5).optional().describe('Dimension tags to apply to the created node (locked dimensions first)')
  }),
  execute: async ({ url, title, dimensions }) => {
    try {
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return {
          success: false,
          error: 'Invalid YouTube URL format',
          data: null
        };
      }

      const basic = await fetchYouTubeBasicMetadata(url);
      const nodeTitle = title || basic.title || 'YouTube Video';
      const trimmedDimensions = (Array.isArray(dimensions) ? dimensions : [])
        .map(dim => (typeof dim === 'string' ? dim.trim() : ''))
        .filter(Boolean)
        .slice(0, 5);

      const createResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nodeTitle,
          description: buildYouTubeDescription(nodeTitle, basic.channelName),
          link: url,
          dimensions: trimmedDimensions,
          metadata: {
            source: 'youtube',
            source_status: 'processing',
            notes_status: 'pending',
            video_id: basic.videoId,
            channel_name: basic.channelName,
            channel_url: basic.channelUrl,
            thumbnail_url: basic.thumbnailUrl,
            staged_ingestion: true,
            staged_ingestion_started_at: new Date().toISOString(),
          }
        })
      });

      const createResult = await createResponse.json();
      if (!createResponse.ok) {
        return {
          success: false,
          error: createResult.error || 'Failed to create node',
          data: null
        };
      }

      const nodeId: number | undefined = createResult.data?.id;
      if (!nodeId) {
        return {
          success: false,
          error: 'Failed to create node',
          data: null
        };
      }

      setImmediate(() => {
        finalizeYouTubeNode({ nodeId, title: nodeTitle, url }).catch(err =>
          console.error(`[youtube] background finalization failed for node ${nodeId}:`, err)
        );
      });

      const actualDimensions: string[] = createResult.data?.dimensions || trimmedDimensions;
      const formattedNode = formatNodeForChat({ id: nodeId, title: nodeTitle, dimensions: actualDimensions });
      const dimsDisplay = actualDimensions.length > 0 ? actualDimensions.join(', ') : 'none';

      return {
        success: true,
        message: `Added ${formattedNode} with dimensions: ${dimsDisplay}. Transcript extraction running in background.`,
        data: {
          nodeId,
          title: nodeTitle,
          url,
          dimensions: actualDimensions,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create YouTube node',
        data: null
      };
    }
  }
});
