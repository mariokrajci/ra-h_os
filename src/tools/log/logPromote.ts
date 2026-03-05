import { tool } from 'ai';
import { z } from 'zod';

export const logPromoteTool = tool({
  description: 'Promote a log entry to a full node. Returns the new node id.',
  inputSchema: z.object({
    id: z.number().describe('The log entry id to promote'),
  }),
  execute: async ({ id }) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/log/${id}/promote`,
        { method: 'POST' }
      );
      const result = await response.json();
      if (!result.success) return { success: false, error: result.error };
      return { success: true, data: result.data, message: `Entry ${id} promoted to node ${result.data.nodeId}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Promote failed' };
    }
  },
});
