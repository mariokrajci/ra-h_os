import { describe, expect, it } from 'vitest';
import { sanitizeWebsiteText } from '@/services/typescript/extractors/website';

describe('sanitizeWebsiteText', () => {
  it('removes common repository chrome noise while keeping content', () => {
    const input = [
      'Notifications You must be signed in to change notification settings Fork 7 Star 210',
      'View all files Repository files navigation',
      'Ultra-minimal personal AI agent: starts small, self-modifies its code live.',
      'Quick Start Easy Onboarding',
      'There was an error while loading. Please reload this page.',
      'The system starts from a tiny kernel and grows features incrementally.',
    ].join('\n');

    const cleaned = sanitizeWebsiteText(input);

    expect(cleaned).toContain('Ultra-minimal personal AI agent');
    expect(cleaned).toContain('The system starts from a tiny kernel');
    expect(cleaned).not.toMatch(/signed in|notifications|view all files|error while loading/i);
  });
});
