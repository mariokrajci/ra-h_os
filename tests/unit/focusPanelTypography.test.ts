import { describe, expect, it } from 'vitest';
import {
  FOCUS_PANEL_BODY_TEXT_STYLE,
  FOCUS_PANEL_BODY_TEXTAREA_STYLE,
} from '@/components/focus/focusPanelStyles';

describe('focus panel typography styles', () => {
  it('uses the shared reading tokens for body text surfaces', () => {
    expect(FOCUS_PANEL_BODY_TEXT_STYLE).toMatchObject({
      fontFamily: "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: '15px',
      lineHeight: '1.7',
      color: 'var(--app-text)',
    });
  });

  it('uses the shared reading tokens for editable text surfaces', () => {
    expect(FOCUS_PANEL_BODY_TEXTAREA_STYLE).toMatchObject({
      fontFamily: "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: '15px',
      lineHeight: '1.7',
      color: 'var(--app-text)',
    });
  });
});
