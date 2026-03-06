import { NextRequest, NextResponse } from 'next/server';
import { createOpenLibraryBookLookupProvider, lookupBookMetadata } from '@/services/ingestion/bookLookup';

export const runtime = 'nodejs';

const provider = createOpenLibraryBookLookupProvider();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : undefined;
    const author = typeof body?.author === 'string' ? body.author.trim() : undefined;
    const isbn = typeof body?.isbn === 'string' ? body.isbn.trim() : undefined;

    if (!title && !isbn) {
      return NextResponse.json({ success: false, error: 'Title or ISBN is required' }, { status: 400 });
    }

    const lookup = await lookupBookMetadata({ title, author, isbn }, provider);
    const candidates = (lookup.candidates && lookup.candidates.length > 0
      ? lookup.candidates
      : (lookup.candidate ? [lookup.candidate] : []))
      .map((candidate) => ({
        title: candidate.title,
        author: candidate.author,
        isbn: candidate.isbn,
        cover_url: candidate.coverUrl,
        confidence: candidate.confidence,
      }));

    return NextResponse.json({
      success: true,
      status: lookup.status,
      matchSource: lookup.matchSource,
      confidence: lookup.confidence,
      candidates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lookup book matches',
      },
      { status: 500 },
    );
  }
}
