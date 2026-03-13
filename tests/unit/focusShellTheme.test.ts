import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { FOCUS_PANEL_BODY_TEXTAREA_STYLE } from '@/components/focus/focusPanelStyles';

const sourceReader = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/source/SourceReader.tsx'), 'utf8');
const mapStyles = fs.readFileSync(path.join(process.cwd(), 'src/components/panes/map/map-styles.css'), 'utf8');

describe('focus shell theming', () => {
  it('uses theme variables for focus textarea chrome', () => {
    expect(FOCUS_PANEL_BODY_TEXTAREA_STYLE).toMatchObject({
      background: 'var(--app-input)',
      border: '1px solid var(--app-border)',
    });
  });

  it('uses theme variables for source reader and map shell surfaces', () => {
    expect(sourceReader).toContain('var(--app-surface-strong)');
    expect(sourceReader).toContain('var(--app-hairline)');
    expect(mapStyles).toContain('var(--app-surface-strong)');
    expect(mapStyles).toContain('var(--app-panel)');
  });
});
