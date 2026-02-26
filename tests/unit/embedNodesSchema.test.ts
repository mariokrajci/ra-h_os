import { describe, expect, test } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('embed-nodes schema compatibility', () => {
  test('uses notes column instead of removed content column', () => {
    const filePath = path.join(process.cwd(), 'src/services/typescript/embed-nodes.ts');
    const source = fs.readFileSync(filePath, 'utf8');

    expect(source.includes('n.content')).toBe(false);
    expect(source.includes('n.notes')).toBe(true);
  });
});
