const supabase = require("../config/supabase");

const TABLE = "acquisition_attribution_events";
const DEFAULT_SOURCE_SURFACE = "site_first_party_tracking";
const LOOKBACK_DAYS = 30;
const BIND_MARKER = "__AUTOATENDE_R10C_C2_BACKEND_BIND__";

function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (!normalized || normalized === "undefined" || normalized === "null") continue;
    return normalized;
  }
  return "";
}

function uniqueNonEmpty(values = []) {
  return Array.from(new Set(values.map((value) => pickFirstNonEmpty([value])).filter(Boolean)));
}

function buildOrClause(context = {}) {
  const parts = [];
  const trackingKey = pickFirstNonEmpty([context.tracking_key]);
  const sessionKey = pickFirstNonEmpty([context.session_key]);
  const clickId = pickFirstNonEmpty([context.click_id]);

  if (trackingKey) parts.push(`tracking_key.eq.${trackingKey}`);
  if (sessionKey) parts.push(`session_key.eq.${sessionKey}`);
  if (clickId) parts.push(`click_id.eq.${clickId}`);

  return parts.join(",");
}

function isRowCompatible(row = {}, identity = {}) {
  const sameOrEmpty = (current, incoming) => {
    const a = pickFirstNonEmpty([current]);
    const b = pickFirstNonEmpty([incoming]);
    if (!b) return true;
    if (!a) return true;
    return a === b;
  };

  return (
    sameOrEmpty(row.company_id, identity.company_id) &&
    sameOrEmpty(row.client_id, identity.client_id) &&
    sameOrEmpty(row.user_id, identity.user_id)
  );
}

async function bindAcquisitionToResolvedIdentity({
  acquisitionContext = {},
  userId = null,
  companyId = null,
  clientId = null
}) {
  const identity = {
    user_id: pickFirstNonEmpty([userId]),
    company_id: pickFirstNonEmpty([companyId]),
    client_id: pickFirstNonEmpty([clientId])
  };

  const hasIdentity = Boolean(identity.user_id || identity.company_id || identity.client_id);
  if (!hasIdentity) {
    return {
      ok: false,
      reason: "missing_resolved_identity",
      matched_rows: 0,
      updated_rows: 0,
      marker: BIND_MARKER
    };
  }

  const candidateKeys = uniqueNonEmpty([
    acquisitionContext.tracking_key,
    acquisitionContext.session_key,
    acquisitionContext.click_id
  ]);

  if (!candidateKeys.length) {
    return {
      ok: false,
      reason: "missing_match_keys",
      matched_rows: 0,
      updated_rows: 0,
      marker: BIND_MARKER
    };
  }

  const orClause = buildOrClause(acquisitionContext);
  if (!orClause) {
    return {
      ok: false,
      reason: "invalid_match_clause",
      matched_rows: 0,
      updated_rows: 0,
      marker: BIND_MARKER
    };
  }

  const lookbackIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: selectError } = await supabase
    .from(TABLE)
    .select("id, company_id, client_id, user_id, tracking_key, session_key, click_id, created_at, source_surface")
    .eq("source_surface", DEFAULT_SOURCE_SURFACE)
    .gte("created_at", lookbackIso)
    .or(orClause);

  if (selectError) {
    throw selectError;
  }

  const compatibleRows = (rows || []).filter((row) => isRowCompatible(row, identity));
  if (!compatibleRows.length) {
    return {
      ok: true,
      reason: (rows || []).length ? "matched_rows_conflicted_or_already_bound" : "no_recent_match",
      matched_rows: (rows || []).length,
      updated_rows: 0,
      marker: BIND_MARKER,
      keys_used: candidateKeys
    };
  }

  const ids = compatibleRows.map((row) => row.id).filter(Boolean);
  if (!ids.length) {
    return {
      ok: true,
      reason: "no_ids_to_update",
      matched_rows: compatibleRows.length,
      updated_rows: 0,
      marker: BIND_MARKER,
      keys_used: candidateKeys
    };
  }

  const updatePayload = {};
  if (identity.company_id) updatePayload.company_id = identity.company_id;
  if (identity.client_id) updatePayload.client_id = identity.client_id;
  if (identity.user_id) updatePayload.user_id = identity.user_id;

  const { data: updatedRows, error: updateError } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .in("id", ids)
    .select("id, company_id, client_id, user_id");

  if (updateError) {
    throw updateError;
  }

  return {
    ok: true,
    reason: "bind_applied",
    matched_rows: compatibleRows.length,
    updated_rows: (updatedRows || []).length,
    updated_ids: (updatedRows || []).map((row) => row.id),
    resolved_identity: identity,
    keys_used: candidateKeys,
    marker: BIND_MARKER
  };
}

module.exports = {
  bindAcquisitionToResolvedIdentity
};
