import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
  strongDelimiter: '**',
});

export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return '';
  return turndown.turndown(html);
}

