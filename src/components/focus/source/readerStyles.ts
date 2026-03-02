import type { CSSProperties } from 'react';

export const READER_FONT_FAMILY = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const READER_BODY_FONT_SIZE = '15px';
export const READER_BODY_LINE_HEIGHT = '1.7';
export const READER_BODY_COLOR = '#d4d4d4';

export const READER_CONTAINER_STYLE: CSSProperties = {
  maxWidth: '680px',
  margin: '0 auto',
  padding: '24px 16px',
};

export const READER_BODY_TEXT_STYLE: CSSProperties = {
  fontFamily: READER_FONT_FAMILY,
  fontSize: READER_BODY_FONT_SIZE,
  lineHeight: READER_BODY_LINE_HEIGHT,
  color: READER_BODY_COLOR,
};

export const READER_BODY_BLOCK_STYLE: CSSProperties = {
  ...READER_BODY_TEXT_STYLE,
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
};
