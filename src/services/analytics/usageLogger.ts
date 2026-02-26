import { getSQLiteClient } from '@/services/database/sqlite-client';
import { calculateCost, getModelPricing } from './pricing';

type Provider = 'openai' | 'anthropic';

export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
}

export interface AiUsageLogInput {
  feature: string;
  provider: Provider;
  modelId: string;
  usage: NormalizedUsage;
  metadata?: Record<string, unknown>;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractUsageObject(source: any): any {
  if (!source || typeof source !== 'object') return null;
  if (source.usage && typeof source.usage === 'object') return source.usage;
  return source;
}

export function normalizeUsageFromAiSdk(responseLike: any): NormalizedUsage | null {
  const usage = extractUsageObject(responseLike);
  if (!usage) return null;

  const inputTokens =
    toNumber(usage.inputTokens) ??
    toNumber(usage.promptTokens) ??
    toNumber(usage.prompt_tokens);
  const outputTokens =
    toNumber(usage.outputTokens) ??
    toNumber(usage.completionTokens) ??
    toNumber(usage.completion_tokens);
  const totalTokens =
    toNumber(usage.totalTokens) ??
    toNumber(usage.total_tokens) ??
    ((inputTokens ?? 0) + (outputTokens ?? 0));
  const cacheReadTokens =
    toNumber(usage.cachedInputTokens) ??
    toNumber(usage.cacheReadTokens) ??
    toNumber(usage.cache_read_tokens);
  const cacheWriteTokens =
    toNumber(usage.cacheWriteTokens) ??
    toNumber(usage.cache_write_tokens);

  if (!inputTokens && !outputTokens && !totalTokens) return null;

  return {
    inputTokens: inputTokens ?? Math.max((totalTokens ?? 0) - (outputTokens ?? 0), 0),
    outputTokens: outputTokens ?? 0,
    totalTokens: totalTokens ?? 0,
    cacheReadTokens,
    cacheWriteTokens,
  };
}

export function normalizeUsageFromOpenAI(responseUsage: any): NormalizedUsage | null {
  if (!responseUsage || typeof responseUsage !== 'object') return null;
  const inputTokens =
    toNumber(responseUsage.prompt_tokens) ??
    toNumber(responseUsage.input_tokens) ??
    toNumber(responseUsage.inputTokens);
  const outputTokens =
    toNumber(responseUsage.completion_tokens) ??
    toNumber(responseUsage.output_tokens) ??
    toNumber(responseUsage.outputTokens);
  const totalTokens =
    toNumber(responseUsage.total_tokens) ??
    toNumber(responseUsage.totalTokens) ??
    ((inputTokens ?? 0) + (outputTokens ?? 0));

  if (!inputTokens && !outputTokens && !totalTokens) return null;

  return {
    inputTokens: inputTokens ?? Math.max((totalTokens ?? 0) - (outputTokens ?? 0), 0),
    outputTokens: outputTokens ?? 0,
    totalTokens: totalTokens ?? 0,
  };
}

export function logAiUsage(input: AiUsageLogInput): void {
  try {
    const sqlite = getSQLiteClient();
    const now = new Date().toISOString();
    const hasPricing = Boolean(getModelPricing(input.modelId));
    const cost = hasPricing
      ? calculateCost({
          modelId: input.modelId,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          cacheReadTokens: input.usage.cacheReadTokens,
          cacheWriteTokens: input.usage.cacheWriteTokens,
        }).totalCostUsd
      : null;

    sqlite.query(
      `
      INSERT INTO ai_usage (
        created_at, feature, provider, model, input_tokens, output_tokens, total_tokens,
        cache_write_tokens, cache_read_tokens, estimated_cost_usd, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        now,
        input.feature,
        input.provider,
        input.modelId,
        input.usage.inputTokens,
        input.usage.outputTokens,
        input.usage.totalTokens,
        input.usage.cacheWriteTokens ?? null,
        input.usage.cacheReadTokens ?? null,
        cost,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );
  } catch (error) {
    console.warn('[usage] Failed to log AI usage:', error);
  }
}
