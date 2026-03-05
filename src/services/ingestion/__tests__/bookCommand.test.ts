import { describe, expect, it } from 'vitest';

import { parseBookCommand } from '../bookCommand';

describe('parseBookCommand', () => {
  it('parses plain title syntax', () => {
    expect(parseBookCommand('/book Atomic Habits')).toEqual({
      kind: 'book',
      command: 'book',
      title: 'Atomic Habits',
      author: undefined,
      isbn: undefined,
      confidence: 0.85,
      needsConfirmation: false,
    });
  });

  it('parses natural language author and isbn syntax', () => {
    expect(parseBookCommand('/book Atomic Habits by James Clear isbn 9780735211292')).toEqual({
      kind: 'book',
      command: 'book',
      title: 'Atomic Habits',
      author: 'James Clear',
      isbn: '9780735211292',
      confidence: 0.98,
      needsConfirmation: false,
    });
  });

  it('supports optional pipe power-user syntax', () => {
    expect(parseBookCommand('/book Atomic Habits | James Clear | 9780735211292')).toEqual({
      kind: 'book',
      command: 'book',
      title: 'Atomic Habits',
      author: 'James Clear',
      isbn: '9780735211292',
      confidence: 0.98,
      needsConfirmation: false,
    });
  });

  it('returns unknown command for unsupported slash commands', () => {
    expect(parseBookCommand('/podcast Lex Fridman')).toEqual({
      kind: 'unknown',
      command: 'podcast',
      rawInput: '/podcast Lex Fridman',
    });
  });

  it('returns none for normal note input', () => {
    expect(parseBookCommand('remember to revisit chapter 3')).toEqual({ kind: 'none' });
  });

  it('marks malformed book command for confirmation', () => {
    expect(parseBookCommand('/book by isbn 9780735211292')).toEqual({
      kind: 'book',
      command: 'book',
      title: undefined,
      author: undefined,
      isbn: '9780735211292',
      confidence: 0.4,
      needsConfirmation: true,
    });
  });
});
