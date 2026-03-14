import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MappedMarkdownRenderer from '@/components/focus/source/MappedMarkdownRenderer';

describe('MappedMarkdownRenderer', () => {
  it('renders rich markdown elements with mapped source offsets', () => {
    const markdown = [
      '# Heading',
      '',
      'Paragraph with **bold** text, *italic* text, [link](https://example.com), and `inline code`.',
      '',
      '- Item one',
      '- Item two',
      '',
      '> Quoted line',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const value = 1;',
      '```',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('<h1');
    expect(html).toContain('<strong');
    expect(html).toContain('<em');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('<code');
    expect(html).toContain('Copy code');
    expect(html).toContain('<ul');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
    expect(html).toContain('data-source-start=');
    expect(html).toContain('data-source-end=');
    expect(html).toContain('Heading');
    expect(html).toContain('inline code');
    expect(html).toContain('data-source-start="180"');
    expect(html).toContain('data-source-end="196">const value = 1;');
  });

  it('renders copy affordance for fenced code blocks but not inline code', () => {
    const markdown = 'Inline `code` only.\n\n```js\nconsole.log(1)\n```';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html.match(/aria-label="Copy code"/g)?.length).toBe(1);
  });

  it('renders fenced code blocks with mapped source offsets', () => {
    const markdown = '```ts\nconst value = 1;\n```';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('data-source-start=');
    expect(html).toContain('language-typescript');
  });

  it('falls back to plain mapped code for unsupported languages', () => {
    const markdown = '```unknownlang\nconst value = 1;\n```';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).not.toContain('#c678dd');
    expect(html).toContain('const value = 1;');
    expect(html).toContain('data-source-start=');
  });

  it('applies persistent and active highlights to markdown text spans', () => {
    const markdown = 'Alpha **beta** gamma alpha beta';
    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [{ start: 6, end: 10, color: 'yellow', annotationId: 1 }],
        activeRange: { start: 17, end: 22 },
      })
    );

    expect(html).toContain('data-search-match="current"');
    expect(html).toContain('rgba(250, 204, 21, 0.42)');
    expect(html).toContain('rgba(245, 158, 11, 0.28)');
    expect(html).toContain('box-shadow:inset 0 -1px 0 rgba(180, 83, 9, 0.38)');
  });

  it('renders github-style html tables without leaking raw tags', () => {
    const markdown = [
      '<table>',
      '  <tr>',
      '    <td>[<code>gemini/</code>](gemini/)</td>',
      '    <td>Discover Gemini through starter notebooks.</td>',
      '  </tr>',
      '</table>',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('<table');
    expect(html).toContain('<a href="gemini/"');
    expect(html).toContain('<code');
    expect(html).not.toContain('&lt;td&gt;');
    expect(html).not.toContain('&lt;/td&gt;');
  });

  it('renders github task lists with checked and unchecked checkboxes', () => {
    const markdown = [
      '# Roadmap',
      '',
      '- [ ] Interactive agent selector web tool',
      '- [x] Multi-agent workflow examples',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain('Interactive agent selector web tool');
    expect(html).toContain('Multi-agent workflow examples');
  });

  it('renders embedded html ordered and unordered lists with their markers intact', () => {
    const markdown = [
      '<h1>🤝 Contributing</h1>',
      '<p>We welcome contributions! Here\'s how you can help:</p>',
      '<h2>Add a New Agent</h2>',
      '<ol>',
      '  <li>Fork the repository</li>',
      '  <li>Create a new agent file in the appropriate category</li>',
      '  <li>',
      '    Follow the agent template structure:',
      '    <ul>',
      '      <li>Frontmatter with name, description, color</li>',
      '      <li>Identity &amp; Memory section</li>',
      '    </ul>',
      '  </li>',
      '  <li>Submit a PR with your agent</li>',
      '</ol>',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('<ol');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('Fork the repository');
    expect(html).toContain('Frontmatter with name, description, color');
    expect(html).not.toContain('&lt;ol');
    expect(html).not.toContain('&lt;li');
  });

  it('preserves surrounding markdown when github readmes mix blockquotes with html tables and list items', () => {
    const markdown = [
      '# Generative AI on Google Cloud',
      '',
      '> **[Gemini 3.1 Pro](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro) has been released!**',
      '>',
      '> Here are the latest notebooks and demos using the new model:',
      '>',
      '> - [Intro to Gemini 3.1 Pro](gemini/getting-started/intro_gemini_3_1_pro.ipynb)',
      '',
      'This repository contains notebooks and sample apps.',
      '',
      '## Using this repository',
      '',
      '<table>',
      '  <tr>',
      '    <th></th>',
      '    <th>Description</th>',
      '  </tr>',
      '  <tr>',
      '    <td>[<code>vision/</code>](vision/)</td>',
      '    <td>',
      '      Use this folder for Imagen workflows.',
      '      <li>Image generation</li>',
      '      <li>Image editing</li>',
      '    </td>',
      '  </tr>',
      '</table>',
      '',
      '## Related Repositories',
      '',
      '- [Agent Starter Pack](https://github.com/GoogleCloudPlatform/agent-starter-pack)',
    ].join('\n');

    const html = renderToStaticMarkup(
      React.createElement(MappedMarkdownRenderer, {
        content: markdown,
        annotationRanges: [],
        activeRange: null,
      })
    );

    expect(html).toContain('<h1');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<h2');
    expect(html).toContain('<table');
    expect(html).toContain('Image generation; Image editing');
    expect(html).toContain('Agent Starter Pack');
    expect(html).not.toContain('&gt; &gt;');
    expect(html).not.toContain('## Using this repository |');
  });

});
