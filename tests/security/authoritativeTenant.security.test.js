'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveAuthoritativeTenant,
  subscriptionBelongsToTenant,
} = require('../../src/security/authoritativeTenant');

function repository(overrides = {}) {
  return {
    findUsersByAuthId: async () => [{ id: 'user-a', company_id: 'company-a' }],
    findCompaniesById: async () => [{ id: 'company-a', client_id: 'client-a' }],
    findClientsByCompanyId: async () => [{ id: 'client-a', company_id: 'company-a' }],
    ...overrides,
  };
}

test('I-03 resolves from auth user id through server-side relations', async () => {
  const tenant = await resolveAuthoritativeTenant({ id: 'user-a' }, repository());
  assert.equal(tenant.companyId, 'company-a');
  assert.equal(tenant.clientId, 'client-a');
});

test('I-03 treats matching metadata as consistency evidence only', async () => {
  const tenant = await resolveAuthoritativeTenant({
    id: 'user-a',
    app_metadata: { company_id: 'company-a', client_id: 'client-a' },
  }, repository());
  assert.equal(tenant.companyId, 'company-a');
});

for (const [name, authUser, overrides] of [
  ['user metadata tenant injection', { id: 'user-a', user_metadata: { company_id: 'company-b' } }, {}],
  ['app metadata mismatch', { id: 'user-a', app_metadata: { client_id: 'client-b' } }, {}],
  ['missing public user', { id: 'user-a' }, { findUsersByAuthId: async () => [] }],
  ['ambiguous public user', { id: 'user-a' }, { findUsersByAuthId: async () => [{ company_id: 'company-a' }, { company_id: 'company-b' }] }],
  ['ambiguous client link', { id: 'user-a' }, { findClientsByCompanyId: async () => [{ id: 'client-a', company_id: 'company-a' }, { id: 'client-b', company_id: 'company-a' }] }],
  ['cross-company client', { id: 'user-a' }, { findClientsByCompanyId: async () => [{ id: 'client-a', company_id: 'company-b' }] }],
]) {
  test(`I-03 fails closed on ${name}`, async () => {
    await assert.rejects(
      resolveAuthoritativeTenant(authUser, repository(overrides)),
      (error) => error.code === 'TENANT_CONTEXT_FORBIDDEN' && error.statusCode === 403,
    );
  });
}

test('I-03 subscription selector rejects cross-tenant rows', () => {
  const tenant = { companyId: 'company-a', clientId: 'client-a' };
  assert.equal(subscriptionBelongsToTenant({ client_id: 'client-a' }, tenant), true);
  assert.equal(subscriptionBelongsToTenant({ company_id: 'company-a' }, tenant), true);
  assert.equal(subscriptionBelongsToTenant({ client_id: 'client-b' }, tenant), false);
  assert.equal(subscriptionBelongsToTenant({ company_id: 'company-b' }, tenant), false);
});
