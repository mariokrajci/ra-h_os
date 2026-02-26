import { describe, expect, test } from 'vitest';
import { isInsufficientQuotaError } from '@/services/embedding/errors';

describe('ingestion quota error detection', () => {
  test('detects OpenAI insufficient quota errors', () => {
    const msg = '429 You exceeded your current quota, please check your plan and billing details. code: insufficient_quota';
    expect(isInsufficientQuotaError(msg)).toBe(true);
  });

  test('ignores unrelated errors', () => {
    expect(isInsufficientQuotaError('node: no such column: n.content')).toBe(false);
    expect(isInsufficientQuotaError('Request timeout')).toBe(false);
  });
});
