import { describe, expect, it, vi } from 'vitest';

import { restoreNodeFile } from '@/components/focus/reader/fileRestore';

describe('restoreNodeFile', () => {
  it('posts multipart form data to restore endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const file = new File([Buffer.from('%PDF')], 'restored.pdf', { type: 'application/pdf' });
    await expect(restoreNodeFile(14, file)).resolves.toEqual({ success: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/nodes/14/file/restore', expect.objectContaining({ method: 'POST' }));
  });

  it('throws when restore endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: 'bad file' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const file = new File([Buffer.from('x')], 'bad.bin', { type: 'application/octet-stream' });

    await expect(restoreNodeFile(14, file)).rejects.toThrow('bad file');
  });
});
