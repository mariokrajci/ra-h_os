import { describe, expect, test, vi } from 'vitest';

const ORIGINAL_ENV = process.env;

describe('openai model config', () => {
  test('returns defaults when env vars are missing', async () => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OPENAI_CHAT_MODEL;
    delete process.env.OPENAI_EMBEDDING_MODEL;

    const { getOpenAIChatModel, getOpenAIEmbeddingModel } = await import('@/config/openaiModels');

    expect(getOpenAIChatModel()).toBe('gpt-4o-mini');
    expect(getOpenAIEmbeddingModel()).toBe('text-embedding-3-small');
  });

  test('uses env overrides when provided', async () => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      OPENAI_CHAT_MODEL: 'gpt-5-mini',
      OPENAI_EMBEDDING_MODEL: 'text-embedding-3-large',
    };

    const { getOpenAIChatModel, getOpenAIEmbeddingModel } = await import('@/config/openaiModels');

    expect(getOpenAIChatModel()).toBe('gpt-5-mini');
    expect(getOpenAIEmbeddingModel()).toBe('text-embedding-3-large');
  });
});
