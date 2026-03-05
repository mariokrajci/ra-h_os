#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <manifest.json>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="$ROOT_DIR/scripts/backups"
MANIFEST="$1"

sha256_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    sha256sum "$file" | awk '{print $1}'
  fi
}

if [ ! -f "$MANIFEST" ]; then
  if [ -f "$BACKUP_DIR/$MANIFEST" ]; then
    MANIFEST="$BACKUP_DIR/$MANIFEST"
  else
    echo "Manifest not found: $MANIFEST" >&2
    exit 1
  fi
fi

DB_BACKUP="$BACKUP_DIR/$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.db_backup);" "$MANIFEST")"
FILES_BACKUP="$BACKUP_DIR/$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.files_backup);" "$MANIFEST")"
EXPECTED_DB_SHA="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.db_sha256);" "$MANIFEST")"
EXPECTED_FILES_SHA="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.files_sha256);" "$MANIFEST")"

if [ ! -f "$DB_BACKUP" ] || [ ! -f "$FILES_BACKUP" ]; then
  echo "Backup artifacts referenced by manifest are missing." >&2
  exit 1
fi

ACTUAL_DB_SHA=$(sha256_file "$DB_BACKUP")
ACTUAL_FILES_SHA=$(sha256_file "$FILES_BACKUP")
if [ "$ACTUAL_DB_SHA" != "$EXPECTED_DB_SHA" ] || [ "$ACTUAL_FILES_SHA" != "$EXPECTED_FILES_SHA" ]; then
  echo "Checksum mismatch. Aborting restore." >&2
  exit 1
fi

echo "Restoring SQLite database..."
"$ROOT_DIR/scripts/database/sqlite-restore.sh" "$DB_BACKUP"

if [[ "${OSTYPE:-}" == darwin* ]]; then
  FILES_DIR="${RAH_FILES_DIR:-$HOME/Library/Application Support/RA-H/files}"
else
  FILES_DIR="${RAH_FILES_DIR:-$HOME/.local/share/RA-H/files}"
fi

echo "Restoring files directory to: $FILES_DIR"
mkdir -p "$FILES_DIR"
rm -rf "$FILES_DIR"/*
tar -xzf "$FILES_BACKUP" -C "$FILES_DIR"

echo "Restore complete."
