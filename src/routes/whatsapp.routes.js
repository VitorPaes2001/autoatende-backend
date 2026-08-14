const express = require("express");
const { handleIncomingWhatsAppMessage } = require("../services/whatsappMessageHandler");
const inboxService = require("../services/inbox.service");
const authMiddleware = require("../middlewares/auth.middleware");
const whatsappController = require("../controllers/whatsapp.controller");
const {
  requireValidMetaWebhookSignature,
} = require('../security/metaWebhookSignature');
const { safeErrorFields, safeLogFields } = require('../security/telemetrySanitizer');
const safeLogger = require('../security/safeLogger');
const { createAuthoritativeCompanyScope } = require('../security/authoritativeTenant');

const contactIdentityService = require('../services/contactIdentity.service'); // __AUTOATENDE_V4_R23B_R3_CAPTURE_WHATSAPP_PROFILE_NAME_CONTACT_IDENTITY__

const router = express.Router();

function normalizeConnectBody(body = {}) {
  const b = body || {};
  return {
    waba_id: b.waba_id || b.wabaId || b.wabaID || b.WABA_ID || "",
    phone_number_id: b.phone_number_id || b.phoneNumberId || b.phoneNumberID || b.PHONE_NUMBER_ID || "",
    phone_number: b.phone_number || b.phoneNumber || b.display_phone_number || b.displayPhoneNumber || "",
    access_token: b.access_token || b.accessToken || b.permanent_token || b.token || b.ACCESS_TOKEN || ""
  };
}

function isProbablyDigits(v) {
  return typeof v === "string" && /^[0-9]{8,25}$/.test(v);
}

function isProbablyToken(v) {
  return typeof v === "string" && v.length >= 50 && !/\s/.test(v);
}

function applyStatusAliases(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map(applyStatusAliases);

  const out = { ...payload };

  const connected = !!(
    (typeof out.connected === "boolean" && out.connected) ||
    (typeof out.isConnected === "boolean" && out.isConnected) ||
    out.status === "connected"
  );

  out.connected = connected;
  out.isConnected = connected;
  if (!out.status) out.status = connected ? "connected" : "disconnected";

  if (out.waba_id && !out.wabaId) out.wabaId = out.waba_id;
  if (out.phone_number_id && !out.phoneNumberId) out.phoneNumberId = out.phone_number_id;
  if (out.phone_number && !out.phoneNumber) out.phoneNumber = out.phone_number;

  return out;
}

function wrapJson(handler, { normalizeConnect = false } = {}) {
  return async (req, res, next) => {
    try {
      if (normalizeConnect) {
        req.body = normalizeConnectBody(req.body || {});
      }

      const originalJson = res.json.bind(res);
      res.json = (payload) => originalJson(applyStatusAliases(payload));

      return await handler(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
}

// Public webhook verification
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Public webhook receiver
router.post("/webhook", requireValidMetaWebhookSignature, (req, res) => {
  const payload = req.body || {};

  const value = payload?.entry?.[0]?.changes?.[0]?.value || {};
  const messages = Array.isArray(value.messages) ? value.messages : [];
  const statuses = Array.isArray(value.statuses) ? value.statuses : [];
  const from = messages?.[0]?.from || "-";
  safeLogger.log('[Webhook] received', safeLogFields({
    messages: messages.length,
    statuses: statuses.length,
    from,
  }));

  // ACK imediato
  res.status(200).json({ received: true });

  setImmediate(async () => {
    try {
      const inbound = await inboxService.processInboundWebhook(payload);

      if (!inbound?.processed) {
        safeLogger.log('[Webhook] ignored', safeLogFields({ reason: inbound?.reason || 'UNKNOWN' }));
        return;
      }

      const normalizedPayload = inbound.normalized || {};
      safeLogger.log('[Webhook] normalized', safeLogFields({
        company_id: normalizedPayload.company_id,
        from: normalizedPayload.from,
        type: normalizedPayload?.message?.type,
      }));

      try {
        await contactIdentityService.captureFromWebhookPayload(payload, {
          source: 'whatsapp.routes.verified_tenant',
          authoritativeCompanyScope: createAuthoritativeCompanyScope(
            normalizedPayload.company_id,
            'inbox.processInboundWebhook.unique_phone_number_id',
          ),
        });
      } catch (identityError) {
        safeLogger.warn('[ContactIdentity] verified_capture_failed', safeErrorFields(identityError));
      }

      if (normalizedPayload.company_id && normalizedPayload.from && normalizedPayload.message) {
        await handleIncomingWhatsAppMessage(normalizedPayload);
        safeLogger.log('[Webhook] bot_result', { status: 'processed' });
      } else {
        safeLogger.log("[Webhook] normalized payload missing company_id/from/message");
      }
    } catch (err) {
      safeLogger.error("[WhatsApp Webhook] processing failed", safeErrorFields(err));
    }
  });
});

// Private routes
router.post("/connect", authMiddleware, async (req, res, next) => {
  const norm = normalizeConnectBody(req.body || {});
  const errs = [];

  if (!isProbablyDigits(norm.waba_id)) errs.push("waba_id inválido (somente dígitos, >= 8).");
  if (!isProbablyDigits(norm.phone_number_id)) errs.push("phone_number_id inválido (somente dígitos, >= 8).");
  if (!isProbablyToken(norm.access_token)) errs.push("access_token inválido (use o token permanente da Meta).");

  if (errs.length) {
    return res.status(400).json({
      error: "WHATSAPP_CONNECT_INVALID_FIELDS",
      details: errs
    });
  }

  req.body = { ...(req.body || {}), ...norm };
  return wrapJson(whatsappController.connect)(req, res, next);
});

router.get("/status", authMiddleware, wrapJson(whatsappController.getStatus));
router.get("/connect", authMiddleware, wrapJson(whatsappController.getStatus));
router.get("/", authMiddleware, wrapJson(whatsappController.getStatus));

module.exports = router;
