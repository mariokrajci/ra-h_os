# File Handling Management Design (Single-Server)

## Goal
Define robust PDF/EPUB file handling for a single-server RA-H deployment using local disk as byte storage and SQLite as canonical file registry.

## Scope
- In scope: server-side file persistence, file metadata model, read/write/delete flows, integrity checks, backup/restore flow, migration from legacy metadata-only behavior.
- Out of scope: multi-instance object storage, CDN delivery, cross-region replication.

## Architecture
- Keep file bytes on server filesystem (`~/.local/share/RA-H/files` on Linux, per service user).
- Introduce a new `files` table in SQLite as source of truth for file records.
- Add a `FileService` abstraction that owns file write/read/delete and DB consistency.
- Keep `nodes.metadata.file_type/file_path` as migration compatibility only; stop treating as canonical.
- Update `/api/nodes/:id/file` to resolve via `files` first, then legacy fallback.

### Proposed `files` table
- `id` INTEGER PRIMARY KEY
- `node_id` INTEGER NOT NULL (FK -> `nodes.id`)
- `kind` TEXT NOT NULL (`pdf` | `epub`)
- `storage_path` TEXT NOT NULL
- `mime_type` TEXT NOT NULL
- `size_bytes` INTEGER NOT NULL
- `sha256` TEXT NOT NULL
- `status` TEXT NOT NULL (`ready` | `missing` | `orphaned` | `deleted`)
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `last_verified_at` TEXT NULL
- Unique index on (`node_id`, `kind`)

## Data Flow

### Upload (PDF/EPUB)
1. Validate MIME/extension and size in upload route.
2. Extract content as today.
3. Save bytes through `FileService.save(nodeId, kind, buffer)`.
4. `FileService` computes `sha256`, size, mime and persists/updates `files` row with `status='ready'`.
5. Patch node metadata with compatibility fields (`file_type`) while phasing out `file_path` reliance.

### Read (`GET /api/nodes/:id/file`)
1. Resolve node and intended kind.
2. Lookup `files` row for `(node_id, kind)`.
3. If row is `ready` and file exists, stream bytes.
4. If row exists but file missing, set status `missing` and return `409 FILE_MISSING_ON_DISK`.
5. If no row, use legacy fallback (metadata/link) during migration window.
6. Remote fallback errors return `502` (already aligned).

### Replace/Delete
- Re-upload same `(node_id, kind)` replaces prior bytes atomically.
- Node delete marks related file rows `deleted` and removes bytes (best-effort with logged failures).

### Integrity Verification
- Startup and scheduled check verifies path presence (and optional hash sample).
- Updates `status` and `last_verified_at`.
- Produces report for `missing`/`orphaned` records.

## Error Handling
- `404`: node absent or no readable file source.
- `409`: file record exists but file missing/corrupt on disk.
- `502`: remote fallback fetch failed.
- `500`: unexpected internal exceptions.

### Error payload contract
- `code`
- `message`
- `node_id`
- `kind`

### Reader UX
- Keep current native-reader failure fallback to text mode.
- Show targeted message by error code (missing local vs remote unavailable).

## Backup / Restore
- Backup unit is `DB + files directory` together.
- Add commands:
  - `backup:files`
  - `backup:all` (db + files + manifest)
  - `restore:all`
- Restore preflight:
  - service stopped
  - target writable
  - manifest checksum/count validation

## Migration Plan
1. Add schema migration for `files` table.
2. Backfill from `nodes.metadata.file_type/file_path` where available.
3. Keep legacy read fallback one release cycle.
4. Add admin report listing nodes needing relink/reupload.
5. Remove legacy fallback once report is clean and migration window closes.

## Testing Strategy
- Unit tests for `FileService` read/write/replace/delete and state transitions.
- API tests for upload + serving status matrix (`200/404/409/502`).
- Migration tests for backfill correctness.
- Backup/restore smoke test on staging snapshot.

## Operational Notes
- Effective storage path depends on runtime service user home.
- Single-server assumption is acceptable now; document that scaling to multiple app instances requires shared/object storage.
