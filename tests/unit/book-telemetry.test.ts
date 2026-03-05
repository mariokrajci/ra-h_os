import { afterEach, describe, expect, it, vi } from 'vitest';

import { logBookTelemetry } from '@/services/analytics/bookTelemetry';

describe('logBookTelemetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes structured telemetry to console without throwing', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    expect(() => logBookTelemetry('command_handled', { command: 'book' })).not.toThrow();
    expect(infoSpy).toHaveBeenCalledWith('[book-telemetry] command_handled', { command: 'book' });
  });

  it('swallows logger failures to avoid product flow breaks', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('logger unavailable');
    });

    expect(() => logBookTelemetry('book_enrichment_failed', { nodeId: 42 })).not.toThrow();
  });
});
