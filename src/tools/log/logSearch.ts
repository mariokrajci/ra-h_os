import { tool } from 'ai';
import { z } from 'zod';

export const logSearchTool = tool({
  description: 'Search log entries by content using full-text search.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/log/search?q=${encodeURIComponent(query)}`
      );
      const result = await response.json();
      if (!result.success) return { success: false, error: result.error };
      return { success: true, data: result.data, count: result.data.length };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Search failed' };
    }
  },
});
