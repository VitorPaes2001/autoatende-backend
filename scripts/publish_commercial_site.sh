#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/autoatende"
NGINX_CONTAINER="whatsapp-nginx"
MANAGED_DIR="$ROOT/commercial-site-root"
SOURCE_DIR_FILE="$MANAGED_DIR/.managed-source-path"
DEFAULT_SOURCE_DIR="$ROOT/frontend-site/dist"

if [ -f "$SOURCE_DIR_FILE" ]; then
  SOURCE_DIR="$(cat "$SOURCE_DIR_FILE")"
else
  SOURCE_DIR="$DEFAULT_SOURCE_DIR"
fi

[ -d "$SOURCE_DIR" ] || { echo "ERRO: source dir ausente: $SOURCE_DIR"; exit 1; }
[ -f "$SOURCE_DIR/index.html" ] || { echo "ERRO: source dir sem index.html: $SOURCE_DIR"; exit 1; }

docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER" || {
  echo "ERRO: container $NGINX_CONTAINER não está em execução"
  exit 1
}

INSPECT_JSON="$(mktemp)"
docker inspect "$NGINX_CONTAINER" > "$INSPECT_JSON"

MOUNT_SOURCE="$(python3 - "$INSPECT_JSON" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], 'r', encoding='utf-8'))[0]
mounts = data.get("Mounts", [])
for m in mounts:
    if m.get("Destination") == "/usr/share/nginx/html-root":
        print(m.get("Source",""))
        break
PY
)"
rm -f "$INSPECT_JSON"

REAL_SOURCE="$(readlink -f "$SOURCE_DIR" 2>/dev/null || printf '%s' "$SOURCE_DIR")"
REAL_MOUNT="$(readlink -f "$MOUNT_SOURCE" 2>/dev/null || printf '%s' "$MOUNT_SOURCE")"

if [ -n "$REAL_MOUNT" ] && [ "$REAL_SOURCE" = "$REAL_MOUNT" ]; then
  echo "SOURCE_EQUALS_LIVE_BIND=true"
  echo "SKIP_COPY_VALIDATE_ONLY"
else
  docker exec "$NGINX_CONTAINER" sh -lc 'find /usr/share/nginx/html-root -mindepth 1 -maxdepth 1 -exec rm -rf {} +'
  docker cp "$SOURCE_DIR/." "$NGINX_CONTAINER:/usr/share/nginx/html-root/"
  echo "COPY_PUBLISH_OK"
fi

curl -k -sS --resolve autoatendeai.com.br:443:127.0.0.1 \
  https://autoatendeai.com.br/ \
  -o /tmp/autoatende_root_site_check.html

grep -q "<title>" /tmp/autoatende_root_site_check.html || {
  echo "ERRO: validação do root site falhou após publish"
  exit 1
}

echo "PUBLISH_OK"
