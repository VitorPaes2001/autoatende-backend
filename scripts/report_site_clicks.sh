#!/usr/bin/env bash
set -Eeuo pipefail

NGINX_CONTAINER="${NGINX_CONTAINER:-whatsapp-nginx}"
OUT_DIR="${OUT_DIR:-/tmp/site_click_report_$(date +%Y%m%d_%H%M%S)}"
INCLUDE_SMOKE="${INCLUDE_SMOKE:-false}"

mkdir -p "$OUT_DIR"

docker exec "$NGINX_CONTAINER" sh -lc 'if [ -f /var/log/nginx/site_clicks.log ]; then cat /var/log/nginx/site_clicks.log; fi' \
  > "$OUT_DIR/site_clicks.log" 2>/dev/null || true

docker exec "$NGINX_CONTAINER" sh -lc 'if [ -f /var/log/nginx/access.log ]; then tail -n 300 /var/log/nginx/access.log; fi' \
  > "$OUT_DIR/access_tail_debug.log" 2>/dev/null || true

python3 - "$OUT_DIR/site_clicks.log" "$OUT_DIR/tracking_report.txt" "$OUT_DIR/tracking_report.csv" "$INCLUDE_SMOKE" <<'PY'
import csv
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse, parse_qs

log_path = Path(sys.argv[1])
report_txt = Path(sys.argv[2])
report_csv = Path(sys.argv[3])
include_smoke = sys.argv[4].lower() == "true"

request_re = re.compile(r'"(?:GET|HEAD)\s+([^"]+)\s+HTTP/[0-9.]+"\s+(\d{3})')
lines = []
if log_path.exists():
    lines = log_path.read_text(encoding="utf-8", errors="ignore").splitlines()

hits = []
for line in lines:
    m = request_re.search(line)
    if not m:
        continue

    request_target = m.group(1)
    status = m.group(2)

    parsed = urlparse(request_target)
    qs = parse_qs(parsed.query)

    route = "whatsapp" if "/go/whatsapp/" in parsed.path else "app"
    src = qs.get("src", ["unknown"])[0]
    lp = qs.get("lp", ["unknown"])[0]
    utm_source = qs.get("utm_source", [""])[0]
    utm_medium = qs.get("utm_medium", [""])[0]
    utm_campaign = qs.get("utm_campaign", [""])[0]
    utm_content = qs.get("utm_content", [""])[0]
    utm_term = qs.get("utm_term", [""])[0]
    refhost = qs.get("refhost", [""])[0]

    if src.startswith("__script_"):
        continue
    if src.startswith("smoke_") and not include_smoke:
        continue

    hits.append((route, src, lp, utm_source, utm_medium, utm_campaign, utm_content, utm_term, refhost, status))

counter = Counter(hits)

with report_txt.open("w", encoding="utf-8") as f:
    f.write("AUTOATENDEAI - DEDICATED SITE CLICKS REPORT\n")
    f.write("===========================================\n\n")
    f.write(f"INCLUDE_SMOKE={include_smoke}\n\n")
    if not hits:
        f.write("Nenhum clique encontrado para o filtro atual.\n")
    else:
        for (route, src, lp, utm_source, utm_medium, utm_campaign, utm_content, utm_term, refhost, status), count in sorted(counter.items(), key=lambda x: (-x[1], x[0][0], x[0][1])):
            f.write(
                f"route={route} | src={src} | lp={lp} | utm_source={utm_source} | "
                f"utm_medium={utm_medium} | utm_campaign={utm_campaign} | utm_content={utm_content} | "
                f"utm_term={utm_term} | refhost={refhost} | status={status} | count={count}\n"
            )

with report_csv.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["route","src","lp","utm_source","utm_medium","utm_campaign","utm_content","utm_term","refhost","status","count"])
    for row, count in sorted(counter.items(), key=lambda x: (-x[1], x[0][0], x[0][1])):
        writer.writerow([*row, count])

print(report_txt.read_text(encoding="utf-8"), end="")
PY

echo
echo "OUT_DIR=$OUT_DIR"
echo "SITECLICKS_LOG=$OUT_DIR/site_clicks.log"
echo "REPORT_TXT=$OUT_DIR/tracking_report.txt"
echo "REPORT_CSV=$OUT_DIR/tracking_report.csv"
