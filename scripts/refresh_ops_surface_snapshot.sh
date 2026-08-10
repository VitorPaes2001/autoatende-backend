#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="/opt/autoatende"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
SNAPSHOT_SCRIPT="$SCRIPTS_DIR/build_site_clicks_snapshot.sh"
OPS_DIR="$PROJECT_ROOT/nginx/conf.d/ops-surface"
NGINX_CONTAINER="${NGINX_CONTAINER:-whatsapp-nginx}"
DAYS="${DAYS:-7}"

LOG_DIR="$PROJECT_ROOT/backups/ops_surface_refresh_logs"
mkdir -p "$LOG_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
RUN_LOG="$LOG_DIR/refresh_${TS}.log"

{
  echo "[OPS_SURFACE_REFRESH] START ts=$TS"
  echo "[OPS_SURFACE_REFRESH] OPS_DIR=$OPS_DIR"
  echo "[OPS_SURFACE_REFRESH] SNAPSHOT_SCRIPT=$SNAPSHOT_SCRIPT"
  echo "[OPS_SURFACE_REFRESH] NGINX_CONTAINER=$NGINX_CONTAINER"
  echo "[OPS_SURFACE_REFRESH] DAYS=$DAYS"

  OUT_DIR="$OPS_DIR" DAYS="$DAYS" NGINX_CONTAINER="$NGINX_CONTAINER" "$SNAPSHOT_SCRIPT"

  echo "[OPS_SURFACE_REFRESH] JSON_MTIME=$(stat -c %y "$OPS_DIR/site-clicks-summary.json")"
  echo "[OPS_SURFACE_REFRESH] END"
} >> "$RUN_LOG" 2>&1

# __AUTOATENDE_C13D_R8B_ARCHIVE_HOOK__
ARCHIVE_SCRIPT="/opt/autoatende/scripts/archive_ops_surface_snapshot.sh"
if [[ -x "${ARCHIVE_SCRIPT}" ]]; then
  "${ARCHIVE_SCRIPT}" >> /tmp/autoatende_ops_surface_archive.log 2>&1 || true
fi

# __AUTOATENDE_C13D_R9C_C_INGEST_HOOK__
INGEST_SCRIPT="/opt/autoatende/scripts/ingest_site_clicks_to_attribution.py"
if [[ -x "${INGEST_SCRIPT}" ]]; then
  TAIL_LINES="${TAIL_LINES:-2000}" NGINX_CONTAINER="${NGINX_CONTAINER:-whatsapp-nginx}" \
    "${INGEST_SCRIPT}" >> /tmp/autoatende_site_clicks_ingest.log 2>&1 || true
fi
