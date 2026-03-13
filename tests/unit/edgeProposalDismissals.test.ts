import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runMock, allMock, getSQLiteClientMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  allMock: vi.fn(),
  getSQLiteClientMock: vi.fn(),
}));

vi.mock('@/services/database/sqlite-client', () => ({
  getSQLiteClient: getSQLiteClientMock,
}));

import { proposalDismissalService } from '@/services/edges/proposalDismissals';

describe('proposal dismissal service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSQLiteClientMock.mockReturnValue({
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT target_node_id')) {
          return { all: allMock };
        }
        return { run: runMock };
      }),
    });
  });

  it('saves a dismissal for a source-target pair', async () => {
    runMock.mockReturnValue({ changes: 1 });

    await proposalDismissalService.dismissProposal(3, 9);

    expect(runMock).toHaveBeenCalledWith(3, 9);
  });

  it('returns dismissed target ids for a source note', async () => {
    allMock.mockReturnValue([{ target_node_id: 4 }, { target_node_id: 7 }]);

    const dismissed = await proposalDismissalService.getDismissedTargetIds(12);

    expect(dismissed).toEqual(new Set([4, 7]));
  });

  it('upserts duplicate dismissals instead of requiring a new row', async () => {
    runMock.mockReturnValue({ changes: 1 });

    await proposalDismissalService.dismissProposal(5, 8);

    const sql = getSQLiteClientMock.mock.results[0].value.prepare.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT(source_node_id, target_node_id)');
  });
});
