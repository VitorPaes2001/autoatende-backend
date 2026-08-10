'use strict';

/**
 * __AUTOATENDE_V4_R36D_B_R1_BACKEND_PUBLIC_LEADS_ENDPOINT_SAFE__
 * Public lead capture route.
 */

const express = require('express');
const { isSupabaseAdminUnavailableError } = require('../config/supabase');
const {
  insertPublicLead,
  isValidPublicLeadUuid,
  createPublicLeadPersistenceUnconfirmedError,
  isPublicLeadServiceError,
  PUBLIC_LEAD_ERROR_CODES
} = require('../services/publicLeads.service');

const router = express.Router();

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = Number(process.env.PUBLIC_LEADS_RATE_LIMIT_MAX || 12);
const buckets = new Map();
const PUBLIC_LEAD_VALIDATION_CODES = new Set([
  "name_invalid",
  "whatsapp_invalid",
  "email_invalid"
]);

function normalizeIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function publicLeadRateLimit(req, res, next) {
  const now = Date.now();
  const key = normalizeIp(req);
  const current = buckets.get(key) || [];
  const recent = current.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);

  if (recent.length >= RATE_MAX) {
    return res.status(429).json({
      ok: false,
      code: 'rate_limited'
    });
  }

  recent.push(now);
  buckets.set(key, recent);

  if (buckets.size > 10000) {
    for (const [bucketKey, timestamps] of buckets.entries()) {
      const active = timestamps.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
      if (active.length) buckets.set(bucketKey, active);
      else buckets.delete(bucketKey);
    }
  }

  return next();
}

function sanitizeValidationErrors(errors) {
  return errors.filter((code) => PUBLIC_LEAD_VALIDATION_CODES.has(code));
}

function isInvalidLeadPayloadResult(result) {
  return Boolean(
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    result.ok === false &&
    Number(result.status) === 400 &&
    result.publicCode === 'invalid_lead_payload' &&
    Array.isArray(result.errors)
  );
}

function mapPublicLeadError(error, res, next) {
  if (isSupabaseAdminUnavailableError(error)) {
    return res.status(503).json({
      ok: false,
      code: 'lead_capture_unavailable'
    });
  }

  if (isPublicLeadServiceError(error)) {
    const code =
      error.code === PUBLIC_LEAD_ERROR_CODES.UPSTREAM_FAILED
        ? 'lead_capture_failed'
        : 'lead_capture_unconfirmed';

    return res.status(502).json({
      ok: false,
      code
    });
  }

  return next(error);
}

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    route: 'public_leads',
    marker: '__AUTOATENDE_V4_R36D_B_R1_BACKEND_PUBLIC_LEADS_ENDPOINT_SAFE__'
  });
});

router.post('/', publicLeadRateLimit, async (req, res, next) => {
  try {
    const result = await insertPublicLead(req, req.body || {});

    if (
      result &&
      typeof result === 'object' &&
      !Array.isArray(result) &&
      result.honeypot === true
    ) {
      return res.status(200).json({ ok: true });
    }

    if (isInvalidLeadPayloadResult(result)) {
      return res.status(400).json({
        ok: false,
        code: 'invalid_lead_payload',
        errors: sanitizeValidationErrors(result.errors)
      });
    }

    if (
      !result ||
      typeof result !== 'object' ||
      Array.isArray(result) ||
      result.ok !== true ||
      !isValidPublicLeadUuid(result.leadId)
    ) {
      throw createPublicLeadPersistenceUnconfirmedError();
    }

    return res.status(201).json({
      ok: true,
      lead_id: result.leadId.trim()
    });
  } catch (error) {
    return mapPublicLeadError(error, res, next);
  }
});

module.exports = router;
