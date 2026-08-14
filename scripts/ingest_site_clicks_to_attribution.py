#!/usr/bin/env python3
import os
import re
import json
import hashlib
import subprocess
import urllib.parse
import urllib.request
import urllib.error
from collections import deque

PROJECT_ROOT = "/opt/autoatende"
ROOT_ENV = os.path.join(PROJECT_ROOT, ".env")
TABLE_NAME = "acquisition_attribution_events"
NGINX_CONTAINER = os.environ.get("NGINX_CONTAINER", "whatsapp-nginx")

TAIL_LINES = int(os.environ.get("TAIL_LINES", "2000"))
QUERY_CHUNK = int(os.environ.get("QUERY_CHUNK", "50"))
INSERT_BATCH = int(os.environ.get("INSERT_BATCH", "200"))

HOST_LOG_CANDIDATES = [
    "/opt/autoatende/nginx/conf.d/ops-surface/site_clicks.log",
    "/opt/autoatende/nginx/conf.d/ops-surface/site-clicks.log",
    "/var/log/nginx/site_clicks.log",
    "/var/log/nginx/site-clicks.log",
]

CONTAINER_LOG_CANDIDATES = [
    "/opt/autoatende/nginx/conf.d/ops-surface/site_clicks.log",
    "/opt/autoatende/nginx/conf.d/ops-surface/site-clicks.log",
    "/var/log/nginx/site_clicks.log",
    "/var/log/nginx/site-clicks.log",
]

REQUEST_RE = re.compile(r'"(?P<method>[A-Z]+)\s+(?P<target>[^\s"]+)\s+HTTP/[0-9.]+"')
REQUEST_ALT_RE = re.compile(r'request="?([A-Z]+)\s+([^"\s]+)')

# __AUTOATENDE_C13D_R9C_C_FIX1_INGEST_SITE_CLICKS__

def load_env_file(path: str) -> dict:
    data = {}
    if not os.path.isfile(path):
        return data
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            data[key.strip()] = value.strip().strip('"').strip("'")
    return data

def resolve_secret(key: str) -> str:
    env_file = load_env_file(ROOT_ENV)
    if env_file.get(key):
        return env_file[key]
    if os.environ.get(key):
        return os.environ[key]
    return ""

def run_cmd(args):
    return subprocess.run(args, check=False, capture_output=True, text=True)

def read_container_file(path: str) -> list[str]:
    result = run_cmd(["docker", "exec", NGINX_CONTAINER, "sh", "-lc", f"test -f {path} && cat {path} || true"])
    if result.returncode != 0:
        return []
    lines = [line.rstrip("\n") for line in (result.stdout or "").splitlines() if line.strip()]
    return lines

def resolve_log_lines(limit: int):
    best_lines = []
    best_path = None
    best_source = "missing"

    for path in HOST_LOG_CANDIDATES:
        if os.path.isfile(path):
            dq = deque(maxlen=limit)
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.rstrip("\n")
                    if line.strip():
                        dq.append(line)
            lines = list(dq)
            if lines and len(lines) > len(best_lines):
                best_lines = lines
                best_path = path
                best_source = "host"

    for path in CONTAINER_LOG_CANDIDATES:
        lines = read_container_file(path)
        if lines and len(lines) > len(best_lines):
            best_lines = lines[-limit:]
            best_path = path
            best_source = "container"

    if best_path:
        return best_lines, best_path, best_source

    return [], None, "missing"

def first_param(params: dict, name: str, default=None):
    values = params.get(name)
    if not values:
        return default
    return values[0]

