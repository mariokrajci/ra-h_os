import { NextRequest, NextResponse } from 'next/server';
import { enqueueQuickAdd, QuickAddMode } from '@/services/agents/quickAdd';
import { isReaderFormatValue } from '@/lib/readerFormat';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, mode, description, readerFormat, bookSelection, sourceUrl, sourceTitle, append } = body as {
      input?: unknown;
      mode?: unknown;
      description?: unknown;
      readerFormat?: unknown;
      bookSelection?: unknown;
      sourceUrl?: unknown;
      sourceTitle?: unknown;
      append?: unknown;
    };

    if (typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Input is required' },
        { status: 400 }
      );
    }

    const normalizedMode: QuickAddMode | undefined =
      mode === 'link' || mode === 'note' || mode === 'chat' ? mode : undefined;

    const normalizedDescription: string | undefined =
      typeof description === 'string' && description.trim() ? description.trim() : undefined;
    const normalizedReaderFormat = isReaderFormatValue(readerFormat) ? readerFormat : undefined;
    const normalizedSourceUrl: string | undefined =
      typeof sourceUrl === 'string' && sourceUrl.trim() ? sourceUrl.trim() : undefined;
    const normalizedSourceTitle: string | undefined =
      typeof sourceTitle === 'string' && sourceTitle.trim() ? sourceTitle.trim() : undefined;
    const normalizedBookSelection = (() => {
      if (!bookSelection || typeof bookSelection !== 'object') return undefined;
      const selection = bookSelection as Record<string, unknown>;
      return {
        title: typeof selection.title === 'string' ? selection.title.trim() : '',
        author: typeof selection.author === 'string' ? selection.author.trim() : undefined,
        isbn: typeof selection.isbn === 'string' ? selection.isbn.trim() : undefined,
        cover_url: typeof selection.cover_url === 'string' ? selection.cover_url.trim() : undefined,
        publisher: typeof selection.publisher === 'string' ? selection.publisher.trim() : undefined,
        first_published_year: typeof selection.first_published_year === 'number' ? selection.first_published_year : undefined,
        page_count: typeof selection.page_count === 'number' ? selection.page_count : undefined,
      };
    })();

    const delegation = await enqueueQuickAdd({
      rawInput: input.trim(),
      mode: normalizedMode,
      description: normalizedDescription,
      readerFormat: normalizedReaderFormat,
      baseUrl: request.nextUrl.origin,
      bookSelection: normalizedBookSelection?.title ? normalizedBookSelection : undefined,
      sourceUrl: normalizedSourceUrl,
      sourceTitle: normalizedSourceTitle,
      append: append === true,
    });

    return NextResponse.json({ success: true, delegation });
  } catch (error) {
    console.error('[Quick Add API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
