#!/usr/bin/env bash
set -euo pipefail

FILE="src/services/company.service.js"

echo "[patch] Checking: $FILE"
test -f "$FILE" || { echo "[patch] ERROR: file not found: $FILE"; exit 1; }

# Confere se o símbolo existe (pode ser 'async function' ou 'const getActivePlan =')
if ! grep -Eq "getActivePlan" "$FILE"; then
  echo "[patch] ERROR: getActivePlan symbol not found inside $FILE"
  echo "[patch] Tip: run: grep -n \"getActivePlan\" $FILE | head"
  exit 1
fi

# Se já exporta, sai sem mexer
if grep -Eq "module\.exports\.getActivePlan|exports\.getActivePlan" "$FILE"; then
  echo "[patch] OK: getActivePlan export already present"
  exit 0
fi

# Anexa export seguro no final (não altera a estrutura atual do module.exports)
cat >> "$FILE" <<'PATCH'

// --- runtime export patch (backward-compat): ensure callers can do companyService.getActivePlan(...) ---
try {
  module.exports.getActivePlan = getActivePlan;
} catch (e) {
  // no-op
}
PATCH

echo "[patch] DONE: appended module.exports.getActivePlan"
