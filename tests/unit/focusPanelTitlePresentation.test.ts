import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const focusPanelSource = fs.readFileSync(path.join(process.cwd(), 'src/components/focus/FocusPanel.tsx'), 'utf8');

describe('FocusPanel title presentation', () => {
  it('normalizes duplicated leading titles out of notes and source display content', () => {
    expect(focusPanelSource).toContain('stripLeadingDuplicateTitle');
    expect(focusPanelSource).toContain('normalizedNotesContent');
    expect(focusPanelSource).toContain('normalizedSourceContent');
  });

  it('uses a compact utility row so the title can take the full width below', () => {
    expect(focusPanelSource).toContain('Node utility row');
    expect(focusPanelSource).toContain('title="Drag to chat to reference this node"');
    expect(focusPanelSource).toContain('title={`${nodesData[activeTab].link} (Cmd+Click to edit)`}');
    expect(focusPanelSource).toContain('title="Delete node"');
    expect(focusPanelSource).toContain("marginRight: '-8px'");
    expect(focusPanelSource).toContain("marginTop: '-12px'");
    expect(focusPanelSource).toContain("width: '28px'");
    expect(focusPanelSource).toContain("height: '28px'");
    expect(focusPanelSource).toContain("borderRadius: '6px'");
  });

  it('allows the header title to wrap instead of forcing ellipsis', () => {
    const titleBlockMatch = focusPanelSource.match(/<h1[\s\S]*?title=\{nodesData\[activeTab\]\.title \|\| 'Untitled'\}[\s\S]*?>/);
    expect(titleBlockMatch?.[0]).toContain("whiteSpace: 'normal'");
    expect(titleBlockMatch?.[0]).toContain("wordBreak: 'break-word'");
    expect(titleBlockMatch?.[0]).not.toContain("textOverflow: 'ellipsis'");
  });
});
