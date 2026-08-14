'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  assertGlobalWhatsappOwnership,
  isUniqueViolation,
} = require('../../src/controllers/whatsapp.controller');

const owner = { companyId: 'company-a', userId: 'user-a' };

test('I-04 permits no existing row and same-tenant idempotency', () => {
  assert.equal(assertGlobalWhatsappOwnership([], owner), null);
  const row = { id: 'wa-a', company_id: 'company-a', client_id: 'user-a' };
  assert.equal(assertGlobalWhatsappOwnership([row], owner), row);
});

for (const [name, rows] of [
  ['cross-tenant row', [{ id: 'wa-b', company_id: 'company-b', client_id: 'user-b' }]],
  ['legacy cross-owner row', [{ id: 'wa-b', company_id: null, client_id: 'user-b' }]],
  ['ambiguous rows', [{ id: 'wa-a', company_id: 'company-a' }, { id: 'wa-b', company_id: 'company-b' }]],
]) {
  test(`I-04 returns conflict for ${name}`, () => {
    assert.throws(
      () => assertGlobalWhatsappOwnership(rows, owner),
      (error) => error.code === 'WHATSAPP_PHONE_NUMBER_ID_CONFLICT' && error.status === 409,
    );
  });
}

test('I-04 recognizes Postgres unique-violation race', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true);
  assert.equal(isUniqueViolation({ payload: { code: '23505' } }), true);
  assert.equal(isUniqueViolation({ code: 'PGRST116' }), false);
});

test('I-04 inbound resolver requires exactly one phone_number_id match', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/services/inbox.service.js'), 'utf8');
  assert.match(source, /eq\('phone_number_id', phoneNumberId\)\s*\.limit\(2\)/);
  assert.match(source, /matches\.length !== 1/);
  assert.doesNotMatch(source, /eq\('waba_id', phoneNumberId\)/);
  assert.match(source, /const isMetaWebhook = Array\.isArray\(payload\.entry\)/);
});

test('I-04 connect maps preflight and constraint races to generic 409', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/controllers/whatsapp.controller.js'), 'utf8');
  assert.match(source, /findWhatsappAccountsByPhoneNumberId/);
  assert.match(source, /isUniqueViolation\(error\)/);
  assert.match(source, /res\.status\(409\)/);
});
