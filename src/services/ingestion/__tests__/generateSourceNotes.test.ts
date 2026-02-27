import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  generateTextMock,
  openaiMock,
  logAiUsageMock,
  normalizeUsageMock,
} = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  openaiMock: vi.fn(() => 'mock-model'),
  logAiUsageMock: vi.fn(),
  normalizeUsageMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: generateTextMock,
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: openaiMock,
}));

vi.mock('@/config/openaiModels', () => ({
  getOpenAIChatModel: () => 'gpt-4o-mini',
}));

vi.mock('@/services/analytics/usageLogger', () => ({
  logAiUsage: logAiUsageMock,
  normalizeUsageFromAiSdk: normalizeUsageMock,
}));

import { generateSourceNotes } from '@/services/ingestion/generateSourceNotes';

describe('generateSourceNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    normalizeUsageMock.mockReturnValue(null);
  });

  it('returns source-grounded notes from the full source text', async () => {
    generateTextMock.mockResolvedValue({
      text: 'This episode argues that compromise is a practical skill and outlines where it breaks down.',
    });

    const result = await generateSourceNotes({
      title: 'Have We All Lost Our Ability to Compromise?',
      sourceType: 'podcast',
      sourceText: `00:00:00\n${'Long transcript content here. '.repeat(20)}`,
      metadata: {
        podcast_name: 'No Stupid Questions',
      },
    });

    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(result).toBe(
      'This episode argues that compromise is a practical skill and outlines where it breaks down.',
    );
  });

  it('returns null when source text is too short to synthesize', async () => {
    const result = await generateSourceNotes({
      title: 'Tiny source',
      sourceType: 'podcast',
      sourceText: 'too short',
    });

    expect(generateTextMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
