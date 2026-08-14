'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  minimalPhoneSuffix,
  pseudonymizeIdentifier,
  sanitizeBreadcrumb,
  sanitizeHeaders,
  sanitizeSentryEvent,
  sanitizeUnknown,
  safeLogFields,
} = require('../../src/security/telemetrySanitizer');

test('I-05 pseudonymizes tenant deterministically and keeps only minimal phone suffix', () => {
  const a = pseudonymizeIdentifier('company-secret-id');
  assert.equal(a, pseudonymizeIdentifier('company-secret-id'));
  assert.notEqual(a, 'company-secret-id');
  assert.equal(a.length, 16);
  assert.equal(minimalPhoneSuffix('+55 (11) 99999-1234'), '1234');
  assert.deepEqual(safeLogFields({
    company_id: 'company-secret-id',
    from: '5511999991234',
    payload: { secret: true },
  }), { company_ref: a, contact_suffix: '1234' });
});

test('I-05 header allowlist drops auth, cookies and signatures', () => {
  assert.deepEqual(sanitizeHeaders({
    authorization: 'Bearer secret',
    cookie: 'session=secret',
    'x-hub-signature-256': 'sha256=secret',
    'content-type': 'application/json',
    'x-request-id': 'req-1',
  }), {
    'content-type': 'application/json',
    'x-request-id': 'req-1',
  });
});

test('I-05 recursive sanitizer is circular-safe and redacts content keys', () => {
  const input = { body: 'customer text', token: 'secret', safe: { value: 1 } };
  input.loop = input;
  const output = sanitizeUnknown(input);
  assert.equal(output.body, '[REDACTED]');
  assert.equal(output.token, '[REDACTED]');
  assert.equal(output.loop, '[CIRCULAR]');
});

test('I-05 Sentry allowlist drops body, user, contexts, extras and breadcrumbs', () => {
  const event = sanitizeSentryEvent({
    event_id: 'evt',
    tags: { method: 'POST', company_id: 'raw', company_ref: 'ref' },
    request: {
      method: 'POST',
      url: '/api/path?token=secret',
      headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
      data: { message: 'private' },
    },
    user: { email: 'person@example.com' },
    contexts: { payload: { body: 'private' } },
    extra: { token: 'private' },
    breadcrumbs: [{ message: 'private' }],
  });
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /person@example\.com|Bearer secret|private|company_id|token=secret/);
  assert.equal(event.request.url, '/api/path');
  assert.equal(event.tags.company_ref, 'ref');
});

test('I-05 breadcrumb drops message and arbitrary data', () => {
  assert.deepEqual(sanitizeBreadcrumb({
    category: 'http',
    level: 'info',
    message: 'customer content',
    data: { authorization: 'secret' },
  }), {
    category: 'http',
    type: '',
    level: 'info',
    timestamp: undefined,
  });
});
