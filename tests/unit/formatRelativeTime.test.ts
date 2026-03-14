import { describe, expect, test } from 'vitest';
import { formatRelativeTime } from '@/components/mobile/formatRelativeTime';

describe('formatRelativeTime', () => {
  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }
  function hoursAgo(n: number) {
    return new Date(Date.now() - n * 3600_000).toISOString();
  }
  function minutesAgo(n: number) {
    return new Date(Date.now() - n * 60_000).toISOString();
  }
  function secondsAgo(n: number) {
    return new Date(Date.now() - n * 1000).toISOString();
  }

  test('just now for < 60s', () => {
    expect(formatRelativeTime(secondsAgo(30))).toBe('just now');
  });
  test('minutes for < 60min', () => {
    expect(formatRelativeTime(minutesAgo(5))).toBe('5m ago');
  });
  test('hours for < 24h', () => {
    expect(formatRelativeTime(hoursAgo(3))).toBe('3h ago');
  });
  test('Yesterday for ~1 day ago', () => {
    expect(formatRelativeTime(daysAgo(1))).toBe('Yesterday');
  });
  test('short month+day for older dates', () => {
    const old = new Date('2025-03-01T10:00:00Z').toISOString();
    const result = formatRelativeTime(old);
    // Should be a formatted date string like "Mar 1"
    expect(result).toMatch(/^[A-Z][a-z]+ \d+/);
  });
});
