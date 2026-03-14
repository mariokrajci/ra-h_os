import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const paneHeader = fs.readFileSync(path.join(process.cwd(), 'src/components/panes/PaneHeader.tsx'), 'utf8');
const splitHandle = fs.readFileSync(path.join(process.cwd(), 'src/components/layout/SplitHandle.tsx'), 'utf8');
const nodePane = fs.readFileSync(path.join(process.cwd(), 'src/components/panes/NodePane.tsx'), 'utf8');

describe('pane chrome theme usage', () => {
  it('uses theme variables in shared pane chrome', () => {
    expect(paneHeader).toContain('var(--app-input)');
    expect(paneHeader).toContain('var(--app-border)');
    expect(splitHandle).toContain('var(--app-hover)');
    expect(splitHandle).toContain('var(--toolbar-accent)');
    expect(nodePane).toContain('var(--app-surface-subtle)');
  });

  it('makes the node tab strip horizontally scrollable when many tabs are open', () => {
    expect(nodePane).toContain('overflowX: \'auto\'');
    expect(nodePane).toContain('overflowY: \'hidden\'');
    expect(nodePane).toContain('WebkitOverflowScrolling: \'touch\'');
  });
});
