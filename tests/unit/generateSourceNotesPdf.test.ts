import { describe, expect, it, vi } from 'vitest';

const {
  generateTextMock,
  openaiMock,
  logAiUsageMock,
  normalizeUsageMock,
} = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  openaiMock: vi.fn(() => 'mock-model'),
  logAiUsageMock: vi.fn(),
  normalizeUsageMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: generateTextMock,
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: openaiMock,
}));

vi.mock('@/config/openaiModels', () => ({
  getOpenAIChatModel: () => 'gpt-4o-mini',
}));

vi.mock('@/services/analytics/usageLogger', () => ({
  logAiUsage: logAiUsageMock,
  normalizeUsageFromAiSdk: normalizeUsageMock,
}));

import { buildSourceNotesInput } from '@/services/ingestion/generateSourceNotes';

describe('buildSourceNotesInput', () => {
  it('uses section extraction for large PDFs', () => {
    const text =
      `Table of Contents
Introduction 1
About This Book 2
Chapter 1: Surveying the World of Stock Investing 7
Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030 319

Introduction
Intro body

About This Book
About body

Chapter 1: Surveying the World of Stock Investing
First chapter body

Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030
Last chapter body
` + 'x'.repeat(120000);

    const result = buildSourceNotesInput({
      title: 'Large PDF',
      sourceType: 'pdf',
      sourceText: text,
      metadata: {},
    });

    expect(result.strategy).toBe('book_sections');
    expect(result.sectionTitles).toEqual([
      'Introduction',
      'About This Book',
      'Chapter 1: Surveying the World of Stock Investing',
      'Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030',
    ]);
    expect(result.sourceExcerpt).toContain('Intro body');
    expect(result.sourceExcerpt).toContain('About body');
    expect(result.sourceExcerpt).toContain('First chapter body');
    expect(result.sourceExcerpt).toContain('Last chapter body');
  });

  it('uses book sections for merged heading text shaped like a real PDF chunk', () => {
    const text =
      `Table of Contents INTRODUCTION 1 About This Book 2 Chapter 1: Surveying the World of Stock Investing 7 Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030 319

Introduction 1 Introduction I am thrilled that you have the 6th edition of Stock Investing For Dummies, and it is a privilege once again to be the author.

2 Stock Investing For Dummies About This Book The stock market has been a cornerstone of the investor's passive wealth-building program for over a century and continues in this role.

CHAPTER 1 Surveying the World of Stock Investing 7 Chapter 1 Surveying the World of Stock Investing A s I write this, the stock market is near an all-time high.

CHAPTER 25 Ten Investing Pitfalls and Challenges for 2020–2030 319 Trillion-Dollar Pension Shortfalls 319 European Crises 320 The Bond and Debt Bubble 320.

APPENDIX A Resources for Stock Investors 327 Appendix A Resources for Stock Investors Getting and staying informed are ongoing priorities for stock investors.
` + 'x'.repeat(120000);

    const result = buildSourceNotesInput({
      title: 'Large Book PDF',
      sourceType: 'pdf',
      sourceText: text,
      metadata: {},
    });

    expect(result.strategy).toBe('book_sections');
    expect(result.sectionTitles).toEqual([
      'Introduction',
      'About This Book',
      'Chapter 1: Surveying the World of Stock Investing',
      'Chapter 25: Ten Investing Pitfalls and Challenges for 2020–2030',
    ]);
  });
});
