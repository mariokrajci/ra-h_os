const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-4o-mini';
const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

function normalizeModelName(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getOpenAIChatModel(): string {
  return normalizeModelName(process.env.OPENAI_CHAT_MODEL) ?? DEFAULT_OPENAI_CHAT_MODEL;
}

export function getOpenAIEmbeddingModel(): string {
  return normalizeModelName(process.env.OPENAI_EMBEDDING_MODEL) ?? DEFAULT_OPENAI_EMBEDDING_MODEL;
}

