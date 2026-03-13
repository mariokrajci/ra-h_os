import { edgeService, nodeService } from '@/services/database';
import type { Node } from '@/types/database';

import { proposalDismissalService } from './proposalDismissals';

const ENTITY_DIMENSIONS = ['people', 'companies', 'organizations', 'books', 'papers', 'articles', 'podcasts', 'creators'];

export interface EdgeProposal {
  sourceNodeId: number;
  targetNodeId: number;
  targetNodeTitle: string;
  reason: string;
  matchedText: string;
}

function cleanEntityCandidate(candidate: string): string {
  let cleaned = candidate.trim();
  const prefixPatterns = [
    /^by\s+/i,
    /^author:\s*/i,
    /^written by\s+/i,
    /^from\s+/i,
    /^via\s+/i,
    /^featuring\s+/i,
    /^with\s+/i,
    /^hosted by\s+/i,
  ];

  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

function isGenericPhrase(phrase: string): boolean {
  const normalized = phrase.toLowerCase();
  const genericTerms = [
    'the author', 'the article', 'the book', 'the podcast',
    'this article', 'this book', 'this podcast', 'this paper',
    'new research', 'recent study', 'key points', 'main ideas',
    'artificial intelligence', 'machine learning', 'deep learning',
    'first section', 'last section', 'next chapter',
    'united states', 'new york', 'san francisco', 'silicon valley'
  ];

  return genericTerms.some(term => normalized === term || normalized.startsWith(`${term} `));
}

export function extractCandidateEntities(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const candidates: Set<string> = new Set();

  const byPattern = /\b[Bb]y\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = byPattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (name.length >= 4 && !isGenericPhrase(name)) {
      candidates.add(name);
    }
  }

  const properNamePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  while ((match = properNamePattern.exec(text)) !== null) {
    const cleaned = cleanEntityCandidate(match[1].trim());
    if (cleaned.length >= 4 && !isGenericPhrase(cleaned)) {
      candidates.add(cleaned);
    }
  }

  const quotedPattern = /["']([^"']{3,60})["']/g;
  while ((match = quotedPattern.exec(text)) !== null) {
    const title = match[1].trim();
    if (title.length >= 3 && !isGenericPhrase(title)) {
      candidates.add(title);
    }
  }

  const orgPattern = /\b(OpenAI|DeepMind|Anthropic|Google|Microsoft|Meta|Apple|Amazon|Y Combinator|YC|Stripe|Coinbase|Fly\.io|Vercel|Cloudflare)\b/gi;
  while ((match = orgPattern.exec(text)) !== null) {
    candidates.add(match[1]);
  }

  return Array.from(candidates);
}

function findMatchingEntityNodes(candidates: string[], allNodes: Node[]): Map<string, Node> {
  const matches = new Map<string, Node>();

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase().trim();
    const matchingNode = allNodes.find(node => {
      const normalizedTitle = (node.title || '').toLowerCase().trim();
      if (normalizedTitle !== normalizedCandidate) return false;

      const nodeDimensions = node.dimensions || [];
      const hasEntityDimension = nodeDimensions.some(dim =>
        ENTITY_DIMENSIONS.includes(dim.toLowerCase())
      );

      return hasEntityDimension || node.title.length < 50;
    });

    if (matchingNode) {
      matches.set(candidate, matchingNode);
    }
  }

  return matches;
}

export async function buildEdgeProposalsForNode(
  sourceNode: Node,
  candidateNodes: Node[],
  options: {
    dismissedTargetIds: Set<number>;
    edgeExists: (fromId: number, toId: number) => Promise<boolean>;
  }
): Promise<EdgeProposal[]> {
  const description = sourceNode.description || '';
  if (description.length < 10) {
    return [];
  }

  const candidates = extractCandidateEntities(description);
  if (candidates.length === 0) {
    return [];
  }

  const matches = findMatchingEntityNodes(candidates, candidateNodes);
  const proposals: EdgeProposal[] = [];

  for (const [matchedText, entityNode] of matches) {
    if (entityNode.id === sourceNode.id) continue;
    if (options.dismissedTargetIds.has(entityNode.id)) continue;
    if (await options.edgeExists(sourceNode.id, entityNode.id)) continue;

    proposals.push({
      sourceNodeId: sourceNode.id,
      targetNodeId: entityNode.id,
      targetNodeTitle: entityNode.title,
      reason: `Explicitly mentioned in description: "${matchedText}"`,
      matchedText,
    });
  }

  return proposals;
}

export async function generateEdgeProposals(sourceNodeId: number): Promise<EdgeProposal[]> {
  const sourceNode = await nodeService.getNodeById(sourceNodeId);
  if (!sourceNode) {
    return [];
  }

  const [candidateNodes, dismissedTargetIds] = await Promise.all([
    nodeService.getNodes({ limit: 10000 }),
    proposalDismissalService.getDismissedTargetIds(sourceNodeId),
  ]);

  return buildEdgeProposalsForNode(sourceNode, candidateNodes, {
    dismissedTargetIds,
    edgeExists: (fromId, toId) => edgeService.edgeExists(fromId, toId),
  });
}
