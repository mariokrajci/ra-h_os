import { describe, expect, it } from 'vitest';

import { resolveQuickAddRouting } from '@/services/agents/quickAddDetection';

describe('resolveQuickAddRouting', () => {
  it('routes /book command to note pipeline with parsed metadata', () => {
    const decision = resolveQuickAddRouting('/book Atomic Habits by James Clear');

    expect(decision).toMatchObject({
      inputType: 'note',
      command: {
        kind: 'book',
        title: 'Atomic Habits',
        author: 'James Clear',
      },
    });
  });

  it('falls back unknown slash command to note capture unchanged', () => {
    const decision = resolveQuickAddRouting('/podcast Lex Fridman');

    expect(decision.inputType).toBe('note');
    expect(decision.normalizedInput).toBe('/podcast Lex Fridman');
    expect(decision.command).toMatchObject({
      kind: 'unknown',
      command: 'podcast',
    });
  });

  it('keeps normal link detection for non-command input', () => {
    const decision = resolveQuickAddRouting('https://example.com/article');
    expect(decision.inputType).toBe('website');
    expect(decision.command).toEqual({ kind: 'none' });
  });
});
