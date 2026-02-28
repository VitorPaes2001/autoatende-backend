#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000}"
JWT_TOKEN="${JWT_TOKEN:-}"
CONVERSATION_ID="${CONVERSATION_ID:-}"

if [ -z "$JWT_TOKEN" ]; then
  echo "ERROR: JWT_TOKEN is required"
  exit 1
fi

TMP="$(mktemp -t inbox.XXXXXX)"
cleanup() { rm -f "$TMP" >/dev/null 2>&1 || true; }
trap cleanup EXIT

req() {
  method="$1"
  url="$2"
  payload="${3:-}"

  if [ "$method" = "GET" ]; then
    code="$(curl -sS -o "$TMP" -w "%{http_code}" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      "$url")"
  else
    code="$(curl -sS -o "$TMP" -w "%{http_code}" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -X "$method" -d "$payload" \
      "$url")"
  fi

  echo "$code"
}

first_id() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$TMP" <<'PY'
import json,sys
p=sys.argv[1]
try:
  arr=json.load(open(p,'r',encoding='utf-8'))
  if isinstance(arr,list) and arr:
    print(arr[0].get("id",""))
except Exception:
  print("")
PY
  elif command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs"); try{const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log((a&&a[0]&&a[0].id)||"");}catch(e){console.log("");}' "$TMP"
  else
    grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]+"' "$TMP" | head -n1 | sed -E 's/.*"([^"]+)".*/\1/' || true
  fi
}

echo "[1/3] GET /api/inbox/conversations"
c="$(req GET "$BASE_URL/api/inbox/conversations")"
echo "HTTP $c"
head -c 400 "$TMP"; echo
[ "$c" = "200" ] || exit 1

if [ -z "$CONVERSATION_ID" ]; then
  CONVERSATION_ID="$(first_id)"
fi

if [ -z "$CONVERSATION_ID" ]; then
  echo "OK: no conversations yet. Send a WhatsApp message to create one, then rerun with CONVERSATION_ID=<uuid>."
  exit 0
fi

echo "[2/3] GET /api/inbox/conversations/$CONVERSATION_ID/messages"
c="$(req GET "$BASE_URL/api/inbox/conversations/$CONVERSATION_ID/messages")"
echo "HTTP $c"
head -c 400 "$TMP"; echo
[ "$c" = "200" ] || exit 1

echo "[3/3] POST /api/inbox/conversations/$CONVERSATION_ID/messages"
payload="$(printf '{"text":"verify_inbox ping %s"}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)")"
c="$(req POST "$BASE_URL/api/inbox/conversations/$CONVERSATION_ID/messages" "$payload")"
echo "HTTP $c"
cat "$TMP"; echo
[ "$c" = "200" ] || [ "$c" = "201" ]
