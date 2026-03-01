import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationService } from '@/services/database/annotations';

const query = vi.fn();
const prepareRun = vi.fn();
const prepare = vi.fn(() => ({ run: prepareRun }));
const transaction = vi.fn((callback: () => unknown) => callback());

vi.mock('@/services/database/sqlite-client', () => ({
  getSQLiteClient: () => ({
    query,
    prepare,
    transaction,
  }),
}));

describe('AnnotationService', () => {
  beforeEach(() => {
    query.mockReset();
    prepare.mockClear();
    prepareRun.mockReset();
    transaction.mockClear();
  });

  it('reads notes inside the transaction before appending the annotation token', () => {
    query
      .mockReturnValueOnce({ rows: [{ notes: 'fresh notes' }] })
      .mockReturnValueOnce({
        rows: [{
          id: 42,
          node_id: 5,
          text: 'Selected text',
          color: 'yellow',
          comment: null,
          occurrence_index: 1,
          created_at: '2026-03-01T00:00:00.000Z',
        }],
      });

    prepareRun.mockReturnValueOnce({ lastInsertRowid: 42 });
    prepareRun.mockReturnValueOnce({ changes: 1 });

    const service = new AnnotationService();
    const annotation = service.createAnnotationWithNotes({
      node_id: 5,
      text: 'Selected text',
      color: 'yellow',
      comment: undefined,
      occurrence_index: 1,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(1, 'SELECT notes FROM nodes WHERE id = ?', [5]);
    expect(prepare).toHaveBeenNthCalledWith(2, "UPDATE nodes SET notes = ?, updated_at = datetime('now') WHERE id = ?");
    expect(prepareRun).toHaveBeenNthCalledWith(2, 'fresh notes\n\n[[annotation:42]]', 5);
    expect(annotation.id).toBe(42);
  });
});