def parse_line(raw_line: str):
    raw_line = raw_line.strip()
    if not raw_line:
        return None

    parsed_json = None
    if raw_line.startswith("{") and raw_line.endswith("}"):
        try:
            parsed_json = json.loads(raw_line)
        except Exception:
            parsed_json = None

    method = None
    target = None

    if isinstance(parsed_json, dict):
        method = parsed_json.get("method")
        target = parsed_json.get("target") or parsed_json.get("request") or parsed_json.get("uri")
    else:
        match = REQUEST_RE.search(raw_line)
        if match:
            method = match.group("method")
            target = match.group("target")
        else:
            alt = REQUEST_ALT_RE.search(raw_line)
            if alt:
                method = alt.group(1)
                target = alt.group(2)

    if not target:
        return None

    url_bits = urllib.parse.urlsplit(target)
    params = urllib.parse.parse_qs(url_bits.query, keep_blank_values=True)
    tracking_key = hashlib.sha256(raw_line.encode("utf-8")).hexdigest()

    return {
        "event_type": "site_click",
        "source_surface": "site_click_log_ingest",
        "tracking_key": tracking_key,
        "session_key": first_param(params, "session_key") or first_param(params, "sid"),
        "click_id": first_param(params, "click_id") or first_param(params, "gclid") or first_param(params, "fbclid") or first_param(params, "ttclid"),
        "src": first_param(params, "src"),
        "lp": first_param(params, "lp"),
        "utm_source": first_param(params, "utm_source"),
        "utm_medium": first_param(params, "utm_medium"),
        "utm_campaign": first_param(params, "utm_campaign"),
        "utm_content": first_param(params, "utm_content"),
        "utm_term": first_param(params, "utm_term"),
        "refhost": first_param(params, "refhost"),
        "target_path": url_bits.path or None,
        "target_url": target,
        "request_path": url_bits.path or None,
        "request_host": None,
        "request_query": url_bits.query or None,
        "lead_email": first_param(params, "email"),
        "lead_phone": first_param(params, "phone"),
        "lead_name": first_param(params, "name"),
        "raw_payload": {
            "raw_line": raw_line,
            "method": method,
            "target": target,
            "path": url_bits.path,
            "query": {k: (v[0] if len(v) == 1 else v) for k, v in params.items()},
            "parser": "AUTOATENDE_R9C_C_FIX1",
        },
    }

def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]

class SupabaseRest:
    def __init__(self, base_url: str, service_role_key: str):
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key

    def _request(self, method: str, path: str, params=None, body=None, extra_headers=None):
        url = f"{self.base_url}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params, doseq=True)

        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }
        if extra_headers:
            headers.update(extra_headers)

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                if not raw:
                    return None
                try:
                    return json.loads(raw)
                except Exception:
                    return raw
        except urllib.error.HTTPError as e:
            payload = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {e.code}: {payload}")
        except Exception as e:
            raise RuntimeError(str(e))

    def fetch_existing_tracking_keys(self, keys: list[str]) -> set[str]:
        existing = set()
        for chunk in chunked(keys, QUERY_CHUNK):
            if not chunk:
                continue
            clause = "in.(" + ",".join(chunk) + ")"
            rows = self._request(
                "GET",
                f"/rest/v1/{TABLE_NAME}",
                params={
                    "select": "tracking_key",
                    "tracking_key": clause,
                },
            )
            if isinstance(rows, list):
                for row in rows:
                    if isinstance(row, dict) and row.get("tracking_key"):
                        existing.add(row["tracking_key"])
        return existing

    def insert_rows(self, rows: list[dict]) -> int:
        inserted = 0
        for batch in chunked(rows, INSERT_BATCH):
            if not batch:
                continue
            self._request(
                "POST",
                f"/rest/v1/{TABLE_NAME}",
                body=batch,
                extra_headers={"Prefer": "return=minimal"},
            )
            inserted += len(batch)
        return inserted

def main():
    supabase_url = resolve_secret("SUPABASE_URL")
    service_role_key = resolve_secret("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise SystemExit("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found")

    raw_lines, log_path, log_source = resolve_log_lines(TAIL_LINES)
    if not log_path:
        raise SystemExit("No site_clicks log found in host or container candidates")

    parsed_rows = []
    for line in raw_lines:
        parsed = parse_line(line)
        if parsed:
            parsed_rows.append(parsed)

    if not parsed_rows:
        print(json.dumps({
            "ok": True,
            "status": "no_rows_parsed",
            "log_path": log_path,
            "log_source": log_source,
            "tail_lines": len(raw_lines),
            "parsed_rows": 0,
            "deduped_rows": 0,
            "existing_rows": 0,
            "inserted_rows": 0,
            "skipped_existing": 0,
        }, ensure_ascii=False))
        return

    unique_rows = {}
    for row in parsed_rows:
        unique_rows[row["tracking_key"]] = row
    deduped_rows = list(unique_rows.values())

    rest = SupabaseRest(supabase_url, service_role_key)
    existing_keys = rest.fetch_existing_tracking_keys(list(unique_rows.keys()))
    missing_rows = [row for row in deduped_rows if row["tracking_key"] not in existing_keys]

    inserted_rows = 0
    if missing_rows:
        inserted_rows = rest.insert_rows(missing_rows)

    print(json.dumps({
        "ok": True,
        "status": "ingest_completed",
        "log_path": log_path,
        "log_source": log_source,
        "tail_lines": len(raw_lines),
        "parsed_rows": len(parsed_rows),
        "deduped_rows": len(deduped_rows),
        "existing_rows": len(existing_keys),
        "inserted_rows": inserted_rows,
        "skipped_existing": len(existing_keys),
        "sample_tracking_key": deduped_rows[0]["tracking_key"] if deduped_rows else None,
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
