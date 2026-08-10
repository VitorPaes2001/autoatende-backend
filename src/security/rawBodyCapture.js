'use strict';

const SIGNED_WEBHOOK_PATHS = new Set([
  '/api/stripe/webhook',
  '/api/whatsapp/webhook',
]);

function requestPath(req) {
  const raw = String(req?.originalUrl || req?.url || '');
  return raw.split('?')[0].replace(/\/+$/, '') || '/';
}

function shouldCaptureRawBody(req) {
  return SIGNED_WEBHOOK_PATHS.has(requestPath(req));
}

function captureSignedWebhookRawBody(req, _res, buffer) {
  if (!shouldCaptureRawBody(req)) return;
  req.rawBody = Buffer.from(buffer);
}

module.exports = {
  SIGNED_WEBHOOK_PATHS,
  requestPath,
  shouldCaptureRawBody,
  captureSignedWebhookRawBody,
};
