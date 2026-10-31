#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/deepseek-harness-source" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24.9+ is required. Install it from https://nodejs.org/"
  exit 1
fi
if ! command -v corepack >/dev/null 2>&1; then
  echo "Corepack is required and is included with modern Node.js."
  exit 1
fi

node -e 'const [a,b]=process.versions.node.split(".").map(Number); if (a < 24 || (a === 24 && b < 9)) { console.error("Node.js 24.9+ is required; found " + process.version); process.exit(1); }'
corepack enable
corepack prepare pnpm@11.28.5 --activate
pnpm install
pnpm run build

export DSH_HOME="${DSH_HOME:-$ROOT/.dsh-home}"
exec pnpm dsh web --no-open --host 127.0.0.1 --port "${PORT:-3080}"
