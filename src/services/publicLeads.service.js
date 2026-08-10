'use strict';

/**
 * __AUTOATENDE_V4_R36D_B_R1_BACKEND_PUBLIC_LEADS_ENDPOINT_SAFE__
 * Minimal public lead capture service.
 * Public writes must go through backend service role only.
 */

const crypto = require('crypto');

const PUBLIC_LEAD_ERROR_CODES = Object.freeze({
  UPSTREAM_FAILED: 'PUBLIC_LEAD_UPSTREAM_FAILED',
  PERSISTENCE_UNCONFIRMED: 'PUBLIC_LEAD_PERSISTENCE_UNCONFIRMED'
});

const PUBLIC_LEAD_ERROR_MESSAGES = Object.freeze({
  [PUBLIC_LEAD_ERROR_CODES.UPSTREAM_FAILED]:
    'Serviço de captação de leads temporariamente indisponível.',
  [PUBLIC_LEAD_ERROR_CODES.PERSISTENCE_UNCONFIRMED]:
    'Persistência do lead não confirmada.'
});

function pickEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
}

function trimText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncate(value, max) {
  const text = trimText(value);
  if (!text) return null;
  return text.slice(0, max);
}

function normalizeWhatsapp(value) {
  return trimText(value).replace(/\D/g, '');
}

function isValidEmail(value) {
  const email = trimText(value);
  if (!email) return true;
  if (email.length > 180) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(req) {
  const forwarded = trimText(req.headers['x-forwarded-for']).split(',')[0];
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

function hashIp(ip) {
  const salt =
    pickEnv(['PUBLIC_LEADS_IP_HASH_SALT', 'JWT_SECRET', 'SESSION_SECRET', 'SUPABASE_JWT_SECRET']) ||
    'autoatende-public-leads';
  return crypto.createHash('sha256').update(`${salt}:${ip || 'unknown'}`).digest('hex');
}

function validateLeadPayload(body) {
  const name = trimText(body?.name);
  const companyName = truncate(body?.company_name || body?.company || body?.empresa, 160);
  const whatsapp = normalizeWhatsapp(body?.whatsapp || body?.phone || body?.telefone);
  const emailRaw = trimText(body?.email);
  const email = emailRaw ? emailRaw.toLowerCase().slice(0, 180) : null;
  const message = truncate(body?.message || body?.mensagem || body?.objective || body?.objetivo, 1000);

  const source = truncate(body?.source, 80) || 'public_landing';
  const pagePath = truncate(body?.page_path || body?.pagePath || body?.path, 240) || '/';

  const utmSource = truncate(body?.utm_source, 160);
  const utmMedium = truncate(body?.utm_medium, 160);
  const utmCampaign = truncate(body?.utm_campaign, 160);
  const utmContent = truncate(body?.utm_content, 160);
  const utmTerm = truncate(body?.utm_term, 160);

  const errors = [];

  if (name.length < 2 || name.length > 120) {
    errors.push('name_invalid');
  }

  if (whatsapp.length < 10 || whatsapp.length > 15) {
    errors.push('whatsapp_invalid');
  }

  if (!isValidEmail(email)) {
    errors.push('email_invalid');
  }

  return {
    ok: errors.length === 0,
    errors,
    lead: {
      name,
      company_name: companyName,
      whatsapp,
      email,
      message,
      source,
      page_path: pagePath,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm
    }
  };
}

function isValidPublicLeadUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

function isValidReturnedLeadRow(row) {
  return Boolean(
    row &&
    typeof row === 'object' &&
    !Array.isArray(row) &&
    typeof row.id === 'string' &&
    isValidPublicLeadUuid(row.id)
  );
}

function createPublicLeadServiceError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 502;
  delete error.stack;
  return error;
}

function createPublicLeadUpstreamFailedError() {
  return createPublicLeadServiceError(
    PUBLIC_LEAD_ERROR_CODES.UPSTREAM_FAILED,
    PUBLIC_LEAD_ERROR_MESSAGES[PUBLIC_LEAD_ERROR_CODES.UPSTREAM_FAILED]
  );
}

function createPublicLeadPersistenceUnconfirmedError() {
  return createPublicLeadServiceError(
    PUBLIC_LEAD_ERROR_CODES.PERSISTENCE_UNCONFIRMED,
    PUBLIC_LEAD_ERROR_MESSAGES[PUBLIC_LEAD_ERROR_CODES.PERSISTENCE_UNCONFIRMED]
  );
}

function parseConfirmedLeadId(text) {
  if (typeof text !== 'string' || !text) {
    throw createPublicLeadPersistenceUnconfirmedError();
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw createPublicLeadPersistenceUnconfirmedError();
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 1 ||
    !isValidReturnedLeadRow(parsed[0])
  ) {
    throw createPublicLeadPersistenceUnconfirmedError();
  }

  return parsed[0].id.trim();
}

function isPublicLeadServiceError(error) {
  if (!error || Number(error.statusCode) !== 502) return false;

  const message = PUBLIC_LEAD_ERROR_MESSAGES[error.code];
  if (!message || error.message !== message) return false;

  return Object.getOwnPropertyNames(error).sort().join(',') === 'code,message,statusCode';
}

async function insertPublicLead(req, body) {
  const honeypot = trimText(body?.website || body?.company_website || body?.url);

  if (honeypot) {
    return {
      honeypot: true
    };
  }

  const validation = validateLeadPayload(body);

  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      publicCode: 'invalid_lead_payload',
      errors: validation.errors
    };
  }

  const { getSupabaseAdminConfig } = require('../config/supabase');
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseAdminConfig();

  const ip = getClientIp(req);
  const userAgent = truncate(req.headers['user-agent'], 512);

  const payload = {
    ...validation.lead,
    user_agent: userAgent,
    ip_hash: hashIp(ip),
    status: 'new',
    metadata: {
      marker: '__AUTOATENDE_V4_R36D_B_R1_BACKEND_PUBLIC_LEADS_ENDPOINT_SAFE__',
      origin: 'public_landing',
      user_agent_present: userAgent ? true : false
    }
  };

  const url = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/public_leads?select=id`;
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    throw createPublicLeadPersistenceUnconfirmedError();
  }

  if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') {
    throw createPublicLeadPersistenceUnconfirmedError();
  }

  if (!response.ok) {
    throw createPublicLeadUpstreamFailedError();
  }

  let text;

  try {
    text = await response.text();
  } catch (_) {
    throw createPublicLeadPersistenceUnconfirmedError();
  }

  const leadId = parseConfirmedLeadId(text);

  return {
    ok: true,
    leadId
  };
}

module.exports = {
  insertPublicLead,
  validateLeadPayload,
  normalizeWhatsapp,
  isValidPublicLeadUuid,
  createPublicLeadPersistenceUnconfirmedError,
  isPublicLeadServiceError,
  PUBLIC_LEAD_ERROR_CODES
};
