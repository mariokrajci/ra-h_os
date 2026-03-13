/**
 * Node metadata embedding service for RA-H knowledge management system
 * Embeds node metadata (title, content, dimensions) into nodes.embedding field
 */

import { 
  createDatabaseConnection, 
  serializeFloat32Vector,
  formatEmbeddingText,
  batchProcess
} from './sqlite-vec';
import { EmbeddingService } from '@/services/embeddings';
import { getVectorStoreAdapter } from '@/services/vector-store';

interface NodeRecord {
  id: number;
  title: string;
  notes: string | null;
  description: string | null;
  dimensions_json: string;
  embedding?: Buffer | null;
  embedding_updated_at?: string | null;
  embedding_text?: string | null;
}

interface EmbedNodeOptions {
  nodeId?: number;
  forceReEmbed?: boolean;
  verbose?: boolean;
}

export class NodeEmbedder {
  private db: ReturnType<typeof createDatabaseConnection>;
  private processedCount: number = 0;
  private failedCount: number = 0;

  constructor() {
    this.db = createDatabaseConnection();
  }

  /**
   * Embed a single node
   */
  private async embedNode(node: NodeRecord, forceReEmbed: boolean = false): Promise<void> {
    // Skip if already embedded and not forcing
    if (node.embedding && !forceReEmbed) {
      console.log(`Skipping node ${node.id} - already has embedding`);
      return;
    }

    // Parse dimensions from JSON string
    const dimensions = node.dimensions_json ? JSON.parse(node.dimensions_json) : [];
    
    // Create base embedding text
    const embeddingText = formatEmbeddingText(
      node.title,
      node.notes || '',
      dimensions,
      node.description
    );

    try {
      // Generate embedding
      const embedding = await EmbeddingService.generateContentEmbedding(embeddingText, 'node_embedding');
      const embeddingBlob = serializeFloat32Vector(embedding);
      
      // Update database
      const updateStmt = this.db.prepare(`
        UPDATE nodes 
        SET embedding = ?, 
            embedding_updated_at = ?, 
            embedding_text = ?
        WHERE id = ?
      `);
      
      const now = new Date().toISOString();
      updateStmt.run(embeddingBlob, now, embeddingText, node.id);
      
      // Update vec_nodes virtual table
      try {
        await getVectorStoreAdapter().upsertNodeVector({
          itemId: node.id,
          vector: embedding,
          metadata: { title: node.title },
        });
      } catch (vecError) {
        console.warn(`Could not update vec_nodes for node ${node.id}:`, vecError);
        // Continue - main embedding is still saved
      }
      
      this.processedCount++;
      console.log(`✓ Embedded node ${node.id}: "${node.title}"`);
      
    } catch (error) {
      this.failedCount++;
      console.error(`✗ Failed to embed node ${node.id}:`, error);
      throw error;
    }
  }

  /**
   * Embed nodes based on options
   */
  async embedNodes(options: EmbedNodeOptions = {}): Promise<{ processed: number; failed: number; firstError?: string }> {
    const { nodeId, forceReEmbed = false, verbose = false } = options;
    let firstError: string | undefined;
    
    let query: string;
    let params: any[] = [];
    
    if (nodeId) {
      // Single node
      query = `
        SELECT n.id, n.title, n.notes, n.description,
               COALESCE((SELECT JSON_GROUP_ARRAY(d.dimension)
                        FROM node_dimensions d WHERE d.node_id = n.id), '[]') as dimensions_json,
               n.embedding, n.embedding_updated_at
        FROM nodes n
        WHERE n.id = ?
      `;
      params = [nodeId];
    } else if (forceReEmbed) {
      // All nodes
      query = `
        SELECT n.id, n.title, n.notes, n.description,
               COALESCE((SELECT JSON_GROUP_ARRAY(d.dimension)
                        FROM node_dimensions d WHERE d.node_id = n.id), '[]') as dimensions_json,
               n.embedding, n.embedding_updated_at
        FROM nodes n
        ORDER BY n.id
      `;
    } else {
      // Only nodes without embeddings
      query = `
        SELECT n.id, n.title, n.notes, n.description,
               COALESCE((SELECT JSON_GROUP_ARRAY(d.dimension)
                        FROM node_dimensions d WHERE d.node_id = n.id), '[]') as dimensions_json,
               n.embedding, n.embedding_updated_at
        FROM nodes n
        WHERE n.embedding IS NULL OR n.embedding_updated_at IS NULL
        ORDER BY n.id
      `;
    }
    
    const stmt = this.db.prepare(query);
    const nodes = stmt.all(...params) as NodeRecord[];
    
    if (nodes.length === 0) {
      console.log('No nodes to process');
      return { processed: 0, failed: 0 };
    }
    
    console.log(`Processing ${nodes.length} nodes...`);
    
    // Process in batches
    await batchProcess(
      nodes,
      async (node) => {
        try {
          await this.embedNode(node, forceReEmbed);
        } catch (error) {
          // Error already logged in embedNode
          if (!firstError) {
            firstError = error instanceof Error ? error.message : String(error);
          }
        }
      },
      5, // Batch size
      verbose ? (processed, total) => {
        console.log(`Progress: ${processed}/${total} nodes`);
      } : undefined
    );
    
    console.log(`\nComplete! Processed: ${this.processedCount}, Failed: ${this.failedCount}`);
    
    return {
      processed: this.processedCount,
      failed: this.failedCount,
      firstError
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * CLI interface for direct execution
 */
export async function runCLI(args: string[]): Promise<void> {
  const nodeId = args.includes('--node-id') 
    ? parseInt(args[args.indexOf('--node-id') + 1])
    : undefined;
  
  const forceReEmbed = args.includes('--force');
  const verbose = args.includes('--verbose');
  
  const embedder = new NodeEmbedder();
  
  try {
    await embedder.embedNodes({ nodeId, forceReEmbed, verbose });
  } finally {
    embedder.close();
  }
}

// Run if called directly (for testing)
if (require.main === module) {
  runCLI(process.argv.slice(2)).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
