import { getSQLiteClient } from './sqlite-client';
import { Flag, NodeFlag } from '@/types/database';

export const flagService = {
  getAllFlags(): Flag[] {
    const sqlite = getSQLiteClient();
    return sqlite.query<Flag>('SELECT name, color, created_at FROM flags ORDER BY name', []).rows;
  },

  createFlag(name: string, color: string): Flag {
    const sqlite = getSQLiteClient();
    sqlite.query(
      `INSERT INTO flags (name, color) VALUES (?, ?) ON CONFLICT(name) DO NOTHING`,
      [name.trim(), color]
    );
    return { name: name.trim(), color, created_at: new Date().toISOString() };
  },

  deleteFlag(name: string): boolean {
    const sqlite = getSQLiteClient();
    const result = sqlite.query('DELETE FROM flags WHERE name = ?', [name]);
    return (result.changes ?? 0) > 0;
  },

  getNodeFlags(nodeId: number): string[] {
    const sqlite = getSQLiteClient();
    const rows = sqlite.query<{ flag: string }>(
      'SELECT flag FROM node_flags WHERE node_id = ? ORDER BY created_at',
      [nodeId]
    ).rows;
    return rows.map(r => r.flag);
  },

  assignFlag(nodeId: number, flag: string): void {
    const sqlite = getSQLiteClient();
    sqlite.query(
      `INSERT INTO node_flags (node_id, flag) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [nodeId, flag]
    );
  },

  removeFlag(nodeId: number, flag: string): boolean {
    const sqlite = getSQLiteClient();
    const result = sqlite.query(
      'DELETE FROM node_flags WHERE node_id = ? AND flag = ?',
      [nodeId, flag]
    );
    return (result.changes ?? 0) > 0;
  },

  countNodesWithFlag(flag: string): number {
    const sqlite = getSQLiteClient();
    return sqlite.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM node_flags WHERE flag = ?',
      [flag]
    ).rows[0]?.count ?? 0;
  },
};
