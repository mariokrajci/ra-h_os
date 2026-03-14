import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('build automation', () => {
  it('runs the safe live-build wrapper and standalone runtime sync after build', () => {
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toContain('bash ./scripts/build-live-runtime.sh');
    expect(packageJson.scripts?.postbuild).toBe('bash ./scripts/postbuild-standalone-runtime.sh');
  });

  it('stops the live service before build and restores it if the build fails', () => {
    const scriptPath = path.join(repoRoot, 'scripts', 'build-live-runtime.sh');
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toContain('SERVICE_STATE_FILE=');
    expect(script).toContain('kill -STOP "$service_pid"');
    expect(script).toContain('"$NEXT_BIN" build');
    expect(script).toContain('restore_runtime_backup');
    expect(script).toContain('kill -CONT "$service_pid"');
  });

  it('syncs standalone assets and recycles the live rah service', () => {
    const scriptPath = path.join(repoRoot, 'scripts', 'postbuild-standalone-runtime.sh');
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toContain('STANDALONE_ROOT="${NEXT_ROOT}/standalone"');
    expect(script).toContain('STATIC_DEST="${STANDALONE_ROOT}/.next/static"');
    expect(script).toContain('SERVICE_STATE_FILE=');
    expect(script).toContain('systemctl show "$SERVICE_NAME" -p MainPID --value');
    expect(script).toContain('kill "$paused_pid"');
    expect(script).toContain('rm -rf "$RUNTIME_BACKUP_ROOT"');
  });
});
