import { describe, expect, it } from 'vitest';

import { GET } from '../../app/api/docs/[slug]/route';

describe('GET /api/docs/[slug]', () => {
  it('returns the content and metadata for a numbered doc', async () => {
    const response = await GET(new Request('http://localhost/api/docs/6_ui') as any, {
      params: Promise.resolve({ slug: '6_ui' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.slug).toBe('6_ui');
    expect(payload.data.content).toContain('# User Interface');
  });

  it('returns 404 for a non-numbered or missing doc', async () => {
    const response = await GET(new Request('http://localhost/api/docs/README') as any, {
      params: Promise.resolve({ slug: 'README' }),
    });

    expect(response.status).toBe(404);
  });
});
