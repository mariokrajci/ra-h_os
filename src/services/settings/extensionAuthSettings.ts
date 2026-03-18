import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface ExtensionAuthState {
  extensionToken?: string;
  pairingCodeHash?: string;
  pairingCodeExpiresAt?: string;
  pairingCodeIssuedAt?: string;
}

const SETTINGS_FILE = 'extension-auth.json';
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

function resolveBaseConfigDir(): string {
  const override = process.env.RAH_CONFIG_DIR;
  if (override && override.trim()) return override.trim();
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'RA-H');
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'RA-H');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdgConfig, 'ra-h');
}

function getSettingsDir(): string {
  return path.join(resolveBaseConfigDir(), 'config');
}

function getSettingsPath(): string {
  return path.join(getSettingsDir(), SETTINGS_FILE);
}

function ensureSettingsDirExists(): void {
  const dir = getSettingsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function readState(): ExtensionAuthState {
  try {
    const file = getSettingsPath();
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ExtensionAuthState;
  } catch {
    return {};
  }
}

function writeState(state: ExtensionAuthState): void {
  ensureSettingsDirExists();
  fs.writeFileSync(getSettingsPath(), JSON.stringify(state, null, 2), 'utf-8');
}

export function getExtensionAuthStatus() {
  const state = readState();
  const now = Date.now();
  const expiresAtMs = state.pairingCodeExpiresAt ? Date.parse(state.pairingCodeExpiresAt) : 0;
  const pairingCodeActive = Boolean(state.pairingCodeHash && expiresAtMs > now);
  return {
    tokenConfigured: typeof state.extensionToken === 'string' && state.extensionToken.length > 0,
    pairingCodeActive,
    pairingCodeExpiresAt: pairingCodeActive ? state.pairingCodeExpiresAt : null,
  };
}

export function getConfiguredExtensionToken(): string | null {
  const state = readState();
  if (typeof state.extensionToken === 'string' && state.extensionToken.trim()) {
    return state.extensionToken.trim();
  }
  return null;
}

export function generatePairingCode(): { code: string; expiresAt: string } {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();
  const state = readState();
  writeState({
    ...state,
    pairingCodeHash: hashCode(code),
    pairingCodeIssuedAt: new Date().toISOString(),
    pairingCodeExpiresAt: expiresAt,
  });
  return { code, expiresAt };
}

export function exchangePairingCode(inputCode: string): { token: string } {
  const code = String(inputCode || '').trim().toUpperCase();
  if (!code) throw new Error('Pairing code is required');
  const state = readState();
  const expectedHash = state.pairingCodeHash;
  const expiresAt = state.pairingCodeExpiresAt ? Date.parse(state.pairingCodeExpiresAt) : 0;
  if (!expectedHash || !expiresAt || Number.isNaN(expiresAt)) {
    throw new Error('No active pairing code');
  }
  if (Date.now() > expiresAt) {
    writeState({
      ...state,
      pairingCodeHash: undefined,
      pairingCodeIssuedAt: undefined,
      pairingCodeExpiresAt: undefined,
    });
    throw new Error('Pairing code expired');
  }
  const incomingHash = hashCode(code);
  if (incomingHash !== expectedHash) {
    throw new Error('Invalid pairing code');
  }

  const token = state.extensionToken || crypto.randomBytes(24).toString('hex');
  writeState({
    extensionToken: token,
    pairingCodeHash: undefined,
    pairingCodeIssuedAt: undefined,
    pairingCodeExpiresAt: undefined,
  });
  return { token };
}

export function revokeExtensionToken(): void {
  writeState({});
}
