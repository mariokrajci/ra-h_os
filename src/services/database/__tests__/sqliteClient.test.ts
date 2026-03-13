import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadExtensionMock,
  prepareMock,
  execMock,
  pragmaMock,
  transactionMock,
} = vi.hoisted(() => ({
  loadExtensionMock: vi.fn(),
  prepareMock: vi.fn(),
  execMock: vi.fn(),
  pragmaMock: vi.fn(),
  transactionMock: vi.fn((callback: () => unknown) => callback),
}));

vi.mock('better-sqlite3', () => {
  const DatabaseMock = vi.fn().mockImplementation(() => ({
    loadExtension: loadExtensionMock,
    prepare: prepareMock,
    exec: execMock,
    pragma: pragmaMock,
    transaction: transactionMock,
    close: vi.fn(),
  }));

  return {
    default: DatabaseMock,
  };
});

describe('SQLiteClient vector bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.DISABLE_EMBEDDINGS;
    delete process.env.SQLITE_READONLY;
    process.env.SQLITE_DB_PATH = ':memory:';

    loadExtensionMock.mockImplementation(() => {
      throw Object.assign(new Error('vec missing'), { code: 'SQLITE_ERROR' });
    });

    prepareMock.mockImplementation((sql: string) => ({
      get: vi.fn(() => {
        if (sql.includes('FROM vec_nodes') || sql.includes('FROM vec_chunks')) {
          throw Object.assign(new Error('no such module: vec0'), { code: 'SQLITE_ERROR' });
        }
        return undefined;
      }),
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
    }));
  });

  it('does not attempt vec table healing when the extension failed to load', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(import('@/services/database/sqlite-client')).resolves.toBeDefined();

    expect(loadExtensionMock).toHaveBeenCalledTimes(1);
    expect(prepareMock).not.toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as c FROM vec_nodes'));
    expect(prepareMock).not.toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as c FROM vec_chunks'));
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS edge_proposal_dismissals'));
    expect(warnSpy).toHaveBeenCalledWith('SQLite vector extension unavailable:', expect.any(Error));
    expect(errorSpy).not.toHaveBeenCalledWith('Warning: Failed to load vector extension:', expect.anything());
  });
});
