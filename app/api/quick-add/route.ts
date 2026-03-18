import { NextRequest, NextResponse } from 'next/server';
import { enqueueQuickAdd, QuickAddMode } from '@/services/agents/quickAdd';
import { isReaderFormatValue } from '@/lib/readerFormat';
import { sanitizeCapturedText, sanitizeCapturedTitle, sanitizeCapturedUrl } from '@/services/security/sanitizeCapture';
import { getConfiguredExtensionToken } from '@/services/settings/extensionAuthSettings';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0]?.trim();
  return ip || request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(request: NextRequest): boolean {
  const key = getClientKey(request);
  const now = Date.now();
  const current = requestBuckets.get(key);
  if (!current || now > current.resetAt) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_MAX_REQUESTS;
}

function isAuthorizedExtensionRequest(request: NextRequest): boolean {
  const requireToken = process.env.RAOS_QUICK_ADD_REQUIRE_TOKEN === 'true';
  if (!requireToken) return true;
  const expected = process.env.RAOS_EXTENSION_TOKEN || getConfiguredExtensionToken();
  if (!expected) return false;
  const provided = request.headers.get('x-raos-extension-token');
  return provided === expected;
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 500_000) {
      return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 413 });
    }
    if (isRateLimited(request)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }
    if (!isAuthorizedExtensionRequest(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized extension request' }, { status: 401 });
    }

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

    if (typeof input !== 'string' || sanitizeCapturedText(input).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Input is required' },
        { status: 400 }
      );
    }

    const normalizedMode: QuickAddMode | undefined =
      mode === 'link' || mode === 'note' || mode === 'chat' ? mode : undefined;

    const normalizedInput = sanitizeCapturedText(input);
    const normalizedDescription: string | undefined =
      typeof description === 'string' && sanitizeCapturedText(description) ? sanitizeCapturedText(description) : undefined;
    const normalizedReaderFormat = isReaderFormatValue(readerFormat) ? readerFormat : undefined;
    const normalizedSourceUrl: string | undefined = typeof sourceUrl === 'string'
      ? sanitizeCapturedUrl(sourceUrl)
      : undefined;
    const normalizedSourceTitle: string | undefined = typeof sourceTitle === 'string'
      ? sanitizeCapturedTitle(sourceTitle)
      : undefined;
    const normalizedBookSelection = (() => {
      if (!bookSelection || typeof bookSelection !== 'object') return undefined;
      const selection = bookSelection as Record<string, unknown>;
      return {
        title: typeof selection.title === 'string' ? sanitizeCapturedTitle(selection.title) || '' : '',
        author: typeof selection.author === 'string' ? sanitizeCapturedTitle(selection.author) : undefined,
        isbn: typeof selection.isbn === 'string' ? selection.isbn.trim() : undefined,
        cover_url: typeof selection.cover_url === 'string' ? sanitizeCapturedUrl(selection.cover_url) : undefined,
        publisher: typeof selection.publisher === 'string' ? sanitizeCapturedTitle(selection.publisher) : undefined,
        first_published_year: typeof selection.first_published_year === 'number' ? selection.first_published_year : undefined,
        page_count: typeof selection.page_count === 'number' ? selection.page_count : undefined,
      };
    })();

    const delegation = await enqueueQuickAdd({
      rawInput: normalizedInput,
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
