'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  verifyMetaWebhookSignature,
} = require('../../src/security/metaWebhookSignature');
const {
  createAuthoritativeCompanyScope,
  requireAuthoritativeCompanyScope,
  resolveAuthoritativeTenant,
} = require('../../src/security/authoritativeTenant');

function validSignature(body, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

test('Meta signature accepts only exact lowercase grammar', () => {
  const body = Buffer.from('{"ok":true}');
  const secret = 'test-secret';
  const valid = validSignature(body, secret);
  assert.equal(verifyMetaWebhookSignature({ rawBody: body, signatureHeader: valid, appSecret: secret }), true);
  for (const invalid of [
    valid.toUpperCase(),
    ' ' + valid,
    valid + ' ',
    valid + ',sha256=' + '0'.repeat(64),
    'SHA256=' + valid.slice(7),
    'sha256=' + 'a'.repeat(65),
    '',
  ]) {
    assert.throws(() => verifyMetaWebhookSignature({ rawBody: body, signatureHeader: invalid, appSecret: secret }));
  }
});

test('authoritative company scopes cannot be forged', () => {
  const scope = createAuthoritativeCompanyScope('company-a', 'test');
  assert.equal(requireAuthoritativeCompanyScope(scope), 'company-a');
  assert.throws(() => requireAuthoritativeCompanyScope({ companyId: 'company-a' }));
});

test('inactive user/company/client relationships fail closed', async () => {
  for (const inactive of ['user', 'company', 'client']) {
    const repository = {
      findUsersByAuthId: async () => [{ id: 'user-a', company_id: 'company-a', ...(inactive === 'user' ? { status: 'suspended' } : {}) }],
      findCompaniesById: async () => [{ id: 'company-a', client_id: 'client-a', ...(inactive === 'company' ? { is_active: false } : {}) }],
      findClientsByCompanyId: async () => [{ id: 'client-a', company_id: 'company-a', ...(inactive === 'client' ? { status: 'disabled' } : {}) }],
    };
    await assert.rejects(() => resolveAuthoritativeTenant({ id: 'user-a' }, repository), /tenant_context_forbidden/);
  }
});
