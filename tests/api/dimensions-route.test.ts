import { describe, expect, it } from 'vitest';

import { POST, PUT } from '../../app/api/dimensions/route';

describe('PUT /api/dimensions icon updates', () => {
  it('accepts icon-only updates for an existing dimension', async () => {
    const name = `icon_test_${Date.now()}`;

    const createRequest = new Request('http://localhost/api/dimensions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: 'test dimension', isPriority: false }),
    });
    const createResponse = await POST(createRequest as any);
    expect(createResponse.status).toBe(200);

    const updateRequest = new Request('http://localhost/api/dimensions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon: 'BookOpen' }),
    });
    const updateResponse = await PUT(updateRequest as any);
    const payload = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.icon).toBe('BookOpen');
  });
});
