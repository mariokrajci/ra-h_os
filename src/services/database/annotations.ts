import { getSQLiteClient } from './sqlite-client';
import { Annotation, AnnotationData } from '@/types/database';

export class AnnotationService {
  getAnnotationsForNode(nodeId: number): Annotation[] {
    const sqlite = getSQLiteClient();
    const result = sqlite.query<Annotation>(
      `SELECT id, node_id, text, color, comment, occurrence_index, source_mode, anchor_json, fallback_context, created_at
       FROM annotations WHERE node_id = ? ORDER BY created_at ASC`,
      [nodeId]
    );
    return result.rows.map(this.normalizeAnnotationRow);
  }

  getAnnotationById(id: number): Annotation | null {
    const sqlite = getSQLiteClient();
    const result = sqlite.query<Annotation>(
      `SELECT id, node_id, text, color, comment, occurrence_index, source_mode, anchor_json, fallback_context, created_at
       FROM annotations WHERE id = ?`,
      [id]
    );
    return result.rows[0] ? this.normalizeAnnotationRow(result.rows[0]) : null;
  }

  createAnnotationWithNotes(data: AnnotationData): Annotation {
    const sqlite = getSQLiteClient();
    return sqlite.transaction((): Annotation => {
      const notesRow = sqlite.query<{ notes: string | null }>(
        'SELECT notes FROM nodes WHERE id = ?',
        [data.node_id]
      );
      const currentNotes = notesRow.rows[0]?.notes ?? '';

      const insertResult = sqlite.prepare(
        `INSERT INTO annotations (
          node_id, text, color, comment, occurrence_index, source_mode, anchor_json, fallback_context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        data.node_id,
        data.text,
        data.color,
        data.comment ?? null,
        data.occurrence_index,
        data.source_mode ?? null,
        data.anchor ? JSON.stringify(data.anchor) : null,
        data.fallback_context ?? null,
      );

      const id = Number(insertResult.lastInsertRowid);
      const mirroredParts = [`[[annotation:${id}]]`, data.text];
      if (data.comment?.trim()) {
        mirroredParts.push(`(${data.comment.trim()})`);
      }
      const token = `\n\n${mirroredParts.join(' ')}`;

      sqlite.prepare(
        `UPDATE nodes SET notes = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(currentNotes + token, data.node_id);

      const row = sqlite.query<Annotation>(
        `SELECT id, node_id, text, color, comment, occurrence_index, source_mode, anchor_json, fallback_context, created_at
         FROM annotations WHERE id = ?`,
        [id],
      );
      return this.normalizeAnnotationRow(row.rows[0]);
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
          .replace(new RegExp(`\\n{0,2}\\[\\[annotation:${id}\\]\\][^\\n]*`, 'g'), '')
          .trimEnd();
        sqlite.prepare(
          `UPDATE nodes SET notes = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(cleaned, nodeId);
      }
    });
  }

  private normalizeAnnotationRow(row: Annotation & { anchor_json?: string | null }): Annotation {
    return {
      ...row,
      anchor: row.anchor_json ? JSON.parse(row.anchor_json) : null,
      fallback_context: row.fallback_context ?? null,
    };
  }
}

export const annotationService = new AnnotationService();
