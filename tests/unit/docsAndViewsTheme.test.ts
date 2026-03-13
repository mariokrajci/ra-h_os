import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const docsModal = fs.readFileSync(path.join(process.cwd(), 'src/components/docs/DocsModal.tsx'), 'utf8');
const listView = fs.readFileSync(path.join(process.cwd(), 'src/components/views/ListView.tsx'), 'utf8');
const viewsOverlay = fs.readFileSync(path.join(process.cwd(), 'src/components/views/ViewsOverlay.tsx'), 'utf8');
const gridView = fs.readFileSync(path.join(process.cwd(), 'src/components/views/GridView.tsx'), 'utf8');
const kanbanView = fs.readFileSync(path.join(process.cwd(), 'src/components/views/KanbanView.tsx'), 'utf8');
const databaseTableView = fs.readFileSync(path.join(process.cwd(), 'src/components/views/DatabaseTableView.tsx'), 'utf8');
const viewFilters = fs.readFileSync(path.join(process.cwd(), 'src/components/views/ViewFilters.tsx'), 'utf8');

describe('docs and views theming', () => {
  it('uses semantic theme tokens for modal chrome and list cards', () => {
    expect(docsModal).toContain('var(--app-toolbar)');
    expect(docsModal).toContain('var(--app-selected)');
    expect(listView).toContain('var(--app-panel-elevated)');
    expect(listView).toContain('var(--app-text)');
    expect(viewsOverlay).toContain('var(--app-panel-elevated)');
    expect(viewsOverlay).toContain('var(--app-surface-subtle)');
    expect(gridView).toContain('var(--app-panel-elevated)');
    expect(gridView).toContain('var(--app-text)');
    expect(kanbanView).toContain('var(--app-panel)');
    expect(kanbanView).toContain('var(--app-border)');
    expect(databaseTableView).toContain('app-button');
    expect(databaseTableView).toContain('app-input');
    expect(viewFilters).toContain('var(--app-surface-strong)');
    expect(viewFilters).toContain('var(--app-border)');
  });
});
