# Development Process (RA-OS)

This repo is the open-source build of RA-H. Keep changes focused, reviewable, and easy to maintain.

`AGENTS.md` is the source of truth for agent/contributor workflow in this repository.

## Branching

- Create a feature branch off `main` for all changes.
- Use short, descriptive names: `docs/<short-name>`, `fix/<short-name>`, `feat/<short-name>`.
- Avoid direct commits to `main`.

## Local Setup

```bash
git clone https://github.com/bradwmorris/ra-h_os.git
cd ra-h_os
npm install
npm rebuild better-sqlite3
scripts/dev/bootstrap-local.sh
npm run dev
```

## Dev Loop

1. Reproduce or define the change.
2. Implement in a small, isolated diff.
3. Run checks (see below).
4. Update docs if behavior or UX changes.

## Checks

```bash
npm run type-check
npm run lint
npm run build
```

## Production Build Behavior

- `npm run build` runs a live-safe wrapper before invoking `next build`.
- If `rah.service` is currently serving this checkout, the wrapper pauses its PID and backs up the current standalone runtime before the build rewrites `.next/`.
- If the build fails, the wrapper restores the backup and resumes the paused service.
- After a successful build, `postbuild` copies `.next/static` and `public/` into the standalone runtime.
- If the wrapper paused `rah.service`, `postbuild` then terminates the paused PID so `Restart=always` brings it back on the fully prepared build.

## PR Checklist

- Clear description of the change and why it matters.
- Screenshots or GIFs for UI changes.
- Docs updated if the public-facing behavior changed.
- Checks pass locally.

## Sync Policy (Private Upstream)

- `ra-h_os` accepts direct contributions.
- Maintainers may port relevant changes between public and private repos.
- Public contributions will not be overwritten by syncs.
