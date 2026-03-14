import { describe, expect, test } from 'vitest';
import { getMobileNotePreview } from '@/components/mobile/mobileNotesPresentation';

describe('getMobileNotePreview', () => {
  test('strips heading markers', () => {
    expect(getMobileNotePreview({ notes: '## Introduction\n\nHello' })).toBe('Introduction Hello');
  });
  test('strips bold markers', () => {
    expect(getMobileNotePreview({ notes: '**important** text' })).toBe('important text');
  });
  test('strips italic markers', () => {
    expect(getMobileNotePreview({ notes: '_emphasized_ word' })).toBe('emphasized word');
  });
  test('strips inline code', () => {
    expect(getMobileNotePreview({ notes: 'use `npm install` to install' })).toBe('use npm install to install');
  });
  test('strips link syntax, keeps text', () => {
    expect(getMobileNotePreview({ notes: 'see [this article](https://example.com) for more' }))
      .toBe('see this article for more');
  });
  test('strips list markers', () => {
    expect(getMobileNotePreview({ notes: '- first item\n- second item' })).toBe('first item second item');
  });
  test('truncates at 140 chars', () => {
    const long = 'a'.repeat(200);
    const result = getMobileNotePreview({ notes: long });
    expect(result.length).toBe(140);
    expect(result.endsWith('...')).toBe(true);
  });
  test('prefers description over notes', () => {
    expect(getMobileNotePreview({ description: 'desc', notes: 'notes' })).toBe('desc');
  });
  test('falls back to placeholder', () => {
    expect(getMobileNotePreview({})).toBe('No preview yet.');
  });
});
