#!/usr/bin/env bash
set -Eeuo pipefail

NGINX_CONTAINER="${NGINX_CONTAINER:-whatsapp-nginx}"
OUT_DIR="${OUT_DIR:-/opt/autoatende/nginx/conf.d/ops-surface}"
DAYS="${DAYS:-7}"

mkdir -p "$OUT_DIR"

docker exec "$NGINX_CONTAINER" sh -lc 'if [ -f /var/log/nginx/site_clicks.log ]; then cat /var/log/nginx/site_clicks.log; fi' \
  > "$OUT_DIR/site_clicks.log" 2>/dev/null || true

python3 - "$OUT_DIR/site_clicks.log" "$OUT_DIR/site-clicks-summary.json" "$DAYS" <<'PY'
import json
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs

log_path = Path(sys.argv[1])
json_path = Path(sys.argv[2])
days = int(sys.argv[3])

request_re = re.compile(r'\[(\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}\s+[+\-]\d{4})\].*?"(?:GET|HEAD)\s+([^"]+)\s+HTTP/[0-9.]+"\s+(\d{3})')
lines = log_path.read_text(encoding="utf-8", errors="ignore").splitlines() if log_path.exists() else []

now = datetime.now(timezone.utc)
cutoff = now - timedelta(days=days)

hits = []
for line in lines:
    m = request_re.search(line)
    if not m:
        continue

    ts_raw, request_target, status = m.groups()
    ts = datetime.strptime(ts_raw, "%d/%b/%Y:%H:%M:%S %z")
    if ts < cutoff:
        continue

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

    if src.startswith("smoke_") or src.startswith("__script_"):
        continue

    hits.append({
        "ts": ts.isoformat(),
        "route": route,
        "src": src,
        "lp": lp,
        "utm_source": utm_source,
        "utm_medium": utm_medium,
        "utm_campaign": utm_campaign,
        "utm_content": utm_content,
        "utm_term": utm_term,
        "refhost": refhost,
        "status": status,
    })

route_counter = Counter()
src_counter = Counter()
lp_counter = Counter()
campaign_counter = Counter()
refhost_counter = Counter()

for h in hits:
    route_counter[h["route"]] += 1
    src_counter[(h["route"], h["src"])] += 1
    lp_counter[(h["route"], h["lp"])] += 1
    if h["utm_campaign"]:
        campaign_counter[(h["route"], h["utm_campaign"])] += 1
    if h["refhost"]:
        refhost_counter[(h["route"], h["refhost"])] += 1

def counter_to_list(counter, label_a, label_b):
    rows = []
    for (a, b), count in sorted(counter.items(), key=lambda x: (-x[1], x[0][0], x[0][1]))[:20]:
        rows.append({label_a: a, label_b: b, "count": count})
    return rows

payload = {
    "generated_at": now.isoformat(),
    "window_days": days,
    "totals": {
        "all_clicks": len(hits),
        "whatsapp": route_counter.get("whatsapp", 0),
        "app": route_counter.get("app", 0),
    },
    "top_sources": counter_to_list(src_counter, "route", "src"),
    "top_landing_pages": counter_to_list(lp_counter, "route", "lp"),
    "top_campaigns": counter_to_list(campaign_counter, "route", "utm_campaign"),
    "top_refhosts": counter_to_list(refhost_counter, "route", "refhost"),
    "recent_events": hits[-20:],
}

json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(payload, ensure_ascii=False, indent=2))
PY

