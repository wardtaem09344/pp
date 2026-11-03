#!/usr/bin/env bash
set -Eeuo pipefail

: "${PORT:=10000}"
PUBLIC_URL="${PUBLIC_URL:-${RENDER_EXTERNAL_URL:-}}"
BIND_HOST="$(hostname -I | awk '{print $1}')"

if [[ -z "$BIND_HOST" ]]; then
  echo "Could not determine the container's concrete IP address." >&2
  exit 1
fi

set -- pnpm dsh --profile web --no-open --host "$BIND_HOST" --port "$PORT" --trusted-host "$BIND_HOST"

if [[ -n "$PUBLIC_URL" ]]; then
  PUBLIC_HOST="${PUBLIC_URL#https://}"
  PUBLIC_HOST="${PUBLIC_HOST#http://}"
  PUBLIC_HOST="${PUBLIC_HOST%%/*}"
  if [[ -z "$PUBLIC_HOST" ]]; then
    echo "PUBLIC_URL must contain a hostname." >&2
    exit 1
  fi
  set -- "$@" --public-url "$PUBLIC_URL" --trusted-host "$PUBLIC_HOST"
fi

exec "$@"
