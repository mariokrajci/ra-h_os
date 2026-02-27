import { tool } from 'ai';
import { z } from 'zod';
import { formatNodeForChat } from '../infrastructure/nodeFormatter';
import { finalizePdfNode } from '@/services/ingestion/finalizeSourceNode';

function getPdfTitle(url: string, providedTitle?: string): string {
  if (providedTitle?.trim()) return providedTitle.trim();
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').pop()?.replace(/\.pdf$/i, '');
    return filename ? `PDF: ${decodeURIComponent(filename)}` : `PDF: ${parsed.hostname}`;
  } catch {
    return 'PDF Document';
  }
}

function buildPdfDescription(url: string, title: string): string {
  return `PDF from ${new URL(url).hostname}: ${title.slice(0, 220)}`;
}

export const paperExtractTool = tool({
  description: 'Create a PDF node immediately, then extract the full text and notes in the background',
  inputSchema: z.object({
    url: z.string().describe('The PDF URL to add to inbox'),
    title: z.string().optional().describe('Custom title (auto-generated if not provided)'),
    dimensions: z.array(z.string()).min(1).max(5).optional().describe('Dimension tags to apply to the created node (locked dimensions first)')
  }),
  execute: async ({ url, title, dimensions }) => {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return {
          success: false,
          error: 'Invalid URL format - must start with http:// or https://',
          data: null
        };
      }

      if (!url.toLowerCase().includes('.pdf') && !url.includes('arxiv.org')) {
        return {
          success: false,
          error: 'URL does not appear to point to a PDF file',
          data: null
        };
      }

      const nodeTitle = getPdfTitle(url, title);
      const trimmedDimensions = (Array.isArray(dimensions) ? dimensions : [])
        .map(dim => (typeof dim === 'string' ? dim.trim() : ''))
        .filter(Boolean)
        .slice(0, 5);

      const createResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nodeTitle,
          description: buildPdfDescription(url, nodeTitle),
          link: url,
          dimensions: trimmedDimensions,
          metadata: {
            source: 'pdf',
            hostname: new URL(url).hostname,
            source_status: 'processing',
            notes_status: 'pending',
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
        finalizePdfNode({ nodeId, title: nodeTitle, url }).catch(err =>
          console.error(`[pdf] background finalization failed for node ${nodeId}:`, err)
        );
      });

      const actualDimensions: string[] = createResult.data?.dimensions || trimmedDimensions;
      const formattedNode = formatNodeForChat({ id: nodeId, title: nodeTitle, dimensions: actualDimensions });
      const dimsDisplay = actualDimensions.length > 0 ? actualDimensions.join(', ') : 'none';

      return {
        success: true,
        message: `Added ${formattedNode} with dimensions: ${dimsDisplay}. PDF extraction running in background.`,
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
        error: error instanceof Error ? error.message : 'Failed to create PDF node',
        data: null
      };
    }
  }
});
