import { getSQLiteClient } from '@/services/database/sqlite-client';

export interface WikiTopic {
  id: number;
  title: string;
  parent_id: number | null;
  dimension: string | null;
  node_ids: number[];
  summary: string | null;
  article: string | null;
  article_status: 'none' | 'ready' | 'error';
  article_generated_at: string | null;
  order_index: number;
  generated_at: string | null;
}

export function getAllTopics(): WikiTopic[] {
  const rows = getSQLiteClient().prepare('SELECT * FROM wiki_topics ORDER BY order_index').all() as any[];
  return rows.map(deserializeWikiTopic);
}

export function getTopicById(id: number): WikiTopic | null {
  const row = getSQLiteClient().prepare('SELECT * FROM wiki_topics WHERE id = ?').get(id) as any;
  return row ? deserializeWikiTopic(row) : null;
}

export function upsertTopic(topic: Omit<WikiTopic, 'id'> & { id?: number }): number {
  const db = getSQLiteClient();

  if (topic.id) {
    db.prepare(`
      UPDATE wiki_topics
      SET title = ?, parent_id = ?, dimension = ?, node_ids = ?, summary = ?,
          article = ?, article_status = ?, article_generated_at = ?, order_index = ?, generated_at = ?
      WHERE id = ?
    `).run(
      topic.title,
      topic.parent_id,
      topic.dimension,
      JSON.stringify(topic.node_ids),
      topic.summary,
      topic.article,
      topic.article_status,
      topic.article_generated_at,
      topic.order_index,
      topic.generated_at,
      topic.id
    );
    return topic.id;
  }

  const result = db.prepare(`
    INSERT INTO wiki_topics (
      title, parent_id, dimension, node_ids, summary,
      article, article_status, article_generated_at, order_index, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    topic.title,
    topic.parent_id,
    topic.dimension,
    JSON.stringify(topic.node_ids),
    topic.summary,
    topic.article,
    topic.article_status,
    topic.article_generated_at,
    topic.order_index,
    topic.generated_at
  );

  return Number(result.lastInsertRowid);
}

export function updateArticle(topicId: number, article: string, status: 'ready' | 'error'): void {
  getSQLiteClient().prepare(`
    UPDATE wiki_topics
    SET article = ?, article_status = ?, article_generated_at = ?
    WHERE id = ?
  `).run(article, status, new Date().toISOString(), topicId);
}

export function clearAllTopics(): void {
  getSQLiteClient().prepare('DELETE FROM wiki_topics').run();
}

function deserializeWikiTopic(row: any): WikiTopic {
  return {
    id: Number(row.id),
    title: row.title,
    parent_id: row.parent_id === null ? null : Number(row.parent_id),
    dimension: row.dimension ?? null,
    node_ids: JSON.parse(row.node_ids || '[]') as number[],
    summary: row.summary ?? null,
    article: row.article ?? null,
    article_status: row.article_status ?? 'none',
    article_generated_at: row.article_generated_at ?? null,
    order_index: Number(row.order_index ?? 0),
    generated_at: row.generated_at ?? null,
  };
}
