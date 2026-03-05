import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mkdirMock,
  writeFileMock,
  renameMock,
  unlinkMock,
  readFileMock,
  accessMock,
  statMock,
  homedirMock,
  platformMock,
} = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  renameMock: vi.fn(),
  unlinkMock: vi.fn(),
  readFileMock: vi.fn(),
  accessMock: vi.fn(),
  statMock: vi.fn(),
  homedirMock: vi.fn(),
  platformMock: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    rename: renameMock,
    unlink: unlinkMock,
    readFile: readFileMock,
    access: accessMock,
    stat: statMock,
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: homedirMock,
    platform: platformMock,
  },
}));

import { fileService } from '../fileService';

describe('fileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homedirMock.mockReturnValue('/Users/tester');
    platformMock.mockReturnValue('darwin');
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from('pdf-data'));
    accessMock.mockResolvedValue(undefined);
    statMock.mockResolvedValue({ size: 8 });
  });

  it('saves using temp file + atomic rename and returns descriptor', async () => {
    const result = await fileService.save(42, 'pdf', Buffer.from('pdf-data'));

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      Buffer.from('pdf-data'),
    );
    expect(renameMock).toHaveBeenCalledTimes(1);
    expect(result.path.endsWith('/42.pdf')).toBe(true);
    expect(result.sizeBytes).toBe(8);
    expect(result.sha256.length).toBe(64);
  });

  it('reads existing file bytes', async () => {
    const contents = await fileService.read(1, 'epub');
    expect(contents).toEqual(Buffer.from('pdf-data'));
  });

  it('reports missing files', async () => {
    accessMock.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(fileService.exists(9, 'pdf')).resolves.toBe(false);
  });
});
