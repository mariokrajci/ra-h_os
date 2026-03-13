import type React from 'react';

const LIST_PREFIX_PATTERN = /^([ \t]*)(?:([-*+])(\s+)|(\d+\.)(\s+))/;

function countIndentUnits(input: string): number {
  return input.split('').reduce((total, char) => total + (char === '\t' ? 2 : 1), 0);
}

function formatEm(value: number): string {
  return `${Number(value.toFixed(2)).toString()}em`;
}

export function getLogMarkdownIndentStyle(content: string): React.CSSProperties {
  const firstVisibleLine = content
    .split('\n')
    .find((line) => line.trim().length > 0);

  if (!firstVisibleLine) {
    return {};
  }

  const match = firstVisibleLine.match(LIST_PREFIX_PATTERN);
  if (!match) {
    return {};
  }

  const indentUnits = countIndentUnits(match[1] ?? '');
  const markerWidth = match[2]
    ? 0.4 + 0.5
    : (match[4] ?? '').length * 0.6 + 0.5 + 0.4;
  const prefixWidth = formatEm(indentUnits * 0.5 + markerWidth);

  return {
    paddingLeft: prefixWidth,
    textIndent: `-${prefixWidth}`,
  };
}
