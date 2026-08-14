#!/usr/bin/env bash
set -Eeuo pipefail

if command -v shopt >/dev/null 2>&1; then
  shopt -s inherit_errexit 2>/dev/null || true
fi

aa_log() {
  printf '%s\n' "$*"
}

aa_restore_and_exit() {
  local rc="${1:-1}"
  trap - ERR

  set +e
  if declare -F restore_on_error >/dev/null 2>&1; then
    restore_on_error || true
  fi
  exit "$rc"
}

aa_arm_err_trap() {
  trap 'rc=$?; aa_restore_and_exit "$rc"' ERR
}

aa_require_file_contains() {
  local file="$1"
  local pattern="$2"
  grep -qE "$pattern" "$file"
}

aa_require_path_exists() {
  local path="$1"
  test -e "$path"
}

aa_http_status() {
  local url="$1"
  shift || true
  curl -ksS -o /dev/null -w '%{http_code}' "$@" "$url"
}

aa_http_must_be_2xx() {
  local url="$1"
  shift || true
  local code
  code="$(curl -ksS -o /dev/null -w '%{http_code}' "$@" "$url")"
  case "$code" in
    2??) return 0 ;;
    *)
      aa_log "HTTP_GATE_FAILED code=$code url=$url"
      return 1
      ;;
  esac
}

aa_http_dump_headers() {
  local url="$1"
  shift || true
  curl -kIsS "$@" "$url"
}
