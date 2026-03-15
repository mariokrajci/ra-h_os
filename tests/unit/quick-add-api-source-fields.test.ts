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
});
