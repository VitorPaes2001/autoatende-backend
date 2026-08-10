'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasAuthoritativePlatformOwnerClaim,
} = require('../../src/middlewares/platformOwnerOnly.middleware');

test('I-02 accepts only exact server-controlled app_metadata claim', () => {
  assert.equal(hasAuthoritativePlatformOwnerClaim({
    app_metadata: { platform_role: 'platform_owner' },
  }), true);
});

for (const user of [
  { email: 'owner@example.com' },
  { role: 'platform_owner' },
  { app_metadata: { role: 'platform_owner' } },
  { app_metadata: { platform_role: 'super_admin' } },
  { app_metadata: { platform_role: 'Platform_Owner' } },
  { app_metadata: { platform_owner: true } },
  { user_metadata: { platform_role: 'platform_owner' } },
  { user_metadata: { is_platform_owner: true } },
  null,
]) {
  test(`I-02 rejects non-authoritative claim: ${JSON.stringify(user)}`, () => {
    assert.equal(hasAuthoritativePlatformOwnerClaim(user), false);
  });
}
