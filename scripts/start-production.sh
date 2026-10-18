#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export NODE_ENV="${NODE_ENV:-production}"

if [[ -n "${APP_ENV_FILE:-}" ]]; then
  [[ -f "$APP_ENV_FILE" ]] || {
    printf 'APP_ENV_FILE does not exist: %s\n' "$APP_ENV_FILE" >&2
    exit 1
  }
  exec node --env-file="$APP_ENV_FILE" dist/index.js
fi

if [[ -f .env ]]; then
  exec node --env-file=.env dist/index.js
fi

# systemd/containers may inject the environment directly and omit a local file.
exec node dist/index.js
