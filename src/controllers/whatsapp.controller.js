const { safeErrorFields, safeLogFields } = require('../security/telemetrySanitizer');
const safeLogger = require('../security/safeLogger');
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v18.0';
const META_TIMEOUT_MS = Number(process.env.WHATSAPP_META_TIMEOUT_MS || 12000);
const SB_TIMEOUT_MS = Number(process.env.WHATSAPP_SB_TIMEOUT_MS || 10000);

function first(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value !== undefined && value !== null && typeof value !== 'string') return value;
  }
  return null;
}

function normalizePhone(value) {
  if (!value) return null;
  const s = String(value).trim();
  return s || null;
}

function isProbablyDigits(value) {
  const s = String(value || '').trim();
  return /^[0-9]{8,25}$/.test(s);
}

function isValidE164(value) {
  const s = String(value || '').trim();
  return /^\+[1-9]\d{7,14}$/.test(s);
}

function looksLikeJwt(value) {
  const s = String(value || '').trim();
  return s.startsWith('eyJ') && s.split('.').length === 3;
}

function getSupabaseUrl() {
  return first(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function getSupabaseKey() {
  return first(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SERVICE_ROLE_KEY
  );
}

async function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000, operation = 'external_request') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Timeout na operação ' + operation);
      err.code = 'TIMEOUT';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function sbRequest(table, options = {}) {
  const {
    method = 'GET',
    search = {},
    body = undefined,
    prefer = undefined,
  } = options;

  const baseUrl = getSupabaseUrl();
  const serviceKey = getSupabaseKey();

  if (!baseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL / service role key não configurados.');
  }

  const url = new URL(`${baseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(search)) {
    if (v !== undefined && v !== null && String(v) !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  if (prefer) headers.Prefer = prefer;
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetchWithTimeout(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, SB_TIMEOUT_MS);

  const text = await res.text();
  const json = await safeJsonParse(text);

  if (!res.ok) {
    const err = new Error(
      json?.message ||
      json?.error?.message ||
      text ||
      `Supabase ${method} ${table} falhou`
    );
    err.status = res.status;
    err.payload = json || text;
    throw err;
  }

  return json;
}

function getAuthUser(req) {
  return req.user || req.auth?.user || req.profile || {};
}

function getUserId(req) {
  const user = getAuthUser(req);
  return first(
    user.id,
    user.user_id,
    user.userId,
    user.sub,
    req.userId,
    req.auth?.sub
  );
}

async function resolveCompanyId(req, userId) {
  const user = getAuthUser(req);

  const direct = first(
    user.company_id,
    user.companyId,
    req.company_id,
    req.companyId
  );
  if (direct) return direct;

  const attempts = [
    ['profiles',  { select: 'id,user_id,company_id,client_id', id: `eq.${userId}`, limit: 1 }],
    ['profiles',  { select: 'id,user_id,company_id,client_id', user_id: `eq.${userId}`, limit: 1 }],
    ['profiles',  { select: 'id,user_id,company_id,client_id', client_id: `eq.${userId}`, limit: 1 }],
    ['clients',   { select: 'id,user_id,company_id', id: `eq.${userId}`, limit: 1 }],
    ['clients',   { select: 'id,user_id,company_id', user_id: `eq.${userId}`, limit: 1 }],
    ['companies', { select: 'id,owner_user_id', owner_user_id: `eq.${userId}`, limit: 1 }],
  ];

  for (const [table, search] of attempts) {
    try {
      const rows = await sbRequest(table, { search });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) continue;

      if (table === 'companies' && row.id) return row.id;

      const companyId = first(row.company_id, row.companyId);
      if (companyId) return companyId;
    } catch (_) {}
  }

  return null;
}

async function findWhatsappAccount(companyId, userId) {
  if (companyId) {
    try {
      const rows = await sbRequest('whatsapp_accounts', {
        search: {
          select: '*',
          company_id: `eq.${companyId}`,
          order: 'updated_at.desc',
          limit: 1,
        },
      });
      if (Array.isArray(rows) && rows[0]) return rows[0];
    } catch (_) {}
  }

  if (userId) {
    try {
      const rows = await sbRequest('whatsapp_accounts', {
        search: {
          select: '*',
          client_id: `eq.${userId}`,
          order: 'updated_at.desc',
          limit: 1,
        },
      });
      if (Array.isArray(rows) && rows[0]) return rows[0];
    } catch (_) {}
  }

  return null;
}
async function findWhatsappAccountsByPhoneNumberId(phoneNumberId) {
  const rows = await sbRequest('whatsapp_accounts', {
    search: {
      select: 'id,company_id,client_id,phone_number_id',
      phone_number_id: `eq.${phoneNumberId}`,
      limit: 3,
    },
  });
  return Array.isArray(rows) ? rows : [];
}

function whatsappConflictError() {
  const error = new Error('WHATSAPP_PHONE_NUMBER_ID_CONFLICT');
  error.code = 'WHATSAPP_PHONE_NUMBER_ID_CONFLICT';
  error.status = 409;
  return error;
}

function assertGlobalWhatsappOwnership(rows, { companyId, userId }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (rows.length !== 1) throw whatsappConflictError();

  const row = rows[0];
  const rowCompanyId = first(row.company_id, row.companyId);
  const rowClientId = first(row.client_id, row.clientId);
  const sameCompany = rowCompanyId && String(rowCompanyId) === String(companyId);
  const sameLegacyOwner = !rowCompanyId && rowClientId && String(rowClientId) === String(userId);

  if (!sameCompany && !sameLegacyOwner) throw whatsappConflictError();
  return row;
}

function isUniqueViolation(error) {
  const candidates = [
    error?.code,
    error?.payload?.code,
    error?.payload?.error?.code,
    error?.details?.code,
  ];
  return candidates.some((value) => String(value || '') === '23505');
}


async function patchAccount(id, payload) {
  const rows = await sbRequest('whatsapp_accounts', {
    method: 'PATCH',
    search: { id: `eq.${id}`, select: '*' },
    body: payload,
    prefer: 'return=representation',
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function insertAccount(payload) {
  const rows = await sbRequest('whatsapp_accounts', {
    method: 'POST',
    search: { select: '*' },
    body: payload,
    prefer: 'return=representation',
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function metaGet(id, accessToken, fields) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(String(id))}`);
  url.searchParams.set('fields', fields);
  const res = await fetchWithTimeout(url.toString(), {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + accessToken },
  }, META_TIMEOUT_MS, 'meta_graph_get');
  const text = await res.text();
  const json = await safeJsonParse(text);

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      text ||
      `Falha na Meta (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json || text;
    throw err;
  }

  return json || {};
}

async function validateMetaCredentials({ phoneNumberId, wabaId, accessToken }) {
  if (looksLikeJwt(accessToken)) {
    const err = new Error('Você colou um JWT do Supabase no campo Token. Use o token permanente da Meta.');
    err.status = 400;
    err.code = 'INVALID_META_TOKEN';
    throw err;
  }

  const phoneData = await metaGet(
    phoneNumberId,
    accessToken,
    'id,display_phone_number,verified_name'
  );

  let wabaData = null;
  if (wabaId) {
    wabaData = await metaGet(
      wabaId,
      accessToken,
      'id,name'
    );
  }

  return {
    phoneNumberId: first(phoneData.id, phoneNumberId),
    phoneNumber: first(phoneData.display_phone_number, null),
    verifiedName: first(phoneData.verified_name, null),
    wabaId: first(wabaData?.id, wabaId),
  };
}

function toStatusPayload(record) {
  const source = record || {};

  const rawPhoneNumberId = first(source.phone_number_id, source.phoneNumberId);
  const rawWabaId = first(source.waba_id, source.wabaId);
  const rawPhoneNumber = first(source.phone_number, source.phoneNumber);
  const rawToken = first(source.access_token, source.accessToken);

  const phoneNumberId = isProbablyDigits(rawPhoneNumberId) ? String(rawPhoneNumberId).trim() : null;
  const wabaId = isProbablyDigits(rawWabaId) ? String(rawWabaId).trim() : null;
  const phoneNumber = isValidE164(rawPhoneNumber) ? String(rawPhoneNumber).trim() : null;
  const hasToken = !!rawToken && !looksLikeJwt(rawToken);
  const connected = !!(phoneNumberId && wabaId && hasToken);

  const connectedAt = first(source.connected_at, source.created_at);
  const lastUpdated = first(source.last_updated, source.updated_at);

  return {
    connected,
    isConnected: connected,
    status: connected ? 'connected' : 'disconnected',

    phone_number_id: phoneNumberId || null,
    phoneNumberId: phoneNumberId || null,

    waba_id: wabaId || null,
    wabaId: wabaId || null,

    phone_number: phoneNumber || null,
    phoneNumber: phoneNumber || null,

    connected_at: connectedAt || null,
    connectedAt: connectedAt || null,

    last_updated: lastUpdated || null,
    lastUpdated: lastUpdated || null,

    company_id: first(source.company_id, source.companyId) || null,
    companyId: first(source.company_id, source.companyId) || null,
  };
}

function normalizeConnectBody(body) {
  const source = body && typeof body === 'object' ? body : {};

  return {
    phoneNumberId: first(source.phone_number_id, source.phoneNumberId, source.phoneNumberID),
    wabaId: first(source.waba_id, source.wabaId),
    accessToken: first(
      source.access_token,
      source.accessToken,
      source.permanent_token,
      source.permanentToken,
      source.meta_access_token,
      source.metaAccessToken,
      source.token
    ),
    phoneNumber: normalizePhone(first(
      source.phone_number,
      source.phoneNumber,
      source.display_phone_number,
      source.displayPhoneNumber
    )),
  };
}

async function autoHealAccount(record, companyId, userId) {
  if (!record) return null;

  const hasValidCredentials =
    !!first(record.access_token) &&
    !looksLikeJwt(first(record.access_token)) &&
    isProbablyDigits(first(record.phone_number_id)) &&
    isProbablyDigits(first(record.waba_id));

  const nextPayload = {};
  let changed = false;

  if (companyId && !record.company_id) {
    nextPayload.company_id = companyId;
    changed = true;
  }

  if (userId && !record.client_id) {
    nextPayload.client_id = userId;
    changed = true;
  }

  if (hasValidCredentials && record.status !== 'connected') {
    nextPayload.status = 'connected';
    changed = true;
  }

  if (!hasValidCredentials && record.status === 'connected') {
    nextPayload.status = 'disconnected';
    changed = true;
  }

  if (!changed) return record;

  try {
    return await patchAccount(record.id, nextPayload);
  } catch {
    return record;
  }
}

async function getStatus(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Usuário autenticado não identificado' });
    }

    const companyId = await resolveCompanyId(req, userId);
    let record = await findWhatsappAccount(companyId, userId);
    record = await autoHealAccount(record, companyId, userId);

    return res.json(toStatusPayload(record));
  } catch (error) {
    safeLogger.error('[whatsapp.controller.getStatus]', safeErrorFields(error));
    return res.status(500).json({
      error: 'Falha ao consultar status do WhatsApp',
      details: null,
    });
  }
}

async function connect(req, res) {
  const t0 = Date.now();

  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Usuário autenticado não identificado' });
    }

    const companyId = await resolveCompanyId(req, userId);
    if (!companyId) {
      return res.status(400).json({
        error: 'Não foi possível identificar a empresa deste usuário.',
      });
    }

    const body = normalizeConnectBody(req.body);

    if (!body.phoneNumberId || !body.wabaId || !body.accessToken) {
      return res.status(400).json({
        error: 'Campos obrigatórios ausentes',
        missing: {
          phone_number_id: !body.phoneNumberId,
          waba_id: !body.wabaId,
          access_token: !body.accessToken,
        },
      });
    }

    let globallyOwnedAccount = assertGlobalWhatsappOwnership(
      await findWhatsappAccountsByPhoneNumberId(body.phoneNumberId),
      { companyId, userId },
    );
    safeLogger.log('[whatsapp.connect] start', safeLogFields({
      company_id: companyId,
      phoneNumber: body.phoneNumberId,
    }));

    const meta = await validateMetaCredentials({
      phoneNumberId: body.phoneNumberId,
      wabaId: body.wabaId,
      accessToken: body.accessToken,
    });

    const resolvedPhoneNumberId = meta.phoneNumberId || body.phoneNumberId;
    globallyOwnedAccount = assertGlobalWhatsappOwnership(
      await findWhatsappAccountsByPhoneNumberId(resolvedPhoneNumberId),
      { companyId, userId },
    );
    const existing = globallyOwnedAccount || await findWhatsappAccount(companyId, userId);

    const payload = {
      client_id: userId,
      company_id: companyId,
      phone_number_id: resolvedPhoneNumberId,
      waba_id: meta.wabaId || body.wabaId,
      phone_number: normalizePhone(meta.phoneNumber || body.phoneNumber),
      access_token: body.accessToken,
      status: 'connected',
    };

    let saved;
    if (existing?.id) {
      saved = await patchAccount(existing.id, payload);
    } else {
      saved = await insertAccount(payload);
    }

    safeLogger.log('[whatsapp.connect] success', safeLogFields({
      ms: Date.now() - t0,
      company_id: companyId,
      status: 'connected',
    }));

    return res.json({
      success: true,
      message: 'WhatsApp conectado e salvo com sucesso.',
      ...toStatusPayload(saved || payload),
    });
  } catch (error) {
    safeLogger.error('[whatsapp.controller.connect]', safeErrorFields(error, {
      duration_ms: Date.now() - t0,
    }));

    if (error?.code === 'WHATSAPP_PHONE_NUMBER_ID_CONFLICT' || isUniqueViolation(error)) {
      return res.status(409).json({
        error: 'Este número do WhatsApp já está vinculado a outra empresa.',
      });
    }

    if (error?.code === 'TIMEOUT') {
      return res.status(504).json({
        error: 'Timeout ao validar credenciais na Meta',
        details: null,
      });
    }

    const statusCode =
      error?.status === 400 || error?.status === 401 || error?.status === 403 || error?.status === 404
        ? 400
        : 500;

    return res.status(statusCode).json({
      error: 'Falha ao conectar WhatsApp',
      details: null,
    });
  }
}

module.exports = {
  assertGlobalWhatsappOwnership,
  connect,
  isUniqueViolation,
  getStatus,
  whatsappConflictError,
  fetchWithTimeout,
  metaGet,
};
