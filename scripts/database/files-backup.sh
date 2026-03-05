#!/usr/bin/env bash
set -euo pipefail

if [[ "${OSTYPE:-}" == darwin* ]]; then
  FILES_DIR="${RAH_FILES_DIR:-$HOME/Library/Application Support/RA-H/files}"
else
  FILES_DIR="${RAH_FILES_DIR:-$HOME/.local/share/RA-H/files}"
fi

BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

TS=$(date +"%Y%m%d_%H%M%S")
DEST="$BACKUP_DIR/rah_files_${TS}.tar.gz"

if [ ! -d "$FILES_DIR" ]; then
  echo "Files dir not found ($FILES_DIR). Creating empty archive placeholder."
  tar -czf "$DEST" --files-from /dev/null
else
  tar -czf "$DEST" -C "$FILES_DIR" .
fi

echo "Files backup created: $DEST"
