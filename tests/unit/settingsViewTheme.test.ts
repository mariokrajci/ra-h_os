import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const externalAgentsPanel = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/ExternalAgentsPanel.tsx'), 'utf8');
const apiKeysViewer = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/ApiKeysViewer.tsx'), 'utf8');
const contextViewer = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/ContextViewer.tsx'), 'utf8');
const toolsViewer = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/ToolsViewer.tsx'), 'utf8');
const guidesViewer = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/GuidesViewer.tsx'), 'utf8');
const logsViewer = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/LogsViewer.tsx'), 'utf8');
const logsRow = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/LogsRow.tsx'), 'utf8');
const databaseViewer = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/DatabaseViewer.tsx'), 'utf8');

describe('settings viewer theming', () => {
  it('uses theme variables across remaining settings panels', () => {
    expect(externalAgentsPanel).toContain('var(--app-panel-elevated)');
    expect(externalAgentsPanel).toContain('var(--app-border)');
    expect(apiKeysViewer).toContain('var(--app-panel-elevated)');
    expect(apiKeysViewer).toContain('var(--app-input)');
    expect(contextViewer).toContain('var(--app-panel-elevated)');
    expect(contextViewer).toContain('var(--app-text)');
    expect(toolsViewer).toContain('var(--app-panel-elevated)');
    expect(toolsViewer).toContain('var(--app-hairline)');
    expect(guidesViewer).toContain('var(--app-panel-elevated)');
    expect(guidesViewer).toContain('var(--app-danger-text)');
    expect(logsViewer).toContain('app-button');
    expect(logsViewer).toContain('app-input');
    expect(logsViewer).toContain('var(--app-danger-text)');
    expect(logsRow).toContain('var(--app-input)');
    expect(logsRow).toContain('var(--app-text)');
    expect(databaseViewer).toContain('app-button');
    expect(databaseViewer).toContain('app-input');
    expect(databaseViewer).toContain('var(--app-danger-text)');
  });
});
