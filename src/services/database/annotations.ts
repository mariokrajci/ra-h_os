import { getSQLiteClient } from './sqlite-client';
import { Annotation, AnnotationData } from '@/types/database';

export class AnnotationService {
  getAnnotationsForNode(nodeId: number): Annotation[] {
    const sqlite = getSQLiteClient();
    const result = sqlite.query<Annotation>(
      `SELECT * FROM annotations WHERE node_id = ? ORDER BY created_at ASC`,
      [nodeId]
    );
    return result.rows;
  }

  getAnnotationById(id: number): Annotation | null {
    const sqlite = getSQLiteClient();
    const result = sqlite.query<Annotation>(
      `SELECT * FROM annotations WHERE id = ?`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  createAnnotationWithNotes(data: AnnotationData & { currentNotes: string }): Annotation {
    const sqlite = getSQLiteClient();
    // sqlite.transaction() takes a zero-arg callback and calls it immediately inside a DB transaction
    return sqlite.transaction((): Annotation => {
      const insertResult = sqlite.prepare(
        `INSERT INTO annotations (node_id, text, color, comment, occurrence_index) VALUES (?, ?, ?, ?, ?)`
      ).run(data.node_id, data.text, data.color, data.comment ?? null, data.occurrence_index);

      const id = Number(insertResult.lastInsertRowid);
      const token = `\n\n[[annotation:${id}]]`;

      sqlite.prepare(
        `UPDATE nodes SET notes = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(data.currentNotes + token, data.node_id);

      const row = sqlite.query<Annotation>(`SELECT * FROM annotations WHERE id = ?`, [id]);
      return row.rows[0];
    });
  }

  deleteAnnotationWithNotes(id: number, nodeId: number): void {
    const sqlite = getSQLiteClient();
    sqlite.transaction((): void => {
      sqlite.prepare(`DELETE FROM annotations WHERE id = ?`).run(id);

      const nodeRow = sqlite.query<{ notes: string | null }>(
        `SELECT notes FROM nodes WHERE id = ?`,
        [nodeId]
      );
      const currentNotes = nodeRow.rows[0]?.notes ?? '';
      if (currentNotes) {
        const cleaned = currentNotes
          .replace(new RegExp(`\\n{0,2}\\[\\[annotation:${id}\\]\\]`, 'g'), '')
          .trimEnd();
        sqlite.prepare(
          `UPDATE nodes SET notes = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(cleaned, nodeId);
      }
    });
  }
}

export const annotationService = new AnnotationService();
