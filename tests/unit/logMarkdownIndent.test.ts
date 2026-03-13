import { describe, expect, it } from 'vitest';

import { getLogMarkdownIndentStyle } from '@/components/log/logMarkdownIndent';

describe('getLogMarkdownIndentStyle', () => {
  it('returns no hanging indent style for plain text', () => {
    expect(getLogMarkdownIndentStyle('plain text')).toEqual({});
  });

  it('applies a hanging indent for unordered list items', () => {
    expect(getLogMarkdownIndentStyle('- discovered Paperclip')).toEqual({
      paddingLeft: '0.9em',
      textIndent: '-0.9em',
    });
  });

  it('accounts for nested unordered list prefixes', () => {
    expect(getLogMarkdownIndentStyle('  - nested item')).toEqual({
      paddingLeft: '1.9em',
      textIndent: '-1.9em',
    });
  });

  it('accounts for ordered list prefixes', () => {
    expect(getLogMarkdownIndentStyle('10. ordered item')).toEqual({
      paddingLeft: '2.7em',
      textIndent: '-2.7em',
    });
  });
});
