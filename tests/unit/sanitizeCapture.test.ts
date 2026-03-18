import { describe, expect, it } from 'vitest';
import { sanitizeCapturedText, sanitizeCapturedTitle, sanitizeCapturedUrl } from '@/services/security/sanitizeCapture';

describe('sanitizeCapture', () => {
  it('removes dangerous html/script payloads from captured text', () => {
    const input = 'Hello <script>alert(1)</script> world <img src=x onerror="alert(2)">';
    const cleaned = sanitizeCapturedText(input);
    expect(cleaned).toBe('Hello  world <img src=x>');
  });

  it('neutralizes unsafe markdown link protocols', () => {
    const input = '[click](javascript:alert(1)) and [ok](https://example.com)';
    const cleaned = sanitizeCapturedText(input);
    expect(cleaned).toContain('[click](#)');
    expect(cleaned).toContain('[ok](https://example.com)');
  });

  it('accepts only http/https URLs', () => {
    expect(sanitizeCapturedUrl('https://example.com')).toBe('https://example.com/');
    expect(sanitizeCapturedUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('trims and bounds title text', () => {
    const cleaned = sanitizeCapturedTitle('   Example   title   ');
    expect(cleaned).toBe('Example title');
  });
});
