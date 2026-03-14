#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NEXT_ROOT="${REPO_ROOT}/.next"
STANDALONE_ROOT="${NEXT_ROOT}/standalone"
SERVICE_NAME="rah.service"
SERVICE_STATE_FILE="${NEXT_ROOT}/rah-service.pid"
RUNTIME_BACKUP_ROOT="${REPO_ROOT}/.runtime-backups"
STANDALONE_BACKUP_ROOT="${RUNTIME_BACKUP_ROOT}/standalone"
NEXT_BIN="${REPO_ROOT}/node_modules/.bin/next"

service_pid=""
build_succeeded=0

copy_tree() {
  local source_path="$1"
  local dest_path="$2"

  rm -rf "$dest_path"
  mkdir -p "$(dirname "$dest_path")"
  cp -R "$source_path" "$dest_path"
}

backup_runtime() {
  if [ -d "$STANDALONE_ROOT" ]; then
    copy_tree "$STANDALONE_ROOT" "$STANDALONE_BACKUP_ROOT"
  fi
}

restore_runtime_backup() {
  if [ -d "$STANDALONE_BACKUP_ROOT" ]; then
    copy_tree "$STANDALONE_BACKUP_ROOT" "$STANDALONE_ROOT"
  fi
}

resume_paused_service() {
  if [[ "$service_pid" =~ ^[0-9]+$ ]] && kill -0 "$service_pid" 2>/dev/null; then
    kill -CONT "$service_pid"
  fi
}

cleanup_on_failure() {
  if [ "$build_succeeded" -eq 1 ]; then
    return 0
  fi

  if [ -f "$SERVICE_STATE_FILE" ]; then
    restore_runtime_backup
    resume_paused_service
    rm -f "$SERVICE_STATE_FILE"
  fi
}

trap cleanup_on_failure EXIT

rm -f "$SERVICE_STATE_FILE"

service_pid="$(systemctl show "$SERVICE_NAME" -p MainPID --value 2>/dev/null || true)"

if [[ "$service_pid" =~ ^[0-9]+$ ]] && [ "$service_pid" -gt 1 ]; then
  mkdir -p "$RUNTIME_BACKUP_ROOT"
  backup_runtime
  printf '%s\n' "$service_pid" > "$SERVICE_STATE_FILE"
  kill -STOP "$service_pid"
fi

if [ ! -x "$NEXT_BIN" ]; then
  echo "Next.js CLI missing at ${NEXT_BIN}. Run npm install first." >&2
  exit 1
fi

"$NEXT_BIN" build
build_succeeded=1
