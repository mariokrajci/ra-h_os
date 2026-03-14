import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/database/flagService', () => ({
  flagService: {
    getAllFlags: vi.fn(() => [{ name: 'to-read', color: '#6b7280', created_at: '2026-01-01' }]),
    createFlag: vi.fn((name, color) => ({ name, color, created_at: '2026-01-01' })),
    deleteFlag: vi.fn(() => true),
  },
}));

const { GET, POST } = await import('../../app/api/flags/route');

describe('GET /api/flags', () => {
  it('returns flag list', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.flags).toHaveLength(1);
    expect(data.flags[0].name).toBe('to-read');
  });
});

describe('POST /api/flags', () => {
  it('creates a flag', async () => {
    const req = new Request('http://localhost/api/flags', {
      method: 'POST',
      body: JSON.stringify({ name: 'urgent', color: '#ef4444' }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.flag.name).toBe('urgent');
  });

  it('rejects missing name', async () => {
    const req = new Request('http://localhost/api/flags', {
      method: 'POST',
      body: JSON.stringify({ color: '#ef4444' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
