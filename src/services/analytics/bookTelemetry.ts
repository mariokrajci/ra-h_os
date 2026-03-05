export type BookTelemetryEvent =
  | 'command_detected'
  | 'command_handled'
  | 'command_fallback_note'
  | 'book_enrichment_started'
  | 'book_enrichment_matched'
  | 'book_enrichment_ambiguous'
  | 'book_enrichment_failed'
  | 'book_match_confirmed_manual';

export function logBookTelemetry(event: BookTelemetryEvent, metadata: Record<string, unknown> = {}): void {
  try {
    console.info(`[book-telemetry] ${event}`, metadata);
  } catch {
    // telemetry failures must never block product flows
  }
}
