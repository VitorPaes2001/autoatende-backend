#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/autoatende"
MANAGED_DIR="$ROOT/commercial-site-root"
PROJECT_ROOT_FILE="$MANAGED_DIR/.managed-project-root"

if [ -f "$PROJECT_ROOT_FILE" ]; then
  PROJECT_ROOT="$(cat "$PROJECT_ROOT_FILE")"
else
  PROJECT_ROOT="$ROOT/frontend-site"
fi

[ -d "$PROJECT_ROOT" ] || { echo "ERRO: project root ausente: $PROJECT_ROOT"; exit 1; }
[ -f "$PROJECT_ROOT/package.json" ] || { echo "ERRO: package.json ausente em $PROJECT_ROOT"; exit 1; }
[ -f "$PROJECT_ROOT/package-lock.json" ] || { echo "ERRO: package-lock.json ausente em $PROJECT_ROOT"; exit 1; }

docker run --rm \
  -v "$PROJECT_ROOT:/app" \
  -w /app \
  node:20-bullseye \
  bash -lc '
    set -Eeuo pipefail
    rm -rf node_modules
    npm ci
    npm run build
  '

[ -f "$PROJECT_ROOT/dist/index.html" ] || { echo "ERRO: build não gerou dist/index.html"; exit 1; }

echo "BUILD_OK"
