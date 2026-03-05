# File Handling Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make server-side PDF/EPUB file handling reliable on a single-server deployment by adding a canonical `files` registry, integrity checks, and backup/restore workflows.

**Architecture:** Keep bytes on local disk and track file state in SQLite `files` table. Route reads through `files` records first, then temporary legacy fallback. Centralize I/O and metadata consistency in `FileService`.

**Tech Stack:** Next.js route handlers, TypeScript services, SQLite (better-sqlite3), Vitest, shell backup scripts.

---

### Task 1: Add `files` table schema + migration

**Files:**
- Modify: `src/services/database/sqlite-client.ts`
- Test: `src/services/database/__tests__/sqlite-migrations.test.ts` (create if missing)

**Step 1: Write the failing migration test**
```ts
it('creates files table with expected columns and unique node/kind index', async () => {
  // initialize db using migration bootstrap
  // query sqlite_master for table and indexes
  // expect files table exists and unique index on (node_id, kind)
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/services/database/__tests__/sqlite-migrations.test.ts`
Expected: FAIL (table/index missing)

**Step 3: Add migration code**
- Create `files` table and indexes in migration path.
- Ensure idempotence for existing deployments.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/services/database/__tests__/sqlite-migrations.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/services/database/sqlite-client.ts src/services/database/__tests__/sqlite-migrations.test.ts
git commit -m "feat(db): add files registry table"
```

### Task 2: Implement `fileRegistryService` (DB layer)

**Files:**
- Create: `src/services/storage/fileRegistryService.ts`
- Test: `src/services/storage/__tests__/fileRegistryService.test.ts`

**Step 1: Write failing tests**
- `upsertFileRecord` writes/updates `(node_id, kind)`
- `getFileRecordByNodeAndKind` returns stored row
- `markFileStatus` updates status and timestamps

**Step 2: Run tests (RED)**
Run: `npm test -- src/services/storage/__tests__/fileRegistryService.test.ts`
Expected: FAIL (module/functions missing)

**Step 3: Implement minimal DB service**
- CRUD methods required by API + integrity checks.
- Keep API small and explicit.

**Step 4: Run tests (GREEN)**
Run: `npm test -- src/services/storage/__tests__/fileRegistryService.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/services/storage/fileRegistryService.ts src/services/storage/__tests__/fileRegistryService.test.ts
git commit -m "feat(storage): add file registry service"
```

### Task 3: Implement `FileService` for atomic write/read/delete

**Files:**
- Create: `src/services/storage/fileService.ts`
- Modify: `src/services/storage/fileStorage.ts` (extract/reuse path helpers only)
- Test: `src/services/storage/__tests__/fileService.test.ts`

**Step 1: Write failing tests**
- `save` writes temp + rename and returns metadata (path, hash, size)
- `read` throws typed error when missing
- `replace` preserves atomicity
- `remove` handles not-found idempotently

**Step 2: Run tests (RED)**
Run: `npm test -- src/services/storage/__tests__/fileService.test.ts`
Expected: FAIL

**Step 3: Implement minimal `FileService`**
- Use temp file + `fs.rename`.
- Compute SHA-256 with Node crypto.
- Return structured result.

**Step 4: Run tests (GREEN)**
Run: `npm test -- src/services/storage/__tests__/fileService.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/services/storage/fileService.ts src/services/storage/fileStorage.ts src/services/storage/__tests__/fileService.test.ts
git commit -m "feat(storage): add atomic file service"
```

### Task 4: Wire upload routes to `FileService` + registry

**Files:**
- Modify: `app/api/extract/pdf/upload/route.ts`
- Modify: `app/api/extract/epub/upload/route.ts`
- Test: `tests/api/pdf-upload-route.test.ts` (create if missing)
- Test: `tests/api/epub-upload-route.test.ts` (create if missing)

**Step 1: Write failing API tests**
- Upload creates/updates `files` table record with `ready`.
- Response remains backward compatible.

**Step 2: Run tests (RED)**
Run:
- `npm test -- tests/api/pdf-upload-route.test.ts`
- `npm test -- tests/api/epub-upload-route.test.ts`
Expected: FAIL

**Step 3: Implement route updates**
- Save bytes through `FileService`.
- Upsert registry rows.
- Keep compatibility metadata fields.

**Step 4: Run tests (GREEN)**
Run the two tests again.
Expected: PASS

**Step 5: Commit**
```bash
git add app/api/extract/pdf/upload/route.ts app/api/extract/epub/upload/route.ts tests/api/pdf-upload-route.test.ts tests/api/epub-upload-route.test.ts
git commit -m "feat(api): register uploaded files in canonical registry"
```

### Task 5: Update `/api/nodes/[id]/file` to use registry-first resolution

**Files:**
- Modify: `app/api/nodes/[id]/file/route.ts`
- Modify: `tests/api/nodes-file-route.test.ts`

**Step 1: Write failing tests**
- Registry `ready` -> `200` stream
- Registry row + missing disk -> `409 FILE_MISSING_ON_DISK`
- No registry + remote fail -> `502`
- No source -> `404`

**Step 2: Run tests (RED)**
Run: `npm test -- tests/api/nodes-file-route.test.ts`
Expected: FAIL for new scenarios

**Step 3: Implement minimal route changes**
- Add registry lookup path.
- Add structured error payload with `code`.
- Preserve temporary legacy fallback.

**Step 4: Run tests (GREEN)**
Run: `npm test -- tests/api/nodes-file-route.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add app/api/nodes/[id]/file/route.ts tests/api/nodes-file-route.test.ts
git commit -m "feat(api): serve node files via registry-first lookup"
```

### Task 6: Add integrity check command

**Files:**
- Create: `scripts/database/verify-files-integrity.ts`
- Modify: `package.json` (new script command)
- Test: `src/services/storage/__tests__/integrityCheck.test.ts` (or script-level test)

**Step 1: Write failing test**
- Marks registry entries `missing` when disk file absent.
- Reports summary counts.

**Step 2: Run test (RED)**
Run: `npm test -- src/services/storage/__tests__/integrityCheck.test.ts`
Expected: FAIL

**Step 3: Implement command**
- Iterate registry rows.
- Validate existence (+ optional hash sample mode).
- Emit machine-readable summary.

**Step 4: Run test (GREEN)**
Run same test.
Expected: PASS

**Step 5: Commit**
```bash
git add scripts/database/verify-files-integrity.ts package.json src/services/storage/__tests__/integrityCheck.test.ts
git commit -m "feat(ops): add files integrity verification command"
```

### Task 7: Add backup/restore scripts for DB + files

**Files:**
- Create: `scripts/database/files-backup.sh`
- Create: `scripts/database/backup-all.sh`
- Create: `scripts/database/restore-all.sh`
- Modify: `package.json`
- Modify: `README.md` (ops section)

**Step 1: Write failing script smoke test (or dry-run test)**
- Verifies commands generate expected archive + manifest files.

**Step 2: Run test (RED)**
Run: `npm test -- tests/scripts/backup-restore.test.ts`
Expected: FAIL

**Step 3: Implement scripts**
- Include preflight checks (service stop/writable path/manifest).
- Ensure safe failure behavior.

**Step 4: Run test (GREEN)**
Run same test.
Expected: PASS

**Step 5: Commit**
```bash
git add scripts/database/files-backup.sh scripts/database/backup-all.sh scripts/database/restore-all.sh package.json README.md tests/scripts/backup-restore.test.ts
git commit -m "feat(ops): add backup and restore workflow for files and db"
```

### Task 8: Add migration backfill for legacy metadata

**Files:**
- Create: `scripts/database/backfill-files-from-node-metadata.ts`
- Test: `tests/scripts/backfill-files.test.ts`
- Modify: `README.md`

**Step 1: Write failing backfill test**
- Legacy node metadata creates proper registry row.
- Missing path is reported, not silently accepted.

**Step 2: Run test (RED)**
Run: `npm test -- tests/scripts/backfill-files.test.ts`
Expected: FAIL

**Step 3: Implement script**
- Read nodes with `metadata.file_type/file_path`.
- Validate path exists.
- Upsert registry row and status.

**Step 4: Run test (GREEN)**
Run same test.
Expected: PASS

**Step 5: Commit**
```bash
git add scripts/database/backfill-files-from-node-metadata.ts tests/scripts/backfill-files.test.ts README.md
git commit -m "feat(migration): add backfill from legacy file metadata"
```

### Task 9: Final verification sweep

**Files:**
- Modify: none unless failures found

**Step 1: Run targeted suite**
Run:
- `npm test -- tests/api/nodes-file-route.test.ts`
- `npm test -- tests/api/pdf-upload-route.test.ts`
- `npm test -- tests/api/epub-upload-route.test.ts`
- `npm test -- src/services/storage/__tests__/fileService.test.ts`
- `npm test -- src/services/storage/__tests__/fileRegistryService.test.ts`

Expected: all PASS

**Step 2: Run project checks**
Run:
- `npm run type-check`
- `npm run lint` (if currently enforced for CI)

Expected: PASS (or documented known lint exceptions)

**Step 3: Manual smoke check**
- Upload PDF and EPUB via UI.
- Open each in reader.
- Hit `/api/nodes/:id/file` directly.
- Run integrity command once.

**Step 4: Commit final polish (if any)**
```bash
git add -A
git commit -m "chore: finalize file handling management rollout"
```
