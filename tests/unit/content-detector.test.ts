import { describe, expect, it } from 'vitest';

import { detectContentType } from '@/components/focus/source/ContentDetector';

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
});
