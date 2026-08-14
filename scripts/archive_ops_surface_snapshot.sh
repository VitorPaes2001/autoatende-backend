#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="/opt/autoatende"
OPS_DIR="${PROJECT_ROOT}/nginx/conf.d/ops-surface"
SNAPSHOT_PATH="${OPS_DIR}/site-clicks-summary.json"
HISTORY_DIR="${OPS_DIR}/history"
MANIFEST_PATH="${HISTORY_DIR}/manifest.json"
LATEST_LINK="${HISTORY_DIR}/latest.json"

mkdir -p "${HISTORY_DIR}"

if [[ ! -f "${SNAPSHOT_PATH}" ]]; then
  echo "[archive_ops_surface_snapshot] snapshot inexistente: ${SNAPSHOT_PATH}" >&2
  exit 1
fi

STAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_FILE="${HISTORY_DIR}/site-clicks-summary.${STAMP_UTC}.json"
TMP_MANIFEST="$(mktemp)"

cp -f "${SNAPSHOT_PATH}" "${TARGET_FILE}"
ln -sfn "${TARGET_FILE}" "${LATEST_LINK}"

python3 <<PY
from pathlib import Path
import hashlib
import json

snapshot = Path("${TARGET_FILE}")
manifest = Path("${MANIFEST_PATH}")

raw = snapshot.read_text(encoding="utf-8", errors="replace")
size = snapshot.stat().st_size
sha = hashlib.sha256(snapshot.read_bytes()).hexdigest()

entry = {
    "timestamp_utc": "${STAMP_UTC}",
    "file": snapshot.name,
    "size_bytes": size,
    "sha256": sha
}

existing = []
if manifest.exists():
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        if isinstance(data, list):
            existing = data
    except Exception:
        existing = []

existing = [e for e in existing if isinstance(e, dict) and e.get("file") != entry["file"]]
existing.append(entry)
existing = sorted(existing, key=lambda x: x.get("timestamp_utc", ""))
manifest.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
PY

echo "[archive_ops_surface_snapshot] archived=${TARGET_FILE}"
