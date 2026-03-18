import { tool } from 'ai';
import { z } from 'zod';
import { formatNodeForChat } from '../infrastructure/nodeFormatter';
import { extractCreatedNodeDimensions, extractCreatedNodeId, resolveCreateNodeError } from '../infrastructure/createNodeResult';
import { finalizeWebsiteNode } from '@/services/ingestion/finalizeSourceNode';
import { READER_FORMAT_VALUES, type ReaderFormatValue } from '@/lib/readerFormat';

function normalizeWebsiteTitle(url: string, extractedTitle?: string): string {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }

  if (parsed && parsed.hostname === 'github.com') {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1].replace(/\.git$/i, '')}`;
    }
  }

  const title = (extractedTitle || '').trim();
  if (!title) {
    return parsed ? `Website: ${parsed.hostname}` : 'Website';
  }

  let normalized = title
    .replace(/^GitHub\s*-\s*/i, '')
    .replace(/\s*[-|]\s*GitHub$/i, '')
    .replace(/\s*[-|]\s*X$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return parsed ? `Website: ${parsed.hostname}` : 'Website';
  }

  return normalized.slice(0, 160);
}

export const websiteExtractTool = tool({
  description: 'Create a website node immediately, then extract source content and notes in the background',
  inputSchema: z.object({
    url: z.string().describe('The website URL to add to knowledge base'),
    title: z.string().optional().describe('Custom title (auto-generated if not provided)'),
    dimensions: z.array(z.string()).min(1).max(5).optional().describe('Dimension tags to apply to the created node (locked dimensions first)'),
    readerFormat: z.enum(READER_FORMAT_VALUES).optional().describe('Optional reader format override'),
    apiBaseUrl: z.string().optional().describe('Internal API base URL override')
  }),
  execute: async ({ url, title, dimensions, readerFormat, apiBaseUrl }) => {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return {
          success: false,
          error: 'Invalid URL format - must start with http:// or https://',
          data: null
        };
      }

      const nodeTitle = title || normalizeWebsiteTitle(url);
      const trimmedDimensions = (Array.isArray(dimensions) ? dimensions : [])
        .map(dim => (typeof dim === 'string' ? dim.trim() : ''))
        .filter(Boolean)
        .slice(0, 5);

      const baseUrl = (apiBaseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
      const createResponse = await fetch(`${baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nodeTitle,
          link: url,
          dimensions: trimmedDimensions,
          metadata: {
            source: 'website',
            source_family: 'website',
            reader_format: (readerFormat || 'markdown') as ReaderFormatValue,
            hostname: new URL(url).hostname,
            source_status: 'processing',
            notes_status: 'pending',
            staged_ingestion: true,
            staged_ingestion_started_at: new Date().toISOString(),
          }
        })
      });

      const createResult = await createResponse.json().catch(() => null);
      if (!createResponse.ok) {
        return {
          success: false,
          error: resolveCreateNodeError(createResult, createResponse),
          data: null
        };
      }

      const nodeId = extractCreatedNodeId(createResult);
      if (!nodeId) {
        return {
          success: false,
          error: 'Failed to create node (missing node id in response)',
          data: null
        };
      }

      setImmediate(() => {
        Promise.resolve(finalizeWebsiteNode({ nodeId, title: nodeTitle, url })).catch(err =>
          console.error(`[website] background finalization failed for node ${nodeId}:`, err)
        );
      });

      const actualDimensions = extractCreatedNodeDimensions(createResult) || trimmedDimensions;
      const formattedNode = formatNodeForChat({ id: nodeId, title: nodeTitle, dimensions: actualDimensions });
      const dimsDisplay = actualDimensions.length > 0 ? actualDimensions.join(', ') : 'none';

      return {
        success: true,
        message: `Added ${formattedNode} with dimensions: ${dimsDisplay}. Source extraction running in background.`,
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
        error: error instanceof Error ? error.message : 'Failed to create website node',
        data: null
      };
    }
  }
});
