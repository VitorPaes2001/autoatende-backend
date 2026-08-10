#!/usr/bin/env bash
set -Eeuo pipefail

SNAPSHOT_DIR="${1:-}"
NGINX_CONTAINER="whatsapp-nginx"

[ -n "$SNAPSHOT_DIR" ] || { echo "Uso: restore_commercial_site_from_snapshot.sh <snapshot_dir>"; exit 1; }
[ -d "$SNAPSHOT_DIR" ] || { echo "ERRO: snapshot dir ausente: $SNAPSHOT_DIR"; exit 1; }
[ -f "$SNAPSHOT_DIR/index.html" ] || { echo "ERRO: snapshot dir sem index.html"; exit 1; }

docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER" || {
  echo "ERRO: container $NGINX_CONTAINER não está em execução"
  exit 1
}

docker exec "$NGINX_CONTAINER" sh -lc 'find /usr/share/nginx/html-root -mindepth 1 -maxdepth 1 -exec rm -rf {} +'
docker cp "$SNAPSHOT_DIR/." "$NGINX_CONTAINER:/usr/share/nginx/html-root/"

echo "RESTORE_OK"
