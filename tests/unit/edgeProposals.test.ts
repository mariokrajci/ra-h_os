import { describe, expect, it, vi } from 'vitest';

import { buildEdgeProposalsForNode, extractCandidateEntities } from '@/services/edges/proposals';
import type { Node } from '@/types/database';

const makeNode = (overrides: Partial<Node>): Node => ({
  id: overrides.id ?? 1,
  title: overrides.title ?? 'Untitled',
  description: overrides.description ?? '',
  notes: overrides.notes,
  link: overrides.link,
  event_date: overrides.event_date ?? null,
  dimensions: overrides.dimensions ?? [],
  chunk: overrides.chunk,
  metadata: overrides.metadata ?? null,
  created_at: overrides.created_at ?? '2026-03-13T12:00:00.000Z',
  updated_at: overrides.updated_at ?? '2026-03-13T12:00:00.000Z',
});

describe('edge proposals', () => {
  it('extracts named entities and quoted titles from note descriptions', () => {
    const candidates = extractCandidateEntities(
      'By Simon Willison, this note references "Deep Work" and OpenAI in passing.'
    );

    expect(candidates).toEqual(
      expect.arrayContaining(['Simon Willison', 'Deep Work', 'OpenAI'])
    );
  });

  it('returns conservative proposals for exact title matches only', async () => {
    const sourceNode = makeNode({
      id: 10,
      title: 'AI productivity notes',
      description: 'By Simon Willison this note builds on OpenAI field notes.',
    });
    const candidateNodes = [
      sourceNode,
      makeNode({ id: 11, title: 'Simon Willison', dimensions: ['people'] }),
      makeNode({ id: 12, title: 'OpenAI', dimensions: ['companies'] }),
      makeNode({ id: 13, title: 'Willison', dimensions: ['people'] }),
    ];

    const proposals = await buildEdgeProposalsForNode(sourceNode, candidateNodes, {
      dismissedTargetIds: new Set(),
      edgeExists: vi.fn().mockResolvedValue(false),
    });

    expect(proposals).toHaveLength(2);
    expect(proposals.map(proposal => proposal.targetNodeId)).toEqual([11, 12]);
    expect(proposals[0]).toMatchObject({
      sourceNodeId: 10,
      targetNodeId: 11,
      targetNodeTitle: 'Simon Willison',
      reason: 'Explicitly mentioned in description: "Simon Willison"',
    });
  });

  it('excludes self-links, dismissed pairs, and existing edges', async () => {
    const sourceNode = makeNode({
      id: 20,
      title: 'Source note',
      description: 'This note references Sam Altman, OpenAI, and Source note.',
    });
    const sam = makeNode({ id: 21, title: 'Sam Altman', dimensions: ['people'] });
    const openAi = makeNode({ id: 22, title: 'OpenAI', dimensions: ['companies'] });

    const proposals = await buildEdgeProposalsForNode(sourceNode, [sourceNode, sam, openAi], {
      dismissedTargetIds: new Set([22]),
      edgeExists: vi.fn().mockImplementation(async (fromId: number, toId: number) => fromId === 20 && toId === 21),
    });

    expect(proposals).toEqual([]);
  });
});
