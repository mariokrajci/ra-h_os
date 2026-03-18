import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  exchangePairingCode,
  generatePairingCode,
  getConfiguredExtensionToken,
  getExtensionAuthStatus,
  revokeExtensionToken,
} from '@/services/settings/extensionAuthSettings';

describe('extensionAuthSettings', () => {
  const testDir = path.join(os.tmpdir(), 'rahos-extension-auth-test');

  beforeEach(() => {
    process.env.RAH_CONFIG_DIR = testDir;
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('generates one-time pairing code and exchanges it for token', () => {
    const pairing = generatePairingCode();
    expect(pairing.code).toHaveLength(8);
    expect(getExtensionAuthStatus().pairingCodeActive).toBe(true);

    const exchanged = exchangePairingCode(pairing.code);
    expect(exchanged.token.length).toBeGreaterThan(20);
    expect(getConfiguredExtensionToken()).toBe(exchanged.token);
    expect(getExtensionAuthStatus().pairingCodeActive).toBe(false);
  });

  it('rejects invalid pairing code', () => {
    generatePairingCode();
    expect(() => exchangePairingCode('BADCODE1')).toThrowError('Invalid pairing code');
  });

  it('revokes configured token', () => {
    const pairing = generatePairingCode();
    const exchanged = exchangePairingCode(pairing.code);
    expect(getConfiguredExtensionToken()).toBe(exchanged.token);
    revokeExtensionToken();
    expect(getConfiguredExtensionToken()).toBeNull();
  });
});
