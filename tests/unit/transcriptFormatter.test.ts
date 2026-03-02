import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TranscriptFormatter from '@/components/focus/source/formatters/TranscriptFormatter';

describe('TranscriptFormatter', () => {
  it('does not classify ordinary sentence openings as speaker labels', () => {
    const content = "00:00:00 Look at me! I'm a paragon of integrity.";
    const html = renderToStaticMarkup(
      React.createElement(TranscriptFormatter, {
        content,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('>Look at me! I&#x27;m a paragon of integrity.<');
    expect(html).not.toContain('font-weight:600');
  });

  it('keeps explicit speaker labels styled separately from transcript text', () => {
    const content = '00:00:23 Sam: I think I can be obnoxious in my desire to be right.';
    const html = renderToStaticMarkup(
      React.createElement(TranscriptFormatter, {
        content,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('>Sam: <');
    expect(html).toContain('font-weight:600');
    expect(html).toContain('>I think I can be obnoxious in my desire to be right.<');
  });

  it('renders transcript body text without serif font declarations', () => {
    const content = '00:00:23 Sam: I think I can be obnoxious in my desire to be right.';
    const html = renderToStaticMarkup(
      React.createElement(TranscriptFormatter, {
        content,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).not.toContain('Georgia');
    expect(html).not.toContain('Times New Roman');
  });
});
