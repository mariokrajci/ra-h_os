import { describe, expect, it } from 'vitest';

import { detectInputType } from '@/services/agents/quickAddDetection';

describe('detectInputType', () => {
  it('treats text-only quick add input as note by default', () => {
    const markdown = `
# Install Manual

## Overview

1. Choose directory
2. Install dependencies
3. Start service
`;

    expect(detectInputType(markdown)).toBe('note');
  });

  it('keeps source-backed detection for links and documents', () => {
    expect(detectInputType('https://example.com/article')).toBe('website');
    expect(detectInputType('https://example.com/guide.pdf')).toBe('pdf');
    expect(detectInputType('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
  });

  it('respects explicit mode overrides', () => {
    expect(detectInputType('plain text', 'chat')).toBe('chat');
    expect(detectInputType('https://example.com/page', 'note')).toBe('note');
  });
});
