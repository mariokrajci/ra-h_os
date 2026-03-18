import { describe, expect, it, vi } from 'vitest';

const { enqueueQuickAddMock } = vi.hoisted(() => ({
  enqueueQuickAddMock: vi.fn(() =>
    Promise.resolve({ id: 'qa_1', task: 't', inputType: 'note', status: 'queued' })
  ),
}));

vi.mock('@/services/agents/quickAdd', () => ({
  enqueueQuickAdd: enqueueQuickAddMock,
}));

import { POST } from '../../app/api/quick-add/route';
import { NextRequest } from 'next/server';

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/quick-add', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/quick-add sourceUrl/sourceTitle', () => {
  it('passes sourceUrl and sourceTitle to enqueueQuickAdd', async () => {
    await POST(makeRequest({
      input: 'Some selected text',
      mode: 'note',
      sourceUrl: 'https://example.com/article',
      sourceTitle: 'Example Article',
    }));

    expect(enqueueQuickAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUrl: 'https://example.com/article',
        sourceTitle: 'Example Article',
      })
    );
  });

  it('omits sourceUrl/sourceTitle when not provided', async () => {
    await POST(makeRequest({ input: 'just a note' }));

    expect(enqueueQuickAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUrl: undefined,
        sourceTitle: undefined,
      })
    );
  });

  it('enforces extension token when configured', async () => {
    process.env.RAOS_QUICK_ADD_REQUIRE_TOKEN = 'true';
    process.env.RAOS_EXTENSION_TOKEN = 'secret-token';

    const unauthorized = await POST(makeRequest({ input: 'test' }));
    expect(unauthorized.status).toBe(401);

    const authorized = await POST(new NextRequest('http://localhost:3000/api/quick-add', {
      method: 'POST',
      body: JSON.stringify({ input: 'test' }),
      headers: {
        'Content-Type': 'application/json',
        'X-RAOS-Extension-Token': 'secret-token',
      },
    }));
    expect(authorized.status).toBe(200);

    delete process.env.RAOS_QUICK_ADD_REQUIRE_TOKEN;
    delete process.env.RAOS_EXTENSION_TOKEN;
  });

  it('sanitizes sourceUrl/sourceTitle/input payloads', async () => {
    await POST(makeRequest({
      input: 'hello <script>alert(1)</script> [x](javascript:alert(1))',
      mode: 'note',
      sourceUrl: 'javascript:alert(1)',
      sourceTitle: '<script>bad</script> title',
    }));

    expect(enqueueQuickAddMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rawInput: expect.stringContaining('[x](#)'),
        sourceUrl: undefined,
        sourceTitle: 'title',
      })
    );
  });
});
