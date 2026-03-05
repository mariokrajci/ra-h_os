#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="$ROOT_DIR/scripts/backups"
mkdir -p "$BACKUP_DIR"

sha256_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    sha256sum "$file" | awk '{print $1}'
  fi
}

TS=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP_NAME="rah_backup_${TS}.sqlite"
FILES_BACKUP_NAME="rah_files_${TS}.tar.gz"
MANIFEST_NAME="rah_manifest_${TS}.json"

echo "Creating SQLite backup..."
"$ROOT_DIR/scripts/database/sqlite-backup.sh"

LATEST_DB=$(ls -1t "$BACKUP_DIR"/rah_backup_*.sqlite | head -n 1)
if [ -z "${LATEST_DB:-}" ]; then
  echo "Failed to locate generated database backup." >&2
  exit 1
fi

echo "Creating files backup..."
"$ROOT_DIR/scripts/database/files-backup.sh"
LATEST_FILES=$(ls -1t "$BACKUP_DIR"/rah_files_*.tar.gz | head -n 1)
if [ -z "${LATEST_FILES:-}" ]; then
  echo "Failed to locate generated files backup." >&2
  exit 1
fi

DB_SHA=$(sha256_file "$LATEST_DB")
FILES_SHA=$(sha256_file "$LATEST_FILES")

cat > "$BACKUP_DIR/$MANIFEST_NAME" <<JSON
{
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "db_backup": "$(basename "$LATEST_DB")",
  "db_sha256": "$DB_SHA",
  "files_backup": "$(basename "$LATEST_FILES")",
  "files_sha256": "$FILES_SHA"
}
JSON

echo "Backup complete:"
echo "  DB:      $LATEST_DB"
echo "  Files:   $LATEST_FILES"
echo "  Manifest:$BACKUP_DIR/$MANIFEST_NAME"
