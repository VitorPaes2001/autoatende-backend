const supabase = require("../config/supabase");

const TABLE = "acquisition_attribution_events";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const LOOKBACK_DAYS = 30;
const SERVICE_MARKER = "__AUTOATENDE_R10E_A_READ_SERVICE__";

function toBoolean(value) {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  return false;
}

function normalizeLimit(value) {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function normalizeScope({ companyId, onlyBound, onlyUnbound, allowGlobalUnbound }) {
  if (onlyBound && onlyUnbound) throw new Error("INVALID_BOUND_FILTER_COMBINATION");

  if (allowGlobalUnbound && onlyUnbound) {
    return { mode: "global_unbound", companyId: null };
  }

  if (!companyId) throw new Error("MISSING_COMPANY_SCOPE");

  return {
    mode: onlyBound ? "company_bound_only" : "company_recent",
    companyId
  };
}

function bindStatusFromRow(row = {}) {
  return row.company_id || row.client_id || row.user_id ? "bound" : "unbound";
}

async function listRecentAcquisitionEvents({
  companyId = null,
  limit = DEFAULT_LIMIT,
  onlyBound = false,
  onlyUnbound = false,
  allowGlobalUnbound = false
}) {
  const normalizedLimit = normalizeLimit(limit);
  const scope = normalizeScope({
    companyId,
    onlyBound: toBoolean(onlyBound),
    onlyUnbound: toBoolean(onlyUnbound),
    allowGlobalUnbound: toBoolean(allowGlobalUnbound)
  });

  const lookbackIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from(TABLE)
    .select(`
      id,
      created_at,
      occurred_at,
      event_type,
      source_surface,
      tracking_key,
      session_key,
      click_id,
      src,
      lp,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      refhost,
      target_path,
      target_url,
      request_path,
      request_host,
      lead_email,
      lead_phone,
      lead_name,
      company_id,
      client_id,
      user_id
    `)
    .gte("created_at", lookbackIso)
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (scope.mode === "company_recent" || scope.mode === "company_bound_only") {
    query = query.eq("company_id", scope.companyId);
  }

  if (scope.mode === "global_unbound") {
    query = query.is("company_id", null).is("client_id", null).is("user_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map((row) => ({
    ...row,
    bind_status: bindStatusFromRow(row)
  }));

  return {
    ok: true,
    marker: SERVICE_MARKER,
    filters: {
      scope_mode: scope.mode,
      company_id: scope.companyId || null,
      limit: normalizedLimit,
      only_bound: toBoolean(onlyBound),
      only_unbound: toBoolean(onlyUnbound),
      allow_global_unbound: toBoolean(allowGlobalUnbound)
    },
    total: rows.length,
    rows
  };
}

module.exports = {
  listRecentAcquisitionEvents
};
