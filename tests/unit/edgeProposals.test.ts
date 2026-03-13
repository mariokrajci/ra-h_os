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
    expect(proposals.map(proposal => proposal.targetNodeId)).toEqual(expect.arrayContaining([11, 12]));
    expect(proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceNodeId: 10,
        targetNodeId: 11,
        targetNodeTitle: 'Simon Willison',
        reason: 'Explicitly mentioned in description: "Simon Willison"',
      }),
    ]));
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

  it('proposes connections for strongly overlapping titles even without an exact mention', async () => {
    const sourceNode = makeNode({
      id: 30,
      title: 'Digital Research Lab Blueprint',
      description: 'A self-hosted multimodal lab for synthesis and collective memory.',
    });
    const relatedBlueprint = makeNode({
      id: 31,
      title: 'Blueprint: Home-Server Digital Research Lab',
      dimensions: ['projects'],
    });
    const unrelatedPlan = makeNode({
      id: 32,
      title: 'Paste as Markdown: Implementation Plan',
      dimensions: ['projects'],
    });

    const proposals = await buildEdgeProposalsForNode(sourceNode, [sourceNode, relatedBlueprint, unrelatedPlan], {
      dismissedTargetIds: new Set(),
      edgeExists: vi.fn().mockResolvedValue(false),
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      targetNodeId: 31,
      targetNodeTitle: 'Blueprint: Home-Server Digital Research Lab',
      reason: expect.stringContaining('Strong title overlap'),
    });
  });

  it('uses note text and repo-style aliases to propose edges', async () => {
    const sourceNode = makeNode({
      id: 40,
      title: 'RA-H OS Server Install Manual (Ubuntu, non-Docker)',
      description: 'This deployment guide compares the RA H OS workflow with a lightweight paperclip setup.',
      notes: 'It should stay compatible with paperclip and ra h os automation over time.',
    });
    const repoNode = makeNode({ id: 41, title: 'paperclipai/paperclip', dimensions: ['projects'] });
    const appNode = makeNode({ id: 42, title: 'ra-h_os', dimensions: ['projects'] });
    const unrelatedNode = makeNode({ id: 43, title: 'Atomic Habits', dimensions: ['books'] });

    const proposals = await buildEdgeProposalsForNode(sourceNode, [sourceNode, repoNode, appNode, unrelatedNode], {
      dismissedTargetIds: new Set(),
      edgeExists: vi.fn().mockResolvedValue(false),
    });

    expect(proposals.map(proposal => proposal.targetNodeId)).toEqual([42, 41]);
    expect(proposals[0].reason).toContain('title mentioned in note text');
    expect(proposals[1].reason).toContain('Repository alias mentioned');
  });

  it('surfaces high-confidence reverse matches as reciprocal suggestions', async () => {
    const installManual = makeNode({
      id: 50,
      title: 'RA-H OS Server Install Manual (Ubuntu, non-Docker)',
      description: 'This deployment guide compares the RA H OS workflow with a lightweight paperclip setup.',
      notes: 'It should stay compatible with paperclip and ra h os automation over time.',
    });
    const appNode = makeNode({
      id: 51,
      title: 'ra-h_os',
      description: 'Local-first research workspace for notes, edges, and agent workflows.',
      dimensions: ['projects'],
    });

    const proposals = await buildEdgeProposalsForNode(appNode, [appNode, installManual], {
      dismissedTargetIds: new Set(),
      edgeExists: vi.fn().mockResolvedValue(false),
    });

    expect(proposals).toEqual([
      expect.objectContaining({
        sourceNodeId: 51,
        targetNodeId: 50,
        targetNodeTitle: 'RA-H OS Server Install Manual (Ubuntu, non-Docker)',
        reason: expect.stringContaining('Reciprocal'),
      }),
    ]);
  });

  it('excludes proposals when a connection already exists in the reverse stored direction', async () => {
    const sourceNode = makeNode({
      id: 60,
      title: 'RA-H OS Server Install Manual (Ubuntu, non-Docker)',
      description: 'This deployment guide compares the RA H OS workflow.',
      notes: 'ra h os compatibility notes',
    });
    const targetNode = makeNode({
      id: 61,
      title: 'ra-h_os',
      dimensions: ['projects'],
    });

    const proposals = await buildEdgeProposalsForNode(sourceNode, [sourceNode, targetNode], {
      dismissedTargetIds: new Set(),
      edgeExists: vi.fn().mockImplementation(async (fromId: number, toId: number) => fromId === 61 && toId === 60),
    });

    expect(proposals).toEqual([]);
  });
});
