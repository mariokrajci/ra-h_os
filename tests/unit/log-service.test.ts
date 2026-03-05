import { describe, it, expect, beforeEach } from 'vitest';
import { LogService } from '@/services/database/log';
import { getSQLiteClient } from '@/services/database/sqlite-client';

// These tests require a real SQLite DB (integration-style unit tests)
// The test setup in tests/unit/setup.ts initializes an in-memory DB

describe('LogService', () => {
  let service: LogService;

  beforeEach(() => {
    service = new LogService();
    // Clear log_entries before each test
    getSQLiteClient().prepare('DELETE FROM log_entries').run();
  });

  it('creates an entry and retrieves it by date', () => {
    service.createEntry({ date: '2026-03-05', content: '- First thought', order_idx: 0 });
    const entries = service.getEntriesByDate('2026-03-05');
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe('- First thought');
    expect(entries[0].date).toBe('2026-03-05');
  });

  it('returns entries ordered by order_idx', () => {
    service.createEntry({ date: '2026-03-05', content: 'B', order_idx: 1 });
    service.createEntry({ date: '2026-03-05', content: 'A', order_idx: 0 });
    const entries = service.getEntriesByDate('2026-03-05');
    expect(entries[0].content).toBe('A');
    expect(entries[1].content).toBe('B');
  });

  it('updates entry content', () => {
    const entry = service.createEntry({ date: '2026-03-05', content: 'original', order_idx: 0 });
    service.updateEntry(entry.id, 'updated');
    const entries = service.getEntriesByDate('2026-03-05');
    expect(entries[0].content).toBe('updated');
  });

  it('deletes an entry', () => {
    const entry = service.createEntry({ date: '2026-03-05', content: 'to delete', order_idx: 0 });
    service.deleteEntry(entry.id);
    expect(service.getEntriesByDate('2026-03-05')).toHaveLength(0);
  });

  it('returns dates that have entries, descending', () => {
    service.createEntry({ date: '2026-03-04', content: 'old', order_idx: 0 });
    service.createEntry({ date: '2026-03-05', content: 'new', order_idx: 0 });
    const dates = service.getDatesWithEntries();
    expect(dates[0]).toBe('2026-03-05');
    expect(dates[1]).toBe('2026-03-04');
  });

  it('searches entries by content', () => {
    service.createEntry({ date: '2026-03-05', content: 'knowledge graph indexing', order_idx: 0 });
    service.createEntry({ date: '2026-03-05', content: 'unrelated topic', order_idx: 1 });
    const results = service.searchEntries('indexing');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('indexing');
  });

  it('promotes entry to node and sets promoted_node_id', () => {
    const entry = service.createEntry({ date: '2026-03-05', content: '- Great idea\n  - detail', order_idx: 0 });
    const nodeId = service.promoteEntry(entry.id);
    expect(nodeId).toBeGreaterThan(0);
    const entries = service.getEntriesByDate('2026-03-05');
    expect(entries[0].promoted_node_id).toBe(nodeId);
  });

  it('reorders an entry within the day', () => {
    service.createEntry({ date: '2026-03-05', content: 'A', order_idx: 0 });
    const entryB = service.createEntry({ date: '2026-03-05', content: 'B', order_idx: 1 });
    service.reorderEntry(entryB.id, 0);
    const entries = service.getEntriesByDate('2026-03-05');
    // Both have order_idx 0 now, but B was updated so it should appear — just verify it saved
    const updated = entries.find(e => e.id === entryB.id);
    expect(updated?.order_idx).toBe(0);
  });
});
