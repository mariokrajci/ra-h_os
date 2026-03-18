import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { GET as getPairingStatus, POST as postPairingCode } from '../../app/api/bookmarklet/pairing-code/route';
import { POST as postPair } from '../../app/api/bookmarklet/pair/route';

describe('bookmarklet pairing routes', () => {
  const testDir = path.join(os.tmpdir(), 'rahos-bookmarklet-pairing-route-test');

  beforeEach(() => {
    process.env.RAH_CONFIG_DIR = testDir;
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates pairing code and exchanges token', async () => {
    const generatedResponse = await postPairingCode(
      new NextRequest('http://localhost:3000/api/bookmarklet/pairing-code', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const generated = await generatedResponse.json();
    expect(generated.success).toBe(true);
    expect(typeof generated.pairing.code).toBe('string');

    const exchangeResponse = await postPair(
      new NextRequest('http://localhost:3000/api/bookmarklet/pair', {
        method: 'POST',
        body: JSON.stringify({ pairingCode: generated.pairing.code }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const exchanged = await exchangeResponse.json();
    expect(exchanged.success).toBe(true);
    expect(typeof exchanged.token).toBe('string');

    const statusResponse = await getPairingStatus();
    const status = await statusResponse.json();
    expect(status.success).toBe(true);
    expect(status.status.tokenConfigured).toBe(true);
  });
});
