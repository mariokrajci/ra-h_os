import OpenAI from 'openai';
import { getOpenAIEmbeddingModel } from '@/config/openaiModels';
import { logAiUsage, normalizeUsageFromOpenAI } from '@/services/analytics/usageLogger';

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add OPENAI_API_KEY to your .env.local file.');
  }
  return new OpenAI({ apiKey });
}

export class EmbeddingService {
  private static async generateEmbedding(input: string, feature: 'query_embedding' | 'node_embedding' | 'chunk_embedding'): Promise<number[]> {
    try {
      const openai = getOpenAiClient();
      const response = await openai.embeddings.create({
        model: getOpenAIEmbeddingModel(),
        input: input.trim(),
        encoding_format: "float"
      });
      const usage = normalizeUsageFromOpenAI(response.usage);
      if (usage) {
        logAiUsage({
          feature,
          provider: 'openai',
          modelId: getOpenAIEmbeddingModel(),
          usage,
        });
      }

      if (!response.data?.[0]?.embedding) {
        throw new Error('No embedding returned from OpenAI API');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embedding for a search query using OpenAI's text-embedding-3-small model
   * This matches the same model used in embed_universal.py for consistency
   */
  static async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateEmbedding(query, 'query_embedding');
  }

  static async generateContentEmbedding(input: string, feature: 'node_embedding' | 'chunk_embedding' = 'chunk_embedding'): Promise<number[]> {
    return this.generateEmbedding(input, feature);
  }

  /**
   * Validate embedding dimensions match expected size (1536 for text-embedding-3-small)
   */
  static validateEmbedding(embedding: number[]): boolean {
    return Array.isArray(embedding) && embedding.length === 1536;
  }
}
