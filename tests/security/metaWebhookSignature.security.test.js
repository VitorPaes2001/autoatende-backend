'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  verifyMetaWebhookSignature,
} = require('../../src/security/metaWebhookSignature');
const {
  captureSignedWebhookRawBody,
  shouldCaptureRawBody,
} = require('../../src/security/rawBodyCapture');

const secret = 'offline-test-secret';
const body = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');

function signatureFor(buffer) {
  return `sha256=${crypto.createHmac('sha256', secret).update(buffer).digest('hex')}`;
}

test('I-01 accepts a valid sha256 signature over exact raw bytes', () => {
  assert.equal(verifyMetaWebhookSignature({
    rawBody: body,
    signatureHeader: signatureFor(body),
    appSecret: secret,
  }), true);
});

for (const [name, input, code] of [
  ['missing secret', { rawBody: body, signatureHeader: signatureFor(body), appSecret: '' }, 'META_APP_SECRET_UNAVAILABLE'],
  ['missing raw body', { rawBody: undefined, signatureHeader: signatureFor(body), appSecret: secret }, 'META_RAW_BODY_UNAVAILABLE'],
  ['missing header', { rawBody: body, signatureHeader: undefined, appSecret: secret }, 'META_SIGNATURE_MISSING'],
  ['malformed algorithm', { rawBody: body, signatureHeader: `sha1=${'a'.repeat(40)}`, appSecret: secret }, 'META_SIGNATURE_MALFORMED'],
  ['malformed length', { rawBody: body, signatureHeader: 'sha256=abcd', appSecret: secret }, 'META_SIGNATURE_MALFORMED'],
  ['array header', { rawBody: body, signatureHeader: [signatureFor(body)], appSecret: secret }, 'META_SIGNATURE_MISSING'],
  ['modified body', { rawBody: Buffer.concat([body, Buffer.from(' ')]), signatureHeader: signatureFor(body), appSecret: secret }, 'META_SIGNATURE_INVALID'],
]) {
  test(`I-01 rejects ${name}`, () => {
    assert.throws(() => verifyMetaWebhookSignature(input), (error) => error.code === code);
  });
}

test('I-01 captures exact bytes for Stripe and WhatsApp only', () => {
  for (const url of ['/api/stripe/webhook', '/api/stripe/webhook?x=1', '/api/whatsapp/webhook']) {
    const req = { originalUrl: url };
    captureSignedWebhookRawBody(req, null, body);
    assert.deepEqual(req.rawBody, body);
    assert.notEqual(req.rawBody, body);
  }
  assert.equal(shouldCaptureRawBody({ originalUrl: '/api/stripe/webhook-extra' }), false);
  assert.equal(shouldCaptureRawBody({ originalUrl: '/api/whatsapp/webhook/child' }), false);
});

test('I-01 route rejects before ACK and side effects', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/routes/whatsapp.routes.js'), 'utf8');
  const receiver = source.slice(source.indexOf('router.post("/webhook"'));
  assert.match(receiver, /router\.post\("\/webhook", requireValidMetaWebhookSignature,/);
  assert.ok(receiver.indexOf('requireValidMetaWebhookSignature') < receiver.indexOf('res.status(200)'));
  assert.ok(receiver.indexOf('processInboundWebhook') < receiver.indexOf('captureFromWebhookPayload'));
});
