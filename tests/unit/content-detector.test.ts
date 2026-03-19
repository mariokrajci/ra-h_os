import { describe, expect, it } from 'vitest';

import { detectContentType, resolveReaderFormat, toTextContentType } from '@/components/focus/source/ContentDetector';

describe('detectContentType', () => {
  it('classifies markdown install manuals as markdown, not transcript', () => {
    const content = `
# RA-H OS Server Install Manual (Ubuntu, non-Docker)

This guide documents the working setup used to install **\`ra-h_os\`** on an Ubuntu server.

## Overview

* Repo path: \`/home/mario/srv/apps/ra-h_os\`
* App port: \`3001\`
* Process manager: \`systemd\`

## 1. Choose the right directory

\`\`\`bash
cd ~/srv/apps
git clone https://github.com/mariokrajci/ra-h_os.git ra-h_os
cd ra-h_os
\`\`\`
`;

    expect(detectContentType(content)).toBe('markdown');
  });

  it('detects transcript when markdown list items contain real timestamps', () => {
    const content = `
- [00:00] Intro and agenda
- [00:24] Why this architecture
- [01:03] Migration steps
- [02:10] Q&A

Speaker notes and details under each timestamp.
`;

    expect(detectContentType(content)).toBe('transcript');
  });

  it('classifies heading-plus-links marketing pages as markdown', () => {
    const content = `
# The Unified Interface For LLMs

Better [prices](https://openrouter.ai/models?order=pricing-low-to-high), better [uptime](https://openrouter.ai/docs/features/uptime-optimization), no subscriptions.

[Get API Key](https://openrouter.ai/settings/keys)

[Explore Models

30T

[Monthly Tokens](https://openrouter.ai/rankings)
`;

    expect(detectContentType(content, 'https://openrouter.ai')).toBe('markdown');
  });

  it('resolves reader format using file type before explicit format', () => {
    const content = '# Any content';
    const resolved = resolveReaderFormat(content, 'https://example.com', {
      file_type: 'pdf',
      reader_format: 'markdown',
      source_family: 'website',
    });

    expect(resolved).toBe('pdf');
  });

  it('resolves reader format using explicit reader_format before source-family default', () => {
    const content = 'Plain short content that would otherwise be raw.';
    const resolved = resolveReaderFormat(content, undefined, {
      source_family: 'website',
      reader_format: 'article',
    });

    expect(resolved).toBe('article');
  });

  it('uses source-family default when explicit format is absent', () => {
    const content = 'Short content';
    const resolved = resolveReaderFormat(content, undefined, {
      source_family: 'youtube',
    });

    expect(resolved).toBe('transcript');
  });

  it('maps chat reader format to markdown text rendering', () => {
    expect(toTextContentType('chat')).toBe('chat');
  });
});
