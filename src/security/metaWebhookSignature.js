'use strict';

const crypto = require('crypto');

const META_SIGNATURE_HEADER = 'x-hub-signature-256';
const META_APP_SECRET_ENV = 'WHATSAPP_APP_SECRET';

function signatureError(code, statusCode) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function verifyMetaWebhookSignature({ rawBody, signatureHeader, appSecret }) {
  if (typeof appSecret !== 'string' || !appSecret.trim()) {
    throw signatureError('META_APP_SECRET_UNAVAILABLE', 503);
  }

  if (!Buffer.isBuffer(rawBody)) {
    throw signatureError('META_RAW_BODY_UNAVAILABLE', 401);
  }

  if (typeof signatureHeader !== 'string') {
    throw signatureError('META_SIGNATURE_MISSING', 401);
  }

  const match = /^sha256=([a-f0-9]{64})$/.exec(signatureHeader);
  if (!match) {
    throw signatureError('META_SIGNATURE_MALFORMED', 401);
  }

  const supplied = Buffer.from(match[1], 'hex');
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest();

  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw signatureError('META_SIGNATURE_INVALID', 401);
  }

  return true;
}

function requireValidMetaWebhookSignature(req, res, next) {
  try {
    verifyMetaWebhookSignature({
      rawBody: req.rawBody,
      signatureHeader: req.headers?.[META_SIGNATURE_HEADER],
      appSecret: process.env[META_APP_SECRET_ENV],
    });
    return next();
  } catch (error) {
    const statusCode = error?.statusCode === 503 ? 503 : 401;
    return res.status(statusCode).json({
      received: false,
      error: statusCode === 503
        ? 'Webhook signature validation unavailable'
        : 'Invalid webhook signature',
    });
  }
}

module.exports = {
  META_SIGNATURE_HEADER,
  META_APP_SECRET_ENV,
  verifyMetaWebhookSignature,
  requireValidMetaWebhookSignature,
};
