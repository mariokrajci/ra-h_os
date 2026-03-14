export interface NodeMetadata {
  content_kind?: 'book';
  book_detection_status?: 'none' | 'detected' | 'confirmed';
  book_metadata_status?: 'pending' | 'matched' | 'ambiguous' | 'failed';
  book_match_confidence?: number;
  book_match_source?: 'isbn' | 'title_author' | 'title' | 'manual';
  book_match_candidates?: Array<{
    title: string;
    author?: string;
    isbn?: string;
    cover_url?: string;
    publisher?: string;
    first_published_year?: number;
    page_count?: number;
  }>;
  cover_source?: 'generated' | 'remote' | 'manual';
  book_metadata_locked?: {
    title?: boolean;
    author?: boolean;
    isbn?: boolean;
    cover?: boolean;
  };
  map_position?: {
    x: number;
    y: number;
  };
  type?: string;
  rss_feed_url?: string;
  episode_title?: string;
  podcast_name?: string;
  publisher_url?: string;
  episode_url?: string;
  transcript_status?: 'queued' | 'processing' | 'available' | 'unavailable';
  transcript_source?: string;
  transcript_url?: string;
  transcript_confidence?: 'high' | 'medium' | 'low';
  source_status?: 'pending' | 'processing' | 'available' | 'failed';
  notes_status?: 'pending' | 'processing' | 'available' | 'failed';
  notes_generation_strategy?: 'full' | 'truncated' | 'pdf_sections' | 'book_sections';
  notes_generation_sections?: string[];
  file_type?: 'pdf' | 'epub';
  file_path?: string;
  reading_progress?: {
    mode: 'pdf' | 'epub' | 'text';
    percent: number;
    last_read_at: string;
    page?: number;
    total_pages?: number;
    cfi?: string;
    scroll_percent?: number;
    current_section_id?: string;
  };
  fallback_sections?: Array<{
    id: string;
    title: string;
    char_start: number;
    char_end: number;
  }>;
  book_title?: string;
  book_author?: string;
  book_isbn?: string;
  book_publisher?: string;
  book_first_published_year?: number;
  book_page_count?: number;
  cover_url?: string;
  cover_remote_url?: string;
  cover_fetched_at?: string;
  [key: string]: unknown;
}

// New Node-based type system replacing rigid Item categorization
export interface Node {
  id: number;
  title: string;
  description?: string;
  notes?: string;             // User's notes/thoughts about this node
  link?: string;
  event_date?: string | null; // When the thing actually happened (ISO 8601)
  dimensions: string[];       // Flexible dimensions replacing type + stage + segment + tags
  embedding?: Buffer;         // Node-level embedding (BLOB data)
  chunk?: string;
  metadata?: NodeMetadata | null; // Flexible metadata storage
  created_at: string;
  updated_at: string;
  edge_count?: number;       // Derived count of edges, included in some queries

  // Optional embedding fields
  embedding_updated_at?: string;
  embedding_text?: string;
  chunk_status?: 'not_chunked' | 'chunking' | 'chunked' | 'error' | null;
}

export interface Chunk {
  id: number;
  node_id: number;           // Updated from item_id to node_id
  chunk_idx?: number;
  text: string;
  embedding?: number[];
  embedding_type: string;
  metadata?: any;            // Updated from extras to metadata
  created_at: string;
}

export interface Edge {
  id: number;
  from_node_id: number;
  to_node_id: number;
  context?: any;
  source: EdgeSource;
  created_at: string;
}

export type EdgeSource = 'user' | 'ai_similarity' | 'helper_name';

export type EdgeContextType =
  | 'created_by'   // Content → Creator (book by author, podcast by host)
  | 'part_of'      // Part → Whole (episode of podcast, person discussed in book)
  | 'source_of'    // Derivative → Source (insight from article)
  | 'related_to';  // Default — anything else or when unsure

export type EdgeCreatedVia = 'ui' | 'agent' | 'mcp' | 'workflow' | 'quicklink' | 'quick_capture_auto';

export interface EdgeContext {
  // SYSTEM-INFERRED (AI classifies from explanation + nodes)
  type: EdgeContextType;
  confidence: number;   // 0-1
  inferred_at: string;  // ISO timestamp

  // PROVIDED AT CREATION / EDIT
  explanation: string;

  // SYSTEM-MANAGED
  created_via: EdgeCreatedVia;
}

// New NodeFilters interface replacing rigid ItemFilters
export interface NodeFilters {
  dimensions?: string[];      // Filter by dimensions (replaces stage/type filtering)
  search?: string;           // Text search in title/content
  limit?: number;
  offset?: number;
  sortBy?: 'updated' | 'edges' | 'created' | 'event_date';  // Sort by updated_at, edge count, created_at, or event_date
  dimensionsMatch?: 'any' | 'all';  // 'any' = OR (default), 'all' = AND
  createdAfter?: string;     // ISO date (YYYY-MM-DD) — nodes created on or after
  createdBefore?: string;    // ISO date (YYYY-MM-DD) — nodes created before
  eventAfter?: string;       // ISO date (YYYY-MM-DD) — nodes with event_date on or after
  eventBefore?: string;      // ISO date (YYYY-MM-DD) — nodes with event_date before
}

export interface ChunkData {
  node_id: number;           // Updated from item_id
  chunk_idx?: number;
  text: string;
  embedding?: number[];
  embedding_type: string;
  metadata?: any;            // Updated from extras
}

export interface EdgeData {
  from_node_id: number;
  to_node_id: number;
  explanation: string;
  created_via: EdgeCreatedVia;
  source: EdgeSource;
  skip_inference?: boolean; // reserved for bulk imports / migrations
}

export interface ChatData {
  user_message?: string;
  assistant_message?: string;
  thread_id: string;
  focused_node_id?: number;  // Updated from focused_item_id
  metadata?: any;
  embedding?: number[];      // Renamed from content_embedding
}

// New NodeConnection interface
export interface NodeConnection {
  id: number;
  connected_node: Node;      // Updated from connected_item
  edge: Edge;
}

export interface DatabaseError {
  message: string;
  code?: string;
  details?: any;
}

// Dimension interface for dimension management
export interface Dimension {
  name: string;
  description?: string | null;
  icon?: string | null;
  is_priority: boolean;
  updated_at: string;
}

export interface Annotation {
  id: number;
  node_id: number;
  text: string;
  color: 'yellow' | 'red' | 'blue' | 'green';
  comment?: string | null;
  occurrence_index: number;
  source_mode?: 'pdf' | 'epub' | 'text';
  anchor?: Record<string, unknown> | null;
  fallback_context?: string | null;
  created_at: string;
}

export interface AnnotationData {
  node_id: number;
  text: string;
  color: 'yellow' | 'red' | 'blue' | 'green';
  comment?: string;
  occurrence_index: number;
  source_mode?: 'pdf' | 'epub' | 'text';
  anchor?: Record<string, unknown>;
  fallback_context?: string;
}

export interface LogEntry {
  id: number;
  date: string;                  // ISO date, e.g. '2026-03-05'
  content: string;               // markdown text
  order_idx: number;
  promoted_node_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface LogEntryData {
  date: string;
  content: string;
  order_idx?: number;
  promoted_node_id?: number | null;
}
