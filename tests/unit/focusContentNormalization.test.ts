import { describe, expect, it } from 'vitest';
import { stripLeadingDuplicateTitle } from '@/components/focus/contentNormalization';

describe('stripLeadingDuplicateTitle', () => {
  it('removes a matching leading markdown heading', () => {
    const content = [
      '# RA-H OS Server Install Manual (Ubuntu, non-Docker)',
      '',
      'This guide documents the working setup.',
    ].join('\n');

    expect(stripLeadingDuplicateTitle(content, 'RA-H OS Server Install Manual (Ubuntu, non-Docker)'))
      .toBe('This guide documents the working setup.');
  });

  it('removes a matching leading plain-text title', () => {
    const content = [
      'RA-H OS Server Install Manual (Ubuntu, non-Docker)',
      '',
      'This guide documents the working setup.',
    ].join('\n');

    expect(stripLeadingDuplicateTitle(content, 'RA-H OS Server Install Manual (Ubuntu, non-Docker)'))
      .toBe('This guide documents the working setup.');
  });

  it('removes a matching setext heading', () => {
    const content = [
      'RA-H OS Server Install Manual (Ubuntu, non-Docker)',
      '===',
      '',
      'This guide documents the working setup.',
    ].join('\n');

    expect(stripLeadingDuplicateTitle(content, 'RA-H OS Server Install Manual (Ubuntu, non-Docker)'))
      .toBe('This guide documents the working setup.');
  });

  it('keeps content when the leading heading does not match the node title', () => {
    const content = [
      '# Different Heading',
      '',
      'This guide documents the working setup.',
    ].join('\n');

    expect(stripLeadingDuplicateTitle(content, 'RA-H OS Server Install Manual (Ubuntu, non-Docker)'))
      .toBe(content);
  });
});
