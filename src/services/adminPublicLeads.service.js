'use strict';

/**
 * __AUTOATENDE_V4_R37B_LEAD_STATUS_MANAGEMENT_BACKEND_FRONTEND_SAFE__
 * Authenticated admin-facing service for public landing leads.
 * Service role stays server-side.
 */

const { getSupabaseAdminConfig } = require('../config/supabase');

function trimText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeStatus(value) {
  const status = trimText(value).toLowerCase();
  const allowed = new Set(['new', 'contacted', 'qualified', 'discarded']);
  return allowed.has(status) ? status : '';
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 100);
}

function normalizeOffset(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function isValidLeadRow(row) {
  return Boolean(
    row &&
    typeof row === 'object' &&
    !Array.isArray(row) &&
    isUuidLike(row.id)
  );
}

function createServiceError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  delete error.stack;
  return error;
}

function createUpstreamError() {
  return createServiceError(
    'ADMIN_LEADS_UPSTREAM_FAILED',
    'Serviço de leads temporariamente indisponível.',
    502
  );
}

function createListResponseInvalidError() {
  return createServiceError(
    'ADMIN_LEADS_RESPONSE_INVALID',
    'Resposta inválida do serviço de leads.',
    502
  );
}

function createUpdateNotConfirmedError() {
  return createServiceError(
    'ADMIN_LEAD_UPDATE_NOT_CONFIRMED',
    'Atualização do lead não confirmada.',
    502
  );
}

function mapLead(row) {
  return {
    id: row.id || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    name: row.name || '',
    company_name: row.company_name || '',
    whatsapp: row.whatsapp || '',
    email: row.email || '',
    message: row.message || '',
    source: row.source || '',
    page_path: row.page_path || '',
    status: row.status || 'new',
    utm_source: row.utm_source || '',
    utm_medium: row.utm_medium || '',
    utm_campaign: row.utm_campaign || '',
    metadata: row.metadata || {}
  };
}

function buildSummary(rows) {
  const summary = {
    total: rows.length,
    new: 0,
    contacted: 0,
    qualified: 0,
    discarded: 0
  };

  for (const row of rows) {
    const status = normalizeStatus(row.status) || 'new';
    if (Object.prototype.hasOwnProperty.call(summary, status)) {
      summary[status] += 1;
    }
  }

  return summary;
}

function filterRows(rows, { status, search }) {
  const normalizedStatus = normalizeStatus(status);
  const normalizedSearch = trimText(search).toLowerCase();

  return rows.filter((row) => {
    if (normalizedStatus && String(row.status || '').toLowerCase() !== normalizedStatus) {
      return false;
    }

    if (!normalizedSearch) return true;

    const haystack = [
      row.name,
      row.company_name,
      row.whatsapp,
      row.email,
      row.message,
      row.source,
      row.page_path,
      row.status
    ].map((item) => String(item || '').toLowerCase()).join(' ');

    return haystack.includes(normalizedSearch);
  });
}

async function supabaseRest(config, path, options, createInvalidResponseError) {
  let response;

  try {
    response = await fetch(`${config.url.replace(/\/$/, '')}${path}`, {
      ...(options || {}),
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        Accept: 'application/json',
        ...((options && options.headers) || {})
      }
    });
  } catch {
    throw createUpstreamError();
  }

  if (!response || !response.ok) {
    throw createUpstreamError();
  }

  let text;

  try {
    text = await response.text();
  } catch {
    throw createUpstreamError();
  }

  if (!text) {
    throw createInvalidResponseError();
  }

  try {
    return JSON.parse(text);
  } catch {
    throw createInvalidResponseError();
  }
}

async function fetchPublicLeadsRaw(config) {
  const params = new URLSearchParams();
  params.set(
    'select',
    'id,created_at,updated_at,name,company_name,whatsapp,email,message,source,page_path,status,utm_source,utm_medium,utm_campaign,metadata'
  );
  params.set('order', 'created_at.desc');
  params.set('limit', '300');

  const parsed = await supabaseRest(
    config,
    `/rest/v1/public_leads?${params.toString()}`,
    undefined,
    createListResponseInvalidError
  );

  if (!Array.isArray(parsed) || !parsed.every(isValidLeadRow)) {
    throw createListResponseInvalidError();
  }

  return parsed;
}

async function listAdminPublicLeadsWithConfig(query, config) {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const rawRows = await fetchPublicLeadsRaw(config);
  const mappedRows = rawRows.map(mapLead);
  const filteredRows = filterRows(mappedRows, {
    status: query.status,
    search: query.search || query.q
  });

  return {
    ok: true,
    leads: filteredRows.slice(offset, offset + limit),
    total: filteredRows.length,
    limit,
    offset,
    summary: buildSummary(mappedRows),
    filters: {
      status: normalizeStatus(query.status) || '',
      search: trimText(query.search || query.q)
    }
  };
}

async function listAdminPublicLeads(query = {}) {
  const config = getSupabaseAdminConfig();
  return listAdminPublicLeadsWithConfig(query, config);
}

async function updateAdminPublicLeadStatus(id, nextStatus) {
  const leadId = trimText(id);
  const status = normalizeStatus(nextStatus);

  if (!isUuidLike(leadId)) {
    const error = new Error('ADMIN_PUBLIC_LEAD_INVALID_ID');
    error.status = 400;
    throw error;
  }

  if (!status) {
    const error = new Error('ADMIN_PUBLIC_LEAD_INVALID_STATUS');
    error.status = 400;
    throw error;
  }

  const config = getSupabaseAdminConfig();
  const params = new URLSearchParams();
  params.set('id', `eq.${leadId}`);
  params.set(
    'select',
    'id,created_at,updated_at,name,company_name,whatsapp,email,message,source,page_path,status,utm_source,utm_medium,utm_campaign,metadata'
  );

  const parsed = await supabaseRest(
    config,
    `/rest/v1/public_leads?${params.toString()}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        status,
        updated_at: new Date().toISOString()
      })
    },
    createUpdateNotConfirmedError
  );

  if (!Array.isArray(parsed)) {
    throw createUpdateNotConfirmedError();
  }

  if (parsed.length === 0) {
    const error = new Error('ADMIN_PUBLIC_LEAD_NOT_FOUND');
    error.status = 404;
    throw error;
  }

  if (parsed.length !== 1 || !isValidLeadRow(parsed[0])) {
    throw createUpdateNotConfirmedError();
  }

  const updatedRow = parsed[0];
  const returnedId = trimText(updatedRow.id);

  if (
    returnedId.toLowerCase() !== leadId.toLowerCase() ||
    normalizeStatus(updatedRow.status) !== status
  ) {
    throw createUpdateNotConfirmedError();
  }

  let summary = null;

  try {
    const list = await listAdminPublicLeadsWithConfig({ limit: 100 }, config);
    summary = list.summary;
  } catch {
    summary = null;
  }

  return {
    ok: true,
    lead: mapLead(updatedRow),
    summary
  };
}

module.exports = {
  listAdminPublicLeads,
  updateAdminPublicLeadStatus,
  normalizeStatus,
  normalizeLimit,
  normalizeOffset,
  isUuidLike
};
