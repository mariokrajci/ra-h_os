import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const globalsCss = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

describe('pane theme tokens', () => {
  it('defines pane-oriented semantic surface tokens', () => {
    expect(globalsCss).toContain('--app-surface-subtle:');
    expect(globalsCss).toContain('--app-surface-strong:');
    expect(globalsCss).toContain('--app-input:');
    expect(globalsCss).toContain('--app-table-stripe:');
    expect(globalsCss).toContain('--app-hairline:');
  });
});
