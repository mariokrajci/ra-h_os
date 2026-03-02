import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface EpubMetadata {
  title?: string;
  author?: string;
  isbn?: string;
  text_length: number;
  chapter_count: number;
  extraction_method: string;
}

export interface EpubBufferExtractionResult {
  chunk: string;
  content: string;
  metadata: EpubMetadata;
  filename: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractEpubFromBuffer(
  buffer: Buffer,
  filename: string,
): Promise<EpubBufferExtractionResult> {
  const { EPub } = await import('epub2');
  const tempFile = path.join(os.tmpdir(), `rah-${Date.now()}-${filename.replace(/[^a-z0-9._-]/gi, '_')}`);

  await fs.writeFile(tempFile, buffer);

  try {
    const book = new EPub(tempFile);
    const parsed = await new Promise<{
      flow: Array<{ id?: string }>;
      metadata?: Record<string, string>;
    }>((resolve, reject) => {
      book.on('error', reject);
      book.on('end', () => resolve({
        flow: Array.isArray(book.flow) ? book.flow : [],
        metadata: (book.metadata ?? {}) as Record<string, string>,
      }));
      book.parse();
    });

    const chapters: string[] = [];
    for (const chapter of parsed.flow) {
      if (!chapter.id) continue;
      const html = await new Promise<string>((resolve, reject) => {
        book.getChapter(chapter.id!, (error: Error | null, text?: string) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(text ?? '');
        });
      });

      const cleaned = stripHtml(html);
      if (cleaned) {
        chapters.push(cleaned);
      }
    }

    const chunk = chapters.join('\n\n');
    return {
      chunk,
      content: `Imported EPUB: ${filename} (${chapters.length} chapters)`,
      filename,
      metadata: {
        title: parsed.metadata?.title,
        author: parsed.metadata?.creator,
        isbn: parsed.metadata?.ISBN,
        text_length: chunk.length,
        chapter_count: chapters.length,
        extraction_method: 'epub2',
      },
    };
  } finally {
    await fs.unlink(tempFile).catch(() => undefined);
  }
}
