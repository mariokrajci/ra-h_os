import { tool } from 'ai';
import { z } from 'zod';

export const logAddTool = tool({
  description: 'Add an entry to the Log for a given date. Use ISO date format (YYYY-MM-DD). Content can be plain text or markdown with bullet points.',
  inputSchema: z.object({
    date: z.string().describe('ISO date, e.g. 2026-03-05. Defaults to today if omitted.').optional(),
    content: z.string().describe('The log entry content (markdown supported)'),
  }),
  execute: async ({ date, content }) => {
    const entryDate = date ?? new Date().toISOString().slice(0, 10);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: entryDate, content, order_idx: 0 }),
      });
      const result = await response.json();
      if (!result.success) return { success: false, error: result.error };
      return { success: true, data: result.data, message: `Log entry added for ${entryDate}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add log entry' };
    }
  },
});
