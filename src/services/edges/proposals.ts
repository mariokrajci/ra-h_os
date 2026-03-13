import { edgeService, nodeService } from '@/services/database';
import type { Node } from '@/types/database';

import { proposalDismissalService } from './proposalDismissals';

const ENTITY_DIMENSIONS = ['people', 'companies', 'organizations', 'books', 'papers', 'articles', 'podcasts', 'creators'];
const GENERIC_TOKENS = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'guide', 'in', 'into', 'manual',
  'non', 'of', 'on', 'or', 'setup', 'server', 'the', 'to', 'ubuntu', 'with',
]);

export interface EdgeProposal {
  sourceNodeId: number;
  targetNodeId: number;
  targetNodeTitle: string;
  reason: string;
  matchedText: string;
}

interface ScoredProposalCandidate {
  proposal: EdgeProposal;
  score: number;
}

const RECIPROCAL_PROPOSAL_THRESHOLD = 0.82;

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

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeMeaningful(text: string): string[] {
  return normalizeForMatch(text)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !GENERIC_TOKENS.has(token));
}

function textContainsPhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalizeForMatch(text)} `;
  const normalizedPhrase = normalizeForMatch(phrase);
  if (!normalizedPhrase) return false;
  return normalizedText.includes(` ${normalizedPhrase} `);
}

function deriveNodeAliases(node: Node): Array<{ value: string; kind: 'title' | 'repo'; tokenCount: number }> {
  const aliases = new Map<string, { kind: 'title' | 'repo'; tokenCount: number }>();
  const addAlias = (value: string, kind: 'title' | 'repo') => {
    const normalized = normalizeForMatch(value);
    if (!normalized || normalized.length < 3) return;
    const tokenCount = normalized.split(' ').filter(Boolean).length;
    const current = aliases.get(normalized);
    if (!current || current.kind === 'title') {
      aliases.set(normalized, { kind, tokenCount });
    }
  };

  addAlias(node.title || '', 'title');

  if (node.title.includes('/')) {
    const [owner, repo] = node.title.split('/', 2);
    addAlias(owner, 'repo');
    addAlias(repo, 'repo');
  }

  return Array.from(aliases.entries()).map(([value, metadata]) => ({ value, ...metadata }));
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

function scoreTitleOverlap(sourceNode: Node, candidateNode: Node): { score: number; matchedText: string } | null {
  const sourceTokens = new Set(tokenizeMeaningful(sourceNode.title || ''));
  const candidateTokens = new Set(tokenizeMeaningful(candidateNode.title || ''));

  if (sourceTokens.size === 0 || candidateTokens.size === 0) {
    return null;
  }

  const sharedTokens = Array.from(candidateTokens).filter(token => sourceTokens.has(token));
  if (sharedTokens.length < 3) {
    return null;
  }

  const overlapRatio = sharedTokens.length / Math.min(sourceTokens.size, candidateTokens.size);
  if (overlapRatio < 0.6) {
    return null;
  }

  return {
    score: 0.7 + Math.min(0.2, overlapRatio / 10),
    matchedText: sharedTokens.join(', '),
  };
}

function collectScoredProposalCandidates(sourceNode: Node, candidateNodes: Node[]): Map<number, ScoredProposalCandidate> {
  const description = sourceNode.description || '';
  const searchableText = [sourceNode.title, sourceNode.description, sourceNode.notes]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join('\n');

  const proposalCandidates = new Map<number, ScoredProposalCandidate>();
  const registerProposal = (proposal: EdgeProposal, score: number) => {
    const existing = proposalCandidates.get(proposal.targetNodeId);
    if (!existing || score > existing.score) {
      proposalCandidates.set(proposal.targetNodeId, { proposal, score });
    }
  };

  if (!searchableText.trim()) {
    return proposalCandidates;
  }

  const candidates = extractCandidateEntities(description);
  const exactMatches = findMatchingEntityNodes(candidates, candidateNodes);

  for (const [matchedText, entityNode] of exactMatches) {
    if (entityNode.id === sourceNode.id) continue;
    registerProposal({
      sourceNodeId: sourceNode.id,
      targetNodeId: entityNode.id,
      targetNodeTitle: entityNode.title,
      reason: `Explicitly mentioned in description: "${matchedText}"`,
      matchedText,
    }, 1);
  }

  for (const candidateNode of candidateNodes) {
    if (candidateNode.id === sourceNode.id) continue;

    const aliases = deriveNodeAliases(candidateNode);
    const exactAlias = aliases.find(alias => {
      if (alias.kind === 'title' && alias.tokenCount < 2) {
        return false;
      }
      return textContainsPhrase(searchableText, alias.value);
    });
    if (exactAlias) {
      registerProposal({
        sourceNodeId: sourceNode.id,
        targetNodeId: candidateNode.id,
        targetNodeTitle: candidateNode.title,
        reason: exactAlias.kind === 'repo'
          ? `Repository alias mentioned in note text: "${exactAlias.value}"`
          : `Normalized title mentioned in note text: "${exactAlias.value}"`,
        matchedText: exactAlias.value,
      }, exactAlias.kind === 'repo' ? 0.82 : 0.92);
      continue;
    }

    const overlap = scoreTitleOverlap(sourceNode, candidateNode);
    if (overlap) {
      registerProposal({
        sourceNodeId: sourceNode.id,
        targetNodeId: candidateNode.id,
        targetNodeTitle: candidateNode.title,
        reason: `Strong title overlap with this note: "${overlap.matchedText}"`,
        matchedText: overlap.matchedText,
      }, overlap.score);
    }
  }

  return proposalCandidates;
}

export async function buildEdgeProposalsForNode(
  sourceNode: Node,
  candidateNodes: Node[],
  options: {
    dismissedTargetIds: Set<number>;
    edgeExists: (fromId: number, toId: number) => Promise<boolean>;
  }
): Promise<EdgeProposal[]> {
  const proposalCandidates = collectScoredProposalCandidates(sourceNode, candidateNodes);

  for (const candidateNode of candidateNodes) {
    if (candidateNode.id === sourceNode.id) continue;
    if (proposalCandidates.has(candidateNode.id)) continue;

    const reverseMatch = collectScoredProposalCandidates(candidateNode, [candidateNode, sourceNode]).get(sourceNode.id);
    if (!reverseMatch || reverseMatch.score < RECIPROCAL_PROPOSAL_THRESHOLD) continue;

    proposalCandidates.set(candidateNode.id, {
      score: reverseMatch.score - 0.01,
      proposal: {
        sourceNodeId: sourceNode.id,
        targetNodeId: candidateNode.id,
        targetNodeTitle: candidateNode.title,
        reason: `Reciprocal suggestion from related note: ${reverseMatch.proposal.reason}`,
        matchedText: reverseMatch.proposal.matchedText,
      },
    });
  }

  const proposals: Array<{ proposal: EdgeProposal; score: number }> = [];
  for (const { proposal, score } of proposalCandidates.values()) {
    if (options.dismissedTargetIds.has(proposal.targetNodeId)) continue;
    if (
      await options.edgeExists(sourceNode.id, proposal.targetNodeId) ||
      await options.edgeExists(proposal.targetNodeId, sourceNode.id)
    ) {
      continue;
    }
    proposals.push({ proposal, score });
  }

  return proposals
    .sort((a, b) => b.score - a.score || a.proposal.targetNodeTitle.localeCompare(b.proposal.targetNodeTitle))
    .map(entry => entry.proposal);
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
    edgeExists: (fromId, toId) => edgeService.connectionExists(fromId, toId),
  });
}
