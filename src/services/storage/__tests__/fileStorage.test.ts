import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mkdirMock,
  writeFileMock,
  readFileMock,
  accessMock,
  homedirMock,
  platformMock,
} = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  readFileMock: vi.fn(),
  accessMock: vi.fn(),
  homedirMock: vi.fn(),
  platformMock: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
    access: accessMock,
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: homedirMock,
    platform: platformMock,
  },
}));

import {
  fileExists,
  getFilePath,
  getFilesDir,
  readFile,
  saveFile,
} from '../fileStorage';

describe('fileStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homedirMock.mockReturnValue('/Users/tester');
    platformMock.mockReturnValue('darwin');
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.from('stored'));
    accessMock.mockResolvedValue(undefined);
  });

  it('stores reader files under the app support files directory on macOS', () => {
    expect(getFilesDir()).toBe('/Users/tester/Library/Application Support/RA-H/files');
  });

  it('builds deterministic file paths by node id and file type', () => {
    expect(getFilePath(42, 'pdf')).toBe('/Users/tester/Library/Application Support/RA-H/files/42.pdf');
    expect(getFilePath(42, 'epub')).toBe('/Users/tester/Library/Application Support/RA-H/files/42.epub');
  });

  it('saves a source file to disk and returns the stored path', async () => {
    const storedPath = await saveFile(8, 'pdf', Buffer.from('pdf-data'));

    expect(mkdirMock).toHaveBeenCalledWith(
      '/Users/tester/Library/Application Support/RA-H/files',
      { recursive: true },
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      '/Users/tester/Library/Application Support/RA-H/files/8.pdf',
      Buffer.from('pdf-data'),
    );
    expect(storedPath).toBe('/Users/tester/Library/Application Support/RA-H/files/8.pdf');
  });

  it('reads a stored source file back from disk', async () => {
    const contents = await readFile(9, 'epub');

    expect(readFileMock).toHaveBeenCalledWith(
      '/Users/tester/Library/Application Support/RA-H/files/9.epub',
    );
    expect(contents).toEqual(Buffer.from('stored'));
  });

  it('reports whether a stored file exists', async () => {
    await expect(fileExists(10, 'pdf')).resolves.toBe(true);

    accessMock.mockRejectedValueOnce(new Error('ENOENT'));

    await expect(fileExists(11, 'epub')).resolves.toBe(false);
  });
});