cat > "$OUT_DIR/index.html" <<'HTML'
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AutoAtendeAI | Ops Surface</title>
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root {
      --bg: #08140f;
      --panel: rgba(255,255,255,0.05);
      --border: rgba(102,244,168,0.14);
      --text: #f7fafc;
      --muted: #bfd0c4;
      --accent: #5cf0ae;
      --accent2: #93ff7e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(92,240,174,0.15), transparent 22%),
        linear-gradient(180deg, #08140f 0%, #0a1015 100%);
      color: var(--text);
    }
    .wrap {
      width: min(1200px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    h1, h2 { margin: 0; }
    .top {
      display: grid;
      gap: 10px;
      margin-bottom: 24px;
    }
    .top p {
      margin: 0;
      color: var(--muted);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .card, .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
    }
    .card strong {
      display: block;
      font-size: 2rem;
      color: white;
      margin-top: 8px;
    }
    .label {
      color: var(--muted);
      font-size: .92rem;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: .94rem;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      vertical-align: top;
    }
    th { color: var(--accent2); font-weight: 700; }
    td { color: var(--muted); }
    .muted { color: var(--muted); }
    .empty {
      color: var(--muted);
      margin-top: 12px;
    }
    @media (max-width: 900px) {
      .cards, .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <h1>Ops Surface — Aquisição do Site</h1>
      <p>Leitura operacional dos cliques comerciais do site AutoAtendeAI.</p>
      <p class="muted" id="meta">Carregando...</p>
    </div>

    <div class="cards" id="cards"></div>

    <div class="grid">
      <div class="panel">
        <h2>Top origens (src)</h2>
        <div id="topSources"></div>
      </div>
      <div class="panel">
        <h2>Top landing pages</h2>
        <div id="topLPs"></div>
      </div>
      <div class="panel">
        <h2>Top campanhas</h2>
        <div id="topCampaigns"></div>
      </div>
      <div class="panel">
        <h2>Top refhosts</h2>
        <div id="topRefhosts"></div>
      </div>
    </div>
  </div>

  <script>
    function renderTable(containerId, rows, columns, emptyText) {
      const el = document.getElementById(containerId)
      if (!rows || !rows.length) {
        el.innerHTML = `<p class="empty">${emptyText}</p>`
        return
      }
      const head = columns.map(c => `<th>${c.label}</th>`).join('')
      const body = rows.map(row => {
        const tds = columns.map(c => `<td>${row[c.key] ?? ''}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('')
      el.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
    }

    async function boot() {
      const res = await fetch('./site-clicks-summary.json', { cache: 'no-store' })
      const data = await res.json()

      document.getElementById('meta').textContent =
        `Janela: últimos ${data.window_days} dias • Gerado em: ${new Date(data.generated_at).toLocaleString('pt-BR')}`

      document.getElementById('cards').innerHTML = `
        <div class="card"><div class="label">Cliques totais</div><strong>${data.totals.all_clicks}</strong></div>
        <div class="card"><div class="label">Cliques para WhatsApp</div><strong>${data.totals.whatsapp}</strong></div>
        <div class="card"><div class="label">Cliques para App</div><strong>${data.totals.app}</strong></div>
      `

      renderTable('topSources', data.top_sources, [
        { key: 'route', label: 'Rota' },
        { key: 'src', label: 'Origem' },
        { key: 'count', label: 'Cliques' }
      ], 'Nenhum clique real encontrado ainda.')

      renderTable('topLPs', data.top_landing_pages, [
        { key: 'route', label: 'Rota' },
        { key: 'lp', label: 'Landing page' },
        { key: 'count', label: 'Cliques' }
      ], 'Nenhuma landing page encontrada ainda.')

      renderTable('topCampaigns', data.top_campaigns, [
        { key: 'route', label: 'Rota' },
        { key: 'utm_campaign', label: 'Campanha' },
        { key: 'count', label: 'Cliques' }
      ], 'Nenhuma utm_campaign encontrada ainda.')

      renderTable('topRefhosts', data.top_refhosts, [
        { key: 'route', label: 'Rota' },
        { key: 'refhost', label: 'Refhost' },
        { key: 'count', label: 'Cliques' }
      ], 'Nenhum refhost encontrado ainda.')
    }

    boot().catch(err => {
      document.getElementById('meta').textContent = 'Falha ao carregar snapshot.'
      console.error(err)
    })
  </script>
</body>
</html>
HTML

echo
echo "OUT_DIR=$OUT_DIR"
echo "JSON=$OUT_DIR/site-clicks-summary.json"
echo "HTML=$OUT_DIR/index.html"
