import { getSQLiteClient } from './sqlite-client';
import { LogEntry, LogEntryData } from '@/types/database';

export class LogService {
  createEntry(data: LogEntryData): LogEntry {
    const sqlite = getSQLiteClient();
    const result = sqlite.prepare(
      `INSERT INTO log_entries (date, content, order_idx) VALUES (?, ?, ?)`
    ).run(data.date, data.content, data.order_idx ?? 0);

    return this.getEntryById(Number(result.lastInsertRowid))!;
  }

  getEntryById(id: number): LogEntry | null {
    const sqlite = getSQLiteClient();
    const row = sqlite.prepare(
      `SELECT id, date, content, order_idx, promoted_node_id, created_at, updated_at
       FROM log_entries WHERE id = ?`
    ).get(id) as LogEntry | undefined;
    return row ?? null;
  }

  getEntriesByDate(date: string): LogEntry[] {
    const sqlite = getSQLiteClient();
    return sqlite.prepare(
      `SELECT id, date, content, order_idx, promoted_node_id, created_at, updated_at
       FROM log_entries WHERE date = ? ORDER BY order_idx ASC, created_at ASC`
    ).all(date) as LogEntry[];
  }

  getDatesWithEntries(): string[] {
    const sqlite = getSQLiteClient();
    const rows = sqlite.prepare(
      `SELECT DISTINCT date FROM log_entries ORDER BY date DESC`
    ).all() as Array<{ date: string }>;
    return rows.map(r => r.date);
  }

  updateEntry(id: number, content: string): void {
    const sqlite = getSQLiteClient();
    sqlite.prepare(
      `UPDATE log_entries SET content = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(content, id);
  }

  reorderEntry(id: number, order_idx: number): void {
    const sqlite = getSQLiteClient();
    sqlite.prepare(
      `UPDATE log_entries SET order_idx = ? WHERE id = ?`
    ).run(order_idx, id);
  }

  deleteEntry(id: number): void {
    const sqlite = getSQLiteClient();
    sqlite.prepare(`DELETE FROM log_entries WHERE id = ?`).run(id);
  }

  /**
   * Promote a log entry to a full node.
   * Creates a node with title = first line of content (truncated to 60 chars),
   * notes = full content. Sets promoted_node_id on the entry.
   * Returns the new node id.
   */
  promoteEntry(id: number): number {
    const sqlite = getSQLiteClient();

    return sqlite.transaction((): number => {
      const entry = this.getEntryById(id);
      if (!entry) throw new Error(`Log entry ${id} not found`);

      // Derive title from first line, strip leading bullet chars, truncate
      const firstLine = entry.content.split('\n')[0]
        .replace(/^[-*+]\s+/, '')
        .trim()
        .slice(0, 60);
      const title = firstLine || 'Untitled log entry';

      const result = sqlite.prepare(
        `INSERT INTO nodes (title, notes, created_at, updated_at)
         VALUES (?, ?, datetime('now'), datetime('now'))`
      ).run(title, entry.content);

      const nodeId = Number(result.lastInsertRowid);

      sqlite.prepare(
        `UPDATE log_entries SET promoted_node_id = ? WHERE id = ?`
      ).run(nodeId, id);

      return nodeId;
    });
  }

  searchEntries(query: string): LogEntry[] {
    const sqlite = getSQLiteClient();
    try {
      const rows = sqlite.prepare(
        `SELECT le.id, le.date, le.content, le.order_idx, le.promoted_node_id, le.created_at, le.updated_at
         FROM log_entries_fts fts
         JOIN log_entries le ON le.id = fts.rowid
         WHERE log_entries_fts MATCH ?
         ORDER BY le.date DESC`
      ).all(query) as LogEntry[];
      return rows;
    } catch {
      return [];
    }
  }
}

export const logService = new LogService();
