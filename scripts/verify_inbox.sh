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

echo "[1/6] GET /api/inbox/conversations"
CONV_RESP=$(curl -sS -X GET "${BASE_URL}/api/inbox/conversations" -H "$AUTH_HEADER")
echo "$CONV_RESP"

CONV_ID=$(printf '%s' "$CONV_RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const arr=Array.isArray(j)?j:(j.data||j.conversations||[]);process.stdout.write(String(arr?.[0]?.id||''));}catch(e){process.stdout.write('');}})")

if [[ -z "$CONV_ID" ]]; then
  echo "Nenhuma conversa encontrada para validar thread/send/assign/mode."
  exit 1
fi

echo "Conversa alvo: $CONV_ID"

echo "[2/6] GET /api/inbox/conversations/:id/messages (antes)"
BEFORE_MSGS=$(curl -sS -X GET "${BASE_URL}/api/inbox/conversations/${CONV_ID}/messages" -H "$AUTH_HEADER")
echo "$BEFORE_MSGS"
echo ""

TEST_MARKER="[verify_inbox][$(date +%s)] mensagem manual de teste"

echo "[3/6] POST /api/inbox/conversations/:id/messages"
POST_RESP=$(curl -sS -X POST "${BASE_URL}/api/inbox/conversations/${CONV_ID}/messages" \
  -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d "{\"text\":\"${TEST_MARKER}\"}")
echo "$POST_RESP"
echo ""

echo "[4/6] GET /api/inbox/conversations/:id/messages (depois)"
AFTER_MSGS=$(curl -sS -X GET "${BASE_URL}/api/inbox/conversations/${CONV_ID}/messages" -H "$AUTH_HEADER")
echo "$AFTER_MSGS"
echo ""

FOUND_MARKER=$(printf '%s' "$AFTER_MSGS" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const arr=Array.isArray(j)?j:(j.data||j.messages||[]);const needle=process.argv[1];const found=(arr||[]).some(m=>String(m?.body||m?.content||'').includes(needle));process.stdout.write(found?'1':'0');}catch(e){process.stdout.write('0');}})" "$TEST_MARKER")
if [[ "$FOUND_MARKER" != "1" ]]; then
  echo "Falha: mensagem enviada nao encontrada na leitura da thread."
  exit 1
fi
echo "OK: mensagem inserida/lida com JWT."

echo "[5/6] POST /api/inbox/conversations/:id/assign"
curl -sS -X POST "${BASE_URL}/api/inbox/conversations/${CONV_ID}/assign" \
  -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d '{"agent_id":"agent_default"}'
echo ""

echo "[6/6] POST /api/inbox/conversations/:id/mode"
curl -sS -X POST "${BASE_URL}/api/inbox/conversations/${CONV_ID}/mode" \
  -H "$AUTH_HEADER" -H "$JSON_HEADER" \
  -d '{"mode":"bot"}'
echo ""

echo "Validação Inbox v1 finalizada."
