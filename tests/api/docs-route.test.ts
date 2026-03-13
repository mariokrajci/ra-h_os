import { describe, expect, it } from 'vitest';

import { GET } from '../../app/api/docs/route';

describe('GET /api/docs', () => {
  it('lists only top-level numbered docs in numeric order', async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.map((doc: { slug: string }) => doc.slug)).toEqual([
      '0_overview',
      '2_schema',
      '4_tools-and-guides',
      '5_logging-and-evals',
      '6_ui',
      '8_mcp',
      '9_open-source',
    ]);
  });
});
