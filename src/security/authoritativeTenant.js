'use strict';

const authoritativeScopes = new WeakSet();
const INACTIVE_STATUSES = new Set([
  'inactive', 'disabled', 'suspended', 'blocked', 'archived', 'deleted',
  'cancelled', 'canceled', 'terminated',
]);

function tenantForbidden() {
  const error = new Error('tenant_context_forbidden');
  error.code = 'TENANT_CONTEXT_FORBIDDEN';
  error.statusCode = 403;
  return error;
}

function normalizedId(value) {
  return String(value ?? '').trim();
}

function relationshipIsActive(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.is_active === false || record.active === false || record.enabled === false) return false;
  if (record.disabled === true || record.suspended === true || record.deleted_at) return false;
  const status = normalizedId(record.status).toLowerCase();
  return !status || !INACTIVE_STATUSES.has(status);
}

function metadataIdentifiers(authUser) {
  const sources = [authUser?.app_metadata, authUser?.user_metadata];
  const companyIds = new Set();
  const clientIds = new Set();

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const value of [source.company_id, source.companyId]) {
      const id = normalizedId(value);
      if (id) companyIds.add(id);
    }
    for (const value of [source.client_id, source.clientId]) {
      const id = normalizedId(value);
      if (id) clientIds.add(id);
    }
  }

  return { companyIds, clientIds };
}

function exactlyOne(rows) {
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

function createAuthoritativeCompanyScope(companyId, authority = 'server_side_unique_whatsapp_account') {
  const normalizedCompanyId = normalizedId(companyId);
  if (!normalizedCompanyId) throw tenantForbidden();
  const scope = Object.freeze({ companyId: normalizedCompanyId, authority });
  authoritativeScopes.add(scope);
  return scope;
}

function requireAuthoritativeCompanyScope(scope) {
  if (!scope || typeof scope !== 'object' || !authoritativeScopes.has(scope)) throw tenantForbidden();
  const companyId = normalizedId(scope.companyId);
  if (!companyId) throw tenantForbidden();
  return companyId;
}

async function resolveAuthoritativeTenant(authUser, repository) {
  const userId = normalizedId(authUser?.id);
  if (!userId) throw tenantForbidden();

  const publicUser = exactlyOne(await repository.findUsersByAuthId(userId));
  const companyId = normalizedId(publicUser?.company_id);
  if (!publicUser || !companyId || !relationshipIsActive(publicUser)) throw tenantForbidden();

  const company = exactlyOne(await repository.findCompaniesById(companyId));
  if (!company || normalizedId(company.id) !== companyId || !relationshipIsActive(company)) {
    throw tenantForbidden();
  }

  const clients = await repository.findClientsByCompanyId(companyId);
  const client = exactlyOne(clients);
  const clientId = normalizedId(client?.id);
  if (
    !client ||
    !clientId ||
    normalizedId(client.company_id) !== companyId ||
    !relationshipIsActive(client)
  ) {
    throw tenantForbidden();
  }

  const linkedClientId = normalizedId(company.client_id);
  if (linkedClientId && linkedClientId !== clientId) throw tenantForbidden();

  const metadata = metadataIdentifiers(authUser);
  if ([...metadata.companyIds].some((id) => id !== companyId)) throw tenantForbidden();
  if ([...metadata.clientIds].some((id) => id !== clientId)) throw tenantForbidden();

  return {
    authUser,
    userId,
    publicUser,
    companyId,
    clientId,
    company,
    client,
  };
}

function subscriptionBelongsToTenant(subscription, tenant) {
  if (!subscription || !tenant) return false;
  const clientId = normalizedId(subscription.client_id);
  const companyId = normalizedId(subscription.company_id);
  if (clientId && clientId !== normalizedId(tenant.clientId)) return false;
  if (companyId && companyId !== normalizedId(tenant.companyId)) return false;
  return clientId === normalizedId(tenant.clientId) || companyId === normalizedId(tenant.companyId);
}

module.exports = {
  tenantForbidden,
  metadataIdentifiers,
  relationshipIsActive,
  createAuthoritativeCompanyScope,
  requireAuthoritativeCompanyScope,
  resolveAuthoritativeTenant,
  subscriptionBelongsToTenant,
};
