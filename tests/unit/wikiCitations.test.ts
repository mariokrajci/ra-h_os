import { describe, expect, it } from 'vitest';
import { rankOutsideNeighbors } from '@/services/wiki/citations';

describe('rankOutsideNeighbors', () => {
  it('excludes nodes already in subtopic set', () => {
    const subtopic = new Set([1, 2, 3]);
    const rows = [
      { neighbor_id: 2, created_at: '2026-01-01T00:00:00.000Z' },
      { neighbor_id: 4, created_at: '2026-01-01T00:00:00.000Z' },
    ];

    const ranked = rankOutsideNeighbors(subtopic, rows, 10);

    expect(ranked.map(r => r.id)).toEqual([4]);
  });

  it('ranks by connection count, then latest edge timestamp', () => {
    const subtopic = new Set([10]);
    const rows = [
      { neighbor_id: 5, created_at: '2026-01-01T00:00:00.000Z' },
      { neighbor_id: 5, created_at: '2026-01-02T00:00:00.000Z' },
      { neighbor_id: 6, created_at: '2026-01-03T00:00:00.000Z' },
      { neighbor_id: 7, created_at: '2026-01-05T00:00:00.000Z' },
      { neighbor_id: 7, created_at: '2026-01-06T00:00:00.000Z' },
    ];

    const ranked = rankOutsideNeighbors(subtopic, rows, 10);

    expect(ranked.map(r => r.id)).toEqual([7, 5, 6]);
    expect(ranked[0].connectionCount).toBe(2);
    expect(ranked[1].connectionCount).toBe(2);
  });

  it('applies result limit', () => {
    const subtopic = new Set<number>();
    const rows = [
      { neighbor_id: 1, created_at: '2026-01-01T00:00:00.000Z' },
      { neighbor_id: 2, created_at: '2026-01-01T00:00:00.000Z' },
      { neighbor_id: 3, created_at: '2026-01-01T00:00:00.000Z' },
    ];

    const ranked = rankOutsideNeighbors(subtopic, rows, 2);

    expect(ranked).toHaveLength(2);
  });
});
