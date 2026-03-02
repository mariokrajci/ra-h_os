import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export type StoredFileType = 'pdf' | 'epub';

export function getFilesDir(): string {
  if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'RA-H', 'files');
  }

  return path.join(os.homedir(), '.local', 'share', 'RA-H', 'files');
}

export function getFilePath(nodeId: number, fileType: StoredFileType): string {
  return path.join(getFilesDir(), `${nodeId}.${fileType}`);
}

export async function saveFile(
  nodeId: number,
  fileType: StoredFileType,
  buffer: Buffer,
): Promise<string> {
  const filesDir = getFilesDir();
  const filePath = getFilePath(nodeId, fileType);

  await fs.mkdir(filesDir, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return filePath;
}

export async function readFile(nodeId: number, fileType: StoredFileType): Promise<Buffer> {
  return fs.readFile(getFilePath(nodeId, fileType));
}

export async function fileExists(nodeId: number, fileType: StoredFileType): Promise<boolean> {
  try {
    await fs.access(getFilePath(nodeId, fileType));
    return true;
  } catch {
    return false;
  }
}
