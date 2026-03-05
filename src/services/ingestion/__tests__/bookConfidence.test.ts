import { describe, expect, it } from 'vitest';

import { classifyBookMatchConfidence, shouldAutoApplyBookMatch } from '../bookConfidence';

describe('book confidence policy', () => {
  it('classifies high confidence and auto-applies', () => {
    expect(classifyBookMatchConfidence(0.92)).toBe('high');
    expect(shouldAutoApplyBookMatch(0.92)).toBe(true);
  });

  it('classifies medium confidence as ambiguous', () => {
    expect(classifyBookMatchConfidence(0.7)).toBe('medium');
    expect(shouldAutoApplyBookMatch(0.7)).toBe(false);
  });

  it('classifies low confidence as non-match', () => {
    expect(classifyBookMatchConfidence(0.4)).toBe('low');
  });
});
