const INSUFFICIENT_QUOTA_PATTERNS = [
  'insufficient_quota',
  'exceeded your current quota',
  'check your plan and billing',
  '429',
];

export function isInsufficientQuotaError(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return INSUFFICIENT_QUOTA_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function getQuotaWarningMessage(): string {
  return 'OpenAI quota exceeded. Node was saved, but embedding is paused. Add credits or raise OpenAI limits, then retry embedding.';
}

