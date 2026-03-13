import { NextResponse } from 'next/server';
import { getSQLiteClient } from '@/services/database/sqlite-client';
import { chunkService } from '@/services/database/chunks';
import { getVectorStoreAdapter } from '@/services/vector-store';

interface ChunkStats {
  total_chunks: number;
  vectorized_chunks: number;
  missing_embeddings: number;
  coverage_percentage: number;
}

interface VectorStats {
  provider?: string;
  vec_chunks_count?: number;
  matches_chunk_embeddings?: boolean;
  error?: string;
  suggestion?: string;
}

export async function GET() {
  try {
    const sqlite = getSQLiteClient();
    
    // Test basic database connection
    const connectionTest = await sqlite.testConnection();
    if (!connectionTest) {
      return NextResponse.json({
        status: 'error',
        message: 'Database connection failed',
        details: null
      });
    }

    const adapterHealth = await getVectorStoreAdapter().health();
    const vectorExtensionTest = await sqlite.checkVectorExtension();
    
    let vectorStats: VectorStats | null = null;
    let chunkStats: ChunkStats | null = null;
    let vectorHealth = 'unknown';

    try {
      const totalChunks = await chunkService.getChunkCount();
      if (adapterHealth.ok) {
        try {
          const chunksWithoutEmbeddings = await chunkService.getChunksWithoutEmbeddings();
          const vectorizedCount = totalChunks - chunksWithoutEmbeddings.length;

          chunkStats = {
            total_chunks: totalChunks,
            vectorized_chunks: vectorizedCount,
            missing_embeddings: chunksWithoutEmbeddings.length,
            coverage_percentage: totalChunks > 0 ? Math.round((vectorizedCount / totalChunks) * 100) : 0,
          };

          const vecCount = Number(adapterHealth.details?.vec_chunks_count ?? 0);
          
          vectorStats = {
            provider: adapterHealth.provider,
            vec_chunks_count: vecCount,
            matches_chunk_embeddings: vecCount === vectorizedCount,
          };
          
          vectorHealth = vecCount === vectorizedCount ? 'healthy' : 'inconsistent';
        } catch (vecError) {
          const message = vecError instanceof Error ? vecError.message : 'Unknown vector health error';
          vectorHealth = 'corrupted';
          vectorStats = {
            provider: adapterHealth.provider,
            error: message,
            suggestion: 'Vector table may be corrupted and need recreation',
          };
        }
      } else {
        chunkStats = {
          total_chunks: totalChunks,
          vectorized_chunks: 0,
          missing_embeddings: totalChunks,
          coverage_percentage: 0,
        };
        vectorHealth = 'extension_unavailable';
      }

    } catch (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to collect vector statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return NextResponse.json({
      status: 'success',
      data: {
        database_connected: connectionTest,
        vector_provider: adapterHealth.provider,
        vector_extension_loaded: vectorExtensionTest,
        vector_health: vectorHealth,
        chunk_stats: chunkStats,
        vector_stats: vectorStats,
        recommendations: generateRecommendations(vectorHealth, chunkStats, vectorStats)
      }
    });

  } catch (error) {
    console.error('Vector health check failed:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function generateRecommendations(
  vectorHealth: string, 
  chunkStats: ChunkStats | null, 
  vectorStats: VectorStats | null
): string[] {
  const recommendations: string[] = [];

  if (vectorHealth === 'corrupted') {
    recommendations.push('Vector tables are corrupted - restart the application to trigger automatic healing');
  }

  if (vectorHealth === 'extension_unavailable') {
    recommendations.push('Vector extension not loaded - check sqlite-vec installation');
  }

  if (chunkStats && chunkStats.coverage_percentage < 95) {
    recommendations.push(`${chunkStats.missing_embeddings} chunks missing embeddings - consider running embedding generation`);
  }

  if (vectorStats && !vectorStats.matches_chunk_embeddings) {
    recommendations.push('Vector count does not match chunk embeddings - database inconsistency detected');
  }

  if (recommendations.length === 0) {
    recommendations.push('Vector search system is healthy');
  }

  return recommendations;
}
