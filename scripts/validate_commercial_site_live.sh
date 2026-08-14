#!/usr/bin/env bash
set -Eeuo pipefail

TMP_HTML="$(mktemp)"
curl -k -sS --resolve autoatendeai.com.br:443:127.0.0.1 \
  https://autoatendeai.com.br/ \
  -o "$TMP_HTML"

grep -q "<title>" "$TMP_HTML" || { echo "ERRO: title ausente no root site"; exit 1; }
grep -q "AutoAtendeAI" "$TMP_HTML" || { echo "ERRO: marca AutoAtendeAI não encontrada no HTML root"; exit 1; }

echo "VALIDATION_OK"
