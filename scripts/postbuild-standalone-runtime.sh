#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NEXT_ROOT="${REPO_ROOT}/.next"
STANDALONE_ROOT="${NEXT_ROOT}/standalone"
STATIC_SOURCE="${NEXT_ROOT}/static"
STATIC_DEST="${STANDALONE_ROOT}/.next/static"
PUBLIC_SOURCE="${REPO_ROOT}/public"
PUBLIC_DEST="${STANDALONE_ROOT}/public"
SERVICE_NAME="rah.service"

copy_tree() {
  local source_path="$1"
  local dest_path="$2"

  rm -rf "$dest_path"
  mkdir -p "$(dirname "$dest_path")"
  cp -R "$source_path" "$dest_path"
}

restart_live_service() {
  local current_pid
  current_pid="$(systemctl show "$SERVICE_NAME" -p MainPID --value 2>/dev/null || true)"

  if [[ ! "$current_pid" =~ ^[0-9]+$ ]] || [ "$current_pid" -le 1 ]; then
    echo "No active ${SERVICE_NAME} PID found; standalone runtime prepared without restart."
    return 0
  fi

  kill "$current_pid"

  for _ in $(seq 1 10); do
    if ! kill -0 "$current_pid" 2>/dev/null; then
      break
    fi
    sleep 1
  done

  if kill -0 "$current_pid" 2>/dev/null; then
    kill -9 "$current_pid"
  fi

  local restarted_pid=""
  for _ in $(seq 1 30); do
    restarted_pid="$(systemctl show "$SERVICE_NAME" -p MainPID --value 2>/dev/null || true)"
    if [[ "$restarted_pid" =~ ^[0-9]+$ ]] && [ "$restarted_pid" -gt 1 ] && [ "$restarted_pid" != "$current_pid" ]; then
      echo "${SERVICE_NAME} restarted with PID ${restarted_pid}."
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for ${SERVICE_NAME} to restart after stopping PID ${current_pid}." >&2
  return 1
}

if [ ! -d "$STANDALONE_ROOT" ]; then
  echo "Standalone build output missing at ${STANDALONE_ROOT}." >&2
  exit 1
fi

if [ ! -d "$STATIC_SOURCE" ]; then
  echo "Static build output missing at ${STATIC_SOURCE}." >&2
  exit 1
fi

copy_tree "$STATIC_SOURCE" "$STATIC_DEST"

if [ -d "$PUBLIC_SOURCE" ]; then
  copy_tree "$PUBLIC_SOURCE" "$PUBLIC_DEST"
fi

restart_live_service
