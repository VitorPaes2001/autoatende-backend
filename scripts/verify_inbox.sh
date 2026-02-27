#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASE_URL:-}" ]]; then
  echo "BASE_URL não definido. Ex: BASE_URL=https://api.autoatendeai.com.br"
  exit 1
fi

if [[ -z "${JWT_TOKEN:-}" ]]; then
  echo "JWT_TOKEN não definido. Ex: JWT_TOKEN=<token_jwt_supabase>"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${JWT_TOKEN}"
JSON_HEADER="Content-Type: application/json"

echo "[1/5] GET /api/inbox/conversations"
CONV_RESP=$(curl -sS -X GET "${BASE_URL}/api/inbox/conversations" -H "$AUTH_HEADER")
echo "$CONV_RESP"

CONV_ID=$(printf '%s' "$CONV_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const arr=Array.isArray(j)?j:(j.data||j.conversations||[]);process.stdout.write(String(arr?.[0]?.id||''));}catch(e){process.stdout.write('');}})")

if [[ -z "$CONV_ID" ]]; then
  echo "Nenhuma conversa encontrada para validar thread/send/assign/mode."
  exit 0
fi

echo "Conversa alvo: $CONV_ID"

echo "[2/5] GET /api/inbox/conversations/:id/messages"
curl -sS -X GET "${BASE_URL}/api/inbox/conversations/${CONV_ID}/messages" -H "$AUTH_HEADER"
echo ""

echo "[3/5] POST /api/inbox/conversations/:id/messages"
curl -sS -X POST "${BASE_URL}/api/inbox/conversations/${CONV_ID}/messages" \
  -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d '{"text":"[verify_inbox] mensagem manual de teste"}'
echo ""

echo "[4/5] POST /api/inbox/conversations/:id/assign"
curl -sS -X POST "${BASE_URL}/api/inbox/conversations/${CONV_ID}/assign" \
  -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d '{"agent_id":"agent_default"}'
echo ""

echo "[5/5] POST /api/inbox/conversations/:id/mode"
curl -sS -X POST "${BASE_URL}/api/inbox/conversations/${CONV_ID}/mode" \
  -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d '{"mode":"bot"}'
echo ""

echo "Validação Inbox v1 finalizada."
