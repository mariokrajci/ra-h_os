import { describe, expect, it } from 'vitest';

import { extractPdfPrioritySections } from '@/services/ingestion/pdfSections';

describe('extractPdfPrioritySections', () => {
  it('extracts abstract, introduction, and conclusion from heading-based text', () => {
    const text = `Title

Abstract
This is the abstract.

1 Introduction
Intro body.

2 Methods
Methods body.

5 Conclusion
Conclusion body.`;

    const result = extractPdfPrioritySections(text);

    expect(result.sectionTitles).toEqual(['abstract', 'introduction', 'conclusion']);
    expect(result.text).toContain('This is the abstract.');
    expect(result.text).toContain('Intro body.');
    expect(result.text).toContain('Conclusion body.');
    expect(result.strategy).toBe('sections');
  });

  it('falls back to start and end slices when headings are not found', () => {
    const text = 'A'.repeat(15000) + ' middle ' + 'B'.repeat(15000);
    const result = extractPdfPrioritySections(text);

    expect(result.strategy).toBe('fallback');
    expect(result.text.length).toBeLessThan(text.length);
    expect(result.sectionTitles).toEqual([]);
  });

  it('falls back when only one target section is found', () => {
    const text = `Abstract
Only an abstract is present.

Body text without any other priority headings.`;

    const result = extractPdfPrioritySections(text);

    expect(result.strategy).toBe('fallback');
    expect(result.sectionTitles).toEqual([]);
  });

  it('extracts book-like priority sections and excludes table of contents content', () => {
    const text = `Table of Contents
Introduction 1
About This Book 2
Chapter 1: Surveying the World of Stock Investing 7
Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030 319
Appendix A: Resources for Stock Investors 327
Index 355

Introduction
Real introduction body.

About This Book
Real about-this-book body.

Chapter 1: Surveying the World of Stock Investing
Real first chapter body.

Appendix A: Resources for Stock Investors
Appendix content that should not be selected.

Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030
Real last chapter body.

Index
Index content that should not be selected.`;

    const result = extractPdfPrioritySections(text);

    expect(result.strategy).toBe('book_sections');
    expect(result.sectionTitles).toEqual([
      'Introduction',
      'About This Book',
      'Chapter 1: Surveying the World of Stock Investing',
      'Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030',
    ]);
    expect(result.text).toContain('Real introduction body.');
    expect(result.text).toContain('Real about-this-book body.');
    expect(result.text).toContain('Real first chapter body.');
    expect(result.text).toContain('Real last chapter body.');
    expect(result.text).not.toContain('Appendix content that should not be selected.');
    expect(result.text).not.toContain('Introduction 1');
  });
});
