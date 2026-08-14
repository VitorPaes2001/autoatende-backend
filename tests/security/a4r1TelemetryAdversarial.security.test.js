'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeTechnicalMessage,
  sanitizeUnknown,
  sanitizeSentryEvent,
  safeHttpErrorResponse,
  ACCESSOR_REDACTED,
  LIMIT_REACHED,
} = require('../../src/security/telemetrySanitizer');

test('redacts Meta token in generic query and assignment strings', () => {
  const secret = 'EAA' + 'x'.repeat(70);
  const value = sanitizeTechnicalMessage('https://host/path?access_token=' + secret + '&x=1 api_key=' + secret);
  assert.equal(value.includes(secret), false);
  assert.match(value, /\[REDACTED\]/);
});

test('does not invoke enumerable getter', () => {
  let invoked = false;
  const hostile = {};
  Object.defineProperty(hostile, 'safe', {
    enumerable: true,
    get() { invoked = true; throw new Error('secret getter'); },
  });
  const result = sanitizeUnknown(hostile);
  assert.equal(invoked, false);
  assert.equal(result.safe, ACCESSOR_REDACTED);
});

test('survives proxy traps and hostile toString', () => {
  const proxy = new Proxy({}, {
    ownKeys() { throw new Error('blocked'); },
    get() { throw new Error('blocked'); },
  });
  assert.doesNotThrow(() => sanitizeUnknown(proxy));
  assert.doesNotThrow(() => sanitizeUnknown({ toString() { throw new Error('blocked'); } }));
});

test('redacts binary types and bounds Map and Set', () => {
  assert.equal(sanitizeUnknown(Buffer.from('secret')), '[BUFFER_REDACTED]');
  const map = new Map(Array.from({ length: 100 }, (_, i) => ['key' + i, i]));
  const set = new Set(Array.from({ length: 100 }, (_, i) => i));
  assert.equal(sanitizeUnknown(map).entries.length, 30);
  assert.equal(sanitizeUnknown(set).values.length, 30);
});

test('global node and byte budgets terminate traversal', () => {
  const wide = Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['k' + i, 'x'.repeat(500)]));
  const result = sanitizeUnknown(wide);
  assert.ok(Object.values(result).includes(LIMIT_REACHED));
});

test('Sentry preserves bounded diagnostic frames without query strings', () => {
  const event = sanitizeSentryEvent({
    release: 'a4r1',
    environment: 'test',
    request: { method: 'POST', url: 'https://host/a?access_token=secret' },
    exception: { values: [{
      type: 'TypeError',
      value: 'failure',
      stacktrace: { frames: [{ filename: '/srv/src/app.js?access_token=secret', function: 'handler', lineno: 7 }] },
      mechanism: { type: 'generic', handled: false },
    }] },
  });
  assert.equal(event.request.url, 'https://host/a');
  assert.equal(event.exception.values[0].stacktrace.frames[0].lineno, 7);
  assert.equal(event.exception.values[0].mechanism.type, 'generic');
});

test('redacts generic aliases, encoded names and complete query strings in every telemetry path', () => {
  const opaque = 'opaque-a4r2-token';
  const vectors = [
    'access_token=' + opaque,
    'accessToken=' + opaque,
    'ACCESS_TOKEN=' + opaque,
    'access%5Ftoken=' + opaque,
    'token=' + opaque,
    'apiKey=' + opaque,
    'authorization=' + opaque,
    'bearer=' + opaque,
    'client_secret=' + opaque,
    'whatsapp token=' + opaque,
    'https://host.test/path?access%5Ftoken=' + opaque + '&ok=1',
  ];
  for (const vector of vectors) assert.equal(sanitizeTechnicalMessage(vector).includes(opaque), false);
  const nested = new Error('customer message ' + opaque + ' person@example.test +5511999912345');
  nested.config = { url: 'https://host.test/a?token=' + opaque, headers: { authorization: 'Bearer ' + opaque } };
  nested.request = { url: 'https://host.test/b?access%5Ftoken=' + opaque };
  nested.response = { status: 401, data: { message: 'customer message ' + opaque } };
  nested.cause = new Error('https://host.test/c?apiKey=' + opaque);
  const sentry = sanitizeSentryEvent({
    request: { url: 'https://host.test/sentry?token=' + opaque, headers: { authorization: 'Bearer ' + opaque } },
    exception: { values: [{ value: 'customer message ' + opaque, stacktrace: { frames: [{ filename: '/a?token=' + opaque }] } }] },
  });
  const serialized = JSON.stringify({ error: sanitizeUnknown(nested), sentry, breadcrumb: require('../../src/security/telemetrySanitizer').sanitizeBreadcrumb({ category: 'email person@example.test', message: opaque }) });
  assert.equal(serialized.includes(opaque), false);
  assert.equal(serialized.includes('person@example.test'), false);
  assert.equal(serialized.includes('+5511999912345'), false);
});

test('never invokes hostile conversion or inherited getters during sanitization', () => {
  let toStringInvoked = false;
  let inheritedGetterInvoked = false;
  const inherited = {};
  Object.defineProperty(inherited, 'leak', { enumerable: true, get() { inheritedGetterInvoked = true; return 'opaque'; } });
  const hostile = Object.create(inherited);
  hostile.own = { toString() { toStringInvoked = true; return 'opaque'; } };
  const mapKey = { toString() { toStringInvoked = true; return 'opaque'; } };
  const result = sanitizeUnknown({ hostile, map: new Map([[mapKey, 'ok']]) });
  assert.equal(toStringInvoked, false);
  assert.equal(inheritedGetterInvoked, false);
  assert.equal(Object.hasOwn(result.hostile, 'leak'), false);
  assert.equal(result.map.entries[0][0], '[NON_PRIMITIVE_KEY]');
});

test('HTTP error responses redact canaries and expose only allowlisted details', () => {
  const canary = 'A4R3_CANARY_SECRET';
  const response = safeHttpErrorResponse({
    statusCode: 400,
    code: 'BAD_REQUEST',
    message: 'request failed access_token=' + canary + ' person@example.test',
    details: {
      reason: 'invalid token=' + canary,
      template_required: false,
      token: canary,
      email: 'person@example.test',
      nested: { payload: canary },
    },
  }, 400);
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes(canary), false);
  assert.equal(serialized.includes('person@example.test'), false);
  assert.equal(Object.hasOwn(response.details || {}, 'token'), false);
  assert.equal(Object.hasOwn(response.details || {}, 'email'), false);
  assert.equal(Object.hasOwn(response.details || {}, 'nested'), false);
});

test('HTTP 5xx responses never expose source messages or details', () => {
  const response = safeHttpErrorResponse({
    statusCode: 500,
    code: 'INTERNAL',
    message: 'access_token=secret',
    details: { reason: 'secret' },
  }, 500);
  assert.equal(response.message, 'Internal server error');
  assert.equal(Object.hasOwn(response, 'details'), false);
});
