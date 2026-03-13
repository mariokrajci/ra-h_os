import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const focusPanel = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/FocusPanel.tsx'), 'utf8');
const markdownWithNodeTokens = fs.readFileSync(path.join(process.cwd(), 'src/components/helpers/MarkdownWithNodeTokens.tsx'), 'utf8');
const readerStyles = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/source/readerStyles.ts'), 'utf8');
const sourceReader = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/source/SourceReader.tsx'), 'utf8');
const markdownFormatter = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/source/formatters/MarkdownFormatter.tsx'), 'utf8');
const mappedMarkdownRenderer = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/source/MappedMarkdownRenderer.tsx'), 'utf8');
const mappedHighlightedCodeBlock = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/source/MappedHighlightedCodeBlock.tsx'), 'utf8');
const shikiHighlighting = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/source/shikiHighlighting.ts'), 'utf8');
const docsModal = fs.readFileSync(path.join(process.cwd(), 'src/components/docs/DocsModal.tsx'), 'utf8');

describe('focus theming', () => {
  it('uses theme tokens for the tab bar and markdown text rendering', () => {
    expect(focusPanel).toContain('var(--app-text)');
    expect(focusPanel).toContain('var(--app-text-muted)');
    expect(focusPanel).toContain('var(--app-border)');
    expect(focusPanel).toContain('var(--app-accent-contrast)');
    expect(focusPanel).toContain('var(--app-text-subtle)');
    expect(markdownWithNodeTokens).toContain('var(--app-text)');
    expect(markdownWithNodeTokens).toContain('var(--toolbar-accent)');
    expect(markdownWithNodeTokens).toContain('useAppTheme');
    expect(markdownWithNodeTokens).toContain('github');
    expect(readerStyles).toContain("var(--app-text)");
    expect(sourceReader).toContain('useAppTheme');
    expect(markdownFormatter).not.toContain("theme = 'dark'");
    expect(mappedMarkdownRenderer).toContain('palette.body');
    expect(mappedHighlightedCodeBlock).toContain('var(--app-panel)');
    expect(shikiHighlighting).toContain('themeName');
    expect(docsModal).toContain('MarkdownWithNodeTokens');
  });
});
