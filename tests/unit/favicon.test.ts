import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('favicon asset', () => {
  it('provides a favicon for /favicon.ico requests', () => {
    const appFaviconPath = path.resolve(process.cwd(), 'app/favicon.ico');
    const publicFaviconPath = path.resolve(process.cwd(), 'public/favicon.ico');

    const hasFavicon = fs.existsSync(appFaviconPath) || fs.existsSync(publicFaviconPath);

    expect(hasFavicon).toBe(true);
  });
});
