import { describe, expect, it } from 'vitest';
import { clampDescription, generateFallbackDescription } from '@/services/database/descriptionService';

describe('descriptionService', () => {
  it('clamps long descriptions at a word boundary', () => {
    const input = 'GitHub repository for Promptfoo — a tool that streamlines prompt management for AI models, allowing users to organize, test, and optimize prompts efficiently. This innovation enhances productivity for developers and researchers, making AI interactions more effective and user-friendly.';
    const output = clampDescription(input, 280);

    expect(output.length).toBeLessThanOrEqual(280);
    expect(output.endsWith('…')).toBe(true);
    expect(output).not.toContain('user-frie');
    expect(output).toContain('more effective and');
  });

  it('falls back to a clean title without cutting words mid-token', () => {
    const longTitle = 'Promptfoo prompt optimization workflow for evaluators and AI teams building reliable prompt testing pipelines across multiple model vendors';
    const output = generateFallbackDescription({ title: longTitle.repeat(3) });

    expect(output.length).toBeLessThanOrEqual(280);
    expect(output.endsWith('…')).toBe(true);
    expect(output).not.toMatch(/\S+\.\.\.$/);
  });
});
