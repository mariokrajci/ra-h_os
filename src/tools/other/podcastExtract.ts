import { tool } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { extractPodcast } from '@/services/typescript/extractors/podcast';
import { discoverTranscript } from '@/services/typescript/extractors/podcast-transcript';
import { formatNodeForChat } from '../infrastructure/nodeFormatter';
import { getOpenAIChatModel } from '@/config/openaiModels';
import { logAiUsage, normalizeUsageFromAiSdk } from '@/services/analytics/usageLogger';

async function analyzePodcastWithAI(episodeTitle: string, podcastName: string, description: string) {
  try {
    const prompt = `Analyze this podcast episode for a knowledge graph entry.

Podcast: "${podcastName}"
Episode: "${episodeTitle}"
Description: "${description}"

CRITICAL — nodeDescription rules (max 280 chars):
1. Say WHAT this literally is: "Podcast episode where…", "Interview with…"
2. Name the podcast and guest/host by role.
3. State the actual topic or thesis — don't be vague.
4. End with why it's interesting — one concrete phrase.
5. FORBIDDEN: "discusses", "explores", "examines", "delves into".

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "nodeDescription": "<280-char description>",
  "tags": ["relevant", "semantic", "tags"],
  "reasoning": "Brief explanation"
}`;

    const response = await generateText({
      model: openai(getOpenAIChatModel()),
      prompt,
      maxOutputTokens: 400,
    });

    const usage = normalizeUsageFromAiSdk(response);
    if (usage) {
      logAiUsage({
        feature: 'podcast_content_analysis',
        provider: 'openai',
        modelId: getOpenAIChatModel(),
        usage,
      });
    }

    let content = response.text || '{}';
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(content);

    return {
      nodeDescription: typeof result.nodeDescription === 'string'
        ? result.nodeDescription.slice(0, 280)
        : undefined,
      tags: Array.isArray(result.tags) ? result.tags : [],
    };
  } catch {
    return { nodeDescription: undefined, tags: [] };
  }
}

export const podcastExtractTool = tool({
  description: 'Extract podcast episode metadata, create a knowledge node, and discover the transcript asynchronously.',
  inputSchema: z.object({
    url: z.string().describe('The podcast episode URL (Spotify, Apple, Pocket Casts, RSS feed, or episode page)'),
    title: z.string().optional().describe('Optional override for the episode title'),
    dimensions: z.array(z.string()).min(1).max(5).optional().describe('Dimensions/tags for the node'),
  }),
  execute: async ({ url, title, dimensions }) => {
    try {
      // Phase 1: Extract podcast metadata
      const extraction = await extractPodcast(url);

      if (!extraction.success) {
        return {
          success: false,
          error: extraction.error || 'Failed to extract podcast metadata',
          data: null,
        };
      }

      const meta = extraction.metadata;
      const episodeTitle = title || meta.episode_title;

      // AI analysis (optional — falls back gracefully)
      const ai = await analyzePodcastWithAI(
        episodeTitle,
        meta.podcast_name,
        meta.description || ''
      );

      const suppliedDimensions = Array.isArray(dimensions) ? dimensions : [];
      const nodeDimensions = [
        ...suppliedDimensions,
        ...(ai.tags || []),
        'podcast',
      ].slice(0, 8);

      // Create node immediately
      const createResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: episodeTitle,
          description: ai.nodeDescription || `${meta.podcast_name} — ${episodeTitle}`,
          link: url,
          dimensions: nodeDimensions,
          chunk: extraction.chunk || undefined,
          chunk_status: extraction.chunk?.length ? 'not_chunked' : null,
          metadata: meta,
        }),
      });

      const createResult = await createResponse.json();

      if (!createResponse.ok) {
        return {
          success: false,
          error: createResult.error || 'Failed to create node',
          data: null,
        };
      }

      const nodeId: number = createResult?.data?.id;

      if (!nodeId) {
        return {
          success: false,
          error: 'Failed to create node',
          data: null,
        };
      }

      // Phase 2: Trigger async transcript discovery (fire-and-forget)
      // Only if transcript not already found during URL resolution
      if (meta.transcript_status === 'queued') {
        setImmediate(() => {
          discoverTranscript(nodeId).catch(err =>
            console.error(`[podcast] transcript discovery failed for node ${nodeId}:`, err)
          );
        });
      }

      const actualDimensions: string[] = createResult.data?.dimensions || nodeDimensions;
      const formattedNode = formatNodeForChat({
        id: nodeId,
        title: episodeTitle,
        dimensions: actualDimensions,
      });
      const dimsDisplay = actualDimensions.length > 0 ? actualDimensions.join(', ') : 'none';

      const transcriptMessage = meta.transcript_status === 'available'
        ? 'Transcript imported.'
        : meta.transcript_status === 'queued'
          ? 'Transcript discovery running in background.'
          : 'Transcript not available yet.';

      return {
        success: true,
        message: `Added ${formattedNode} with dimensions: ${dimsDisplay}. ${transcriptMessage}`,
        data: {
          nodeId,
          title: episodeTitle,
          url,
          dimensions: actualDimensions,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract podcast content',
        data: null,
      };
    }
  },
});
