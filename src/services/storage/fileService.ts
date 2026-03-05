import crypto from 'crypto';
import fs from 'fs/promises';
import { getFilePath, getFilesDir, type StoredFileType } from './fileStorage';

export interface StoredFileDescriptor {
  path: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

function getMimeType(kind: StoredFileType): string {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'epub') return 'application/epub+zip';
  return 'image/jpeg';
}

class FileService {
  async save(
    nodeId: number,
    kind: StoredFileType,
    buffer: Buffer,
    options?: { mimeType?: string },
  ): Promise<StoredFileDescriptor> {
    const filesDir = getFilesDir();
    const finalPath = getFilePath(nodeId, kind);
    const tempPath = `${finalPath}.${Date.now()}.tmp`;

    await fs.mkdir(filesDir, { recursive: true });
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, finalPath);

    const stats = await fs.stat(finalPath);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      path: finalPath,
      mimeType: options?.mimeType || getMimeType(kind),
      sizeBytes: stats.size,
      sha256,
    };
  }

  async read(nodeId: number, kind: StoredFileType): Promise<Buffer> {
    return fs.readFile(getFilePath(nodeId, kind));
  }

  async readAtPath(storagePath: string): Promise<Buffer> {
    return fs.readFile(storagePath);
  }

  async exists(nodeId: number, kind: StoredFileType): Promise<boolean> {
    try {
      await fs.access(getFilePath(nodeId, kind));
      return true;
    } catch {
      return false;
    }
  }

  async existsAtPath(storagePath: string): Promise<boolean> {
    try {
      await fs.access(storagePath);
      return true;
    } catch {
      return false;
    }
  }

  async remove(nodeId: number, kind: StoredFileType): Promise<void> {
    try {
      await fs.unlink(getFilePath(nodeId, kind));
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

export const fileService = new FileService();
