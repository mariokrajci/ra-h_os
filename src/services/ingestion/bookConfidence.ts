export type BookMatchConfidence = 'high' | 'medium' | 'low';

export function classifyBookMatchConfidence(score: number): BookMatchConfidence {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export function shouldAutoApplyBookMatch(score: number): boolean {
  return classifyBookMatchConfidence(score) === 'high';
}
