import type { CSSProperties } from 'react';
import {
  READER_BODY_COLOR,
  READER_BODY_FONT_SIZE,
  READER_BODY_LINE_HEIGHT,
  READER_FONT_FAMILY,
} from './source/readerStyles';

export const FOCUS_PANEL_BODY_TEXT_STYLE: CSSProperties = {
  fontFamily: READER_FONT_FAMILY,
  fontSize: READER_BODY_FONT_SIZE,
  lineHeight: READER_BODY_LINE_HEIGHT,
  color: READER_BODY_COLOR,
};

export const FOCUS_PANEL_BODY_TEXTAREA_STYLE: CSSProperties = {
  ...FOCUS_PANEL_BODY_TEXT_STYLE,
  background: 'var(--app-input)',
  border: '1px solid var(--app-border)',
  borderRadius: '4px',
  padding: '12px',
  width: '100%',
  resize: 'none',
  outline: 'none',
  overflow: 'auto',
};
