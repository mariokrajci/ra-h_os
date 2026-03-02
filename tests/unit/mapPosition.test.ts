import { describe, expect, it } from 'vitest';
import { getNodePosition } from '@/components/panes/map/utils';
import type { Node, NodeMetadata } from '@/types/database';

describe('map position metadata', () => {
  it('accepts saved map positions in node metadata', () => {
    const metadata: NodeMetadata = {
      map_position: { x: 120, y: 280 },
    };

    expect(metadata.map_position).toEqual({ x: 120, y: 280 });
  });

  it('uses the saved map position before calculating a layout position', () => {
    const node: Node = {
      id: 1,
      title: 'Saved Position Node',
      dimensions: [],
      metadata: {
        map_position: { x: 120, y: 280 },
      },
      created_at: '2026-03-02T00:00:00.000Z',
      updated_at: '2026-03-02T00:00:00.000Z',
    };

    expect(getNodePosition(node, 5, 10, 500, 400, 8)).toEqual({ x: 120, y: 280 });
  });
});
