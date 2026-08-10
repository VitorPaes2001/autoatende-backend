/**
 * __AUTOATENDE_STRIPE_PHASE2R_D5G_B_CUSTOMER_BILLING_PLAN_STATUS_ROUTE__
 *
 * Corrige resolução de Meu Plano e limite de usuários para clientes criados
 * pelo fluxo Stripe/provisionamento.
 *
 * Decisão:
 * - Não escreve no banco.
 * - Não altera implantação.
 * - Não conecta WhatsApp.
 * - Resolve tenant pelo usuário autenticado.
 */

'use strict';

const express = require('express');
const {
  getSupabaseAdminClient,
  isSupabaseAdminUnavailableError,
} = require('../config/supabase');
const {
  resolveAuthoritativeTenant,
  subscriptionBelongsToTenant,
  tenantForbidden,
} = require('../security/authoritativeTenant');

const safeLogger = require('../security/safeLogger');
const { safeErrorFields } = require('../security/telemetrySanitizer');

const router = express.Router();

const PLAN_DEFAULTS = {
  essencial: {
    key: 'essencial',
    label: 'Essencial',
    internalPlan: 'starter',
    agents: 1,
    marketingTemplates: 100,
    utilityTemplates: 600,
    templates: 700,
    priceCents: 24990,
  },
  profissional: {
    key: 'profissional',
    label: 'Profissional',
    internalPlan: 'pro',
    agents: 4,
    marketingTemplates: 250,
    utilityTemplates: 1500,
    templates: 1750,
    priceCents: 44990,
  },
  business: {
    key: 'business',
    label: 'Business',
    internalPlan: 'business',
    agents: 8,
    marketingTemplates: 500,
    utilityTemplates: 3000,
    templates: 3500,
    priceCents: 69990,
  },
}; // __AUTOATENDE_STRIPE_PHASE2R_D5H_B3_TEMPLATE_CATEGORY_LIMITS__

function getSupabase() {
  return getSupabaseAdminClient();
}

function preserveAdminUnavailable(fallback) {
  return (error) => {
    if (isSupabaseAdminUnavailableError(error)) throw error;
    return fallback;
  };
}

function bearerFromRequest(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
}

function safeString(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function normalize(value) {
  return safeString(value, 255)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function firstString(...values) {
  for (const value of values) {
    const str = safeString(value, 255);
    if (str) return str;
  }

  return '';
}

function normalizePlanKey(value) {
  const text = normalize(value);

  if (!text) return '';

  if (text.includes('business')) return 'business';
  if (text.includes('profissional') || text.includes('professional') || text === 'pro') return 'profissional';
  if (text.includes('essencial') || text.includes('essential') || text.includes('starter') || text === 'start') return 'essencial';

  return text;
}

function planLabel(planKey, fallback = '') {
  if (planKey === 'business') return 'Business';
  if (planKey === 'profissional') return 'Profissional';
  if (planKey === 'essencial') return 'Essencial';

  const raw = safeString(fallback, 80);

  if (!raw) return 'Não identificado';

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function mapInternalPlan(planKey) {
  if (planKey === 'business') return 'business';
  if (planKey === 'profissional') return 'pro';
  if (planKey === 'essencial') return 'starter';

  return planKey || '';
}

function pickPlanFromDb(plans, planKey) {
  const wanted = normalizePlanKey(planKey);

  if (!wanted) return null;

  return (plans || []).find((plan) => {
    const nameKey = normalizePlanKey(plan.name);
    const keyKey = normalizePlanKey(plan.key);
    const internalKey = normalizePlanKey(plan.internal_plan);

    return nameKey === wanted || keyKey === wanted || internalKey === wanted;
  }) || null;
}

async function requireAuthUser(req) {
  const token = bearerFromRequest(req);

  if (!token) {
    const error = new Error('Token de autenticação não fornecido');
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    const authError = new Error('Token de autenticação inválido');
    authError.statusCode = 401;
    throw authError;
  }

  return data.user;
}

async function selectOne(table, queryFn) {
  const supabase = getSupabase();
  let query = supabase.from(table).select('*').limit(1);

  query = queryFn(query);

  const { data, error } = await query.maybeSingle();

  if (error) {
    const e = new Error(`${table}_select_failed`);
    e.statusCode = 500;
    e.code = 'BILLING_DATA_SOURCE_FAILED';
    throw e;
  }

  return data || null;
}

async function selectMany(table, queryFn, limit = 100) {
  const supabase = getSupabase();
  let query = supabase.from(table).select('*').limit(limit);

  query = queryFn ? queryFn(query) : query;

  const { data, error } = await query;

  if (error) {
    const e = new Error(`${table}_select_failed`);
    e.statusCode = 500;
    e.code = 'BILLING_DATA_SOURCE_FAILED';
    throw e;
  }

  return Array.isArray(data) ? data : [];
}

async function resolveTenantForAuthUser(authUser) {
  const repository = {
    findUsersByAuthId: (userId) => selectMany(
      'users',
      (query) => query.eq('id', userId),
      2,
    ),
    findCompaniesById: (companyId) => selectMany(
      'companies',
      (query) => query.eq('id', companyId),
      2,
    ),
    findClientsByCompanyId: (companyId) => selectMany(
      'clients',
      (query) => query.eq('company_id', companyId),
      2,
    ),
  };

  return resolveAuthoritativeTenant(authUser, repository);
}

async function findSubscription(tenant) {
  const byClient = await selectMany(
    'subscriptions',
    (query) => query.eq('client_id', tenant.clientId).order('created_at', { ascending: false }),
    10,
  );

  const byCompany = await selectMany(
    'subscriptions',
    (query) => query.eq('company_id', tenant.companyId).order('created_at', { ascending: false }),
    10,
  );

  const candidates = [...byClient, ...byCompany];
  if (candidates.some((item) => !subscriptionBelongsToTenant(item, tenant))) {
    throw tenantForbidden();
  }

  const unique = [];
  const seen = new Set();
  for (const item of candidates) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  const active = unique.find((item) => ['active', 'trialing'].includes(normalize(item.status)));
  return active || unique[0] || null;
}

async function loadPlans() {
  return selectMany('plans', (query) => query.eq('is_active', true), 50).catch(preserveAdminUnavailable([]));
}

function resolvePlan({ client, subscription, plans }) {
  // __AUTOATENDE_STRIPE_PHASE2R_D5H_B3_R2_REWRITE_RESOLVE_PLAN_CLEAN__
  const rawPlan = firstString(
    client?.plan,
    subscription?.plan,
    subscription?.plan_key,
    subscription?.plan_name,
  );

  let planKey = normalizePlanKey(rawPlan);

  const dbPlanById = subscription?.plan_id
    ? (plans || []).find((plan) => String(plan.id) === String(subscription.plan_id))
    : null;

  if (dbPlanById) {
    planKey = normalizePlanKey(dbPlanById.name || dbPlanById.key || rawPlan);
  }

  if (!planKey) planKey = 'profissional';

  const dbPlan = dbPlanById || pickPlanFromDb(plans, planKey);
  const defaults = PLAN_DEFAULTS[planKey] || PLAN_DEFAULTS.profissional;

  const maxAgents = Number(dbPlan?.max_agents ?? dbPlan?.agents_limit ?? defaults.agents);

  const marketingTemplatesLimit = Number(
    dbPlan?.marketing_templates_limit ??
    dbPlan?.marketing_templates ??
    defaults.marketingTemplates
  );

  const utilityTemplatesLimit = Number(
    dbPlan?.utility_templates_limit ??
    dbPlan?.utility_templates ??
    dbPlan?.utility_authentication_templates_limit ??
    dbPlan?.utility_authentication_templates ??
    defaults.utilityTemplates
  );

  const totalTemplatesFromCategories =
    (Number.isFinite(marketingTemplatesLimit) ? marketingTemplatesLimit : 0) +
    (Number.isFinite(utilityTemplatesLimit) ? utilityTemplatesLimit : 0);

  const rawTemplatesLimit =
    dbPlan?.templates_limit ??
    dbPlan?.total_templates_limit ??
    (totalTemplatesFromCategories > 0 ? totalTemplatesFromCategories : defaults.templates);

  const templatesLimit = Number(rawTemplatesLimit);
  const priceCents = Number(dbPlan?.price_cents ?? defaults.priceCents);

  const safeAgents = Number.isFinite(maxAgents) ? maxAgents : defaults.agents;
  const safeMarketingTemplates = Number.isFinite(marketingTemplatesLimit)
    ? marketingTemplatesLimit
    : defaults.marketingTemplates;
  const safeUtilityTemplates = Number.isFinite(utilityTemplatesLimit)
    ? utilityTemplatesLimit
    : defaults.utilityTemplates;
  const safeTemplates = Number.isFinite(templatesLimit) ? templatesLimit : defaults.templates;

  return {
    key: planKey,
    plan: planLabel(planKey, rawPlan),
    label: planLabel(planKey, rawPlan),
    internalPlan: mapInternalPlan(planKey),
    rawPlan,
    source: dbPlan ? 'plans_table' : 'client_or_subscription_fallback',
    planRow: dbPlan || null,
    limits: {
      agents: safeAgents,
      users: safeAgents,
      max_agents: safeAgents,

      templates: safeTemplates,
      templates_limit: safeTemplates,
      total_templates: safeTemplates,
      total_templates_limit: safeTemplates,

      marketing_templates: safeMarketingTemplates,
      marketingTemplates: safeMarketingTemplates,
      marketing_templates_limit: safeMarketingTemplates,

      utility_templates: safeUtilityTemplates,
      utilityTemplates: safeUtilityTemplates,
      utility_templates_limit: safeUtilityTemplates,
      utility_authentication_templates: safeUtilityTemplates,
      utility_authentication_templates_limit: safeUtilityTemplates,

      messages: null,
    },
    price_cents: Number.isFinite(priceCents) ? priceCents : defaults.priceCents,
  };
}


async function countUsers(companyId) {
  const supabase = getSupabase();

  const { count: totalCount, error: totalError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (totalError) throw totalError;

  const { count: agentCount, error: agentError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .neq('role', 'company');

  if (agentError) throw agentError;

  return {
    totalUsers: Number(totalCount || 0),
    agentsOnly: Number(agentCount || 0),
  };
}

function buildStatusPayload({ tenant, subscription, planInfo, usage }) {
  const status = safeString(subscription?.status || tenant.client?.plan_status || 'active', 80);
  const agentLimit = Number(planInfo.limits.agents || 1);
  const usedTotal = Number(usage.totalUsers || 0);
  const remaining = Math.max(agentLimit - usedTotal, 0);

  return {
    ok: true,
    success: true,
    source: 'tenant_aware_d5g_b',
    company_id: tenant.companyId,
    companyId: tenant.companyId,
    client_id: tenant.clientId,
    clientId: tenant.clientId,
    user_id: tenant.userId,
    userId: tenant.userId,

    plan: planInfo.plan,
    plan_key: planInfo.key,
    planKey: planInfo.key,
    internal_plan: planInfo.internalPlan,
    internalPlan: planInfo.internalPlan,
    status,
    subscription_status: status,
    plan_status: tenant.client?.plan_status || status,

    price_cents: planInfo.price_cents,

    templates_limit: planInfo.limits.templates_limit,
    total_templates_limit: planInfo.limits.total_templates_limit,
    marketing_templates_limit: planInfo.limits.marketing_templates_limit,
    utility_templates_limit: planInfo.limits.utility_templates_limit,
    utility_authentication_templates_limit: planInfo.limits.utility_authentication_templates_limit,

    currency: 'BRL',

    limits: {
      ...planInfo.limits,
      agentLimit,
      userLimit: agentLimit,
    },

    usage: {
      users: usedTotal,
      agents: usedTotal,
      agents_only: usage.agentsOnly,
      total_users: usedTotal,
      templates: 0,
      messages: 0,
    },

    blocked: {
      blocked: false,
      is_blocked: false,
      reason: null,
    },

    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          provider: subscription.provider,
          stripe_customer_id: subscription.stripe_customer_id || null,
          stripe_subscription_id: subscription.stripe_subscription_id || null,
          start_date: subscription.start_date || null,
          end_date: subscription.end_date || null,
          plan_id: subscription.plan_id || null,
        }
      : null,

    company: tenant.company
      ? {
          id: tenant.company.id,
          name: tenant.company.name,
          status: tenant.company.status,
          slug: tenant.company.slug,
        }
      : null,

    client: tenant.client
      ? {
          id: tenant.client.id,
          name: tenant.client.name,
          email: tenant.client.email,
          status: tenant.client.status,
          plan: tenant.client.plan,
          plan_status: tenant.client.plan_status,
          bot_active: tenant.client.bot_active,
        }
      : null,
  };
}

function buildSeatStatusPayload(statusPayload) {
  const limit = Number(statusPayload.limits?.agentLimit || statusPayload.limits?.agents || 1);
  const used = Number(statusPayload.usage?.users || 0);
  const remaining = Math.max(limit - used, 0);
  const ratio = limit > 0 ? used / limit : 1;

  const status = {
    source: 'tenant_aware_d5g_b',
    plan: statusPayload.plan,
    planLabel: statusPayload.plan,
    plan_key: statusPayload.plan_key,
    planKey: statusPayload.plan_key,
    rawPlan: statusPayload.internal_plan || statusPayload.plan_key,
    resolvedPlanKey: statusPayload.plan_key,
    limit,
    agentLimit: limit,
    userLimit: limit,
    used,
    usersUsed: used,
    registeredAgents: used,
    agentsUsed: used,
    agentsOnly: Number(statusPayload.usage?.agents_only || 0),
    remaining,
    available: remaining,
    isAtLimit: used >= limit,
    isNearLimit: ratio >= 0.8 && used < limit,
    company_id: statusPayload.company_id,
    client_id: statusPayload.client_id,

    templatesLimit: Number(statusPayload.limits?.templates_limit || 0),
    marketingTemplatesLimit: Number(statusPayload.limits?.marketing_templates_limit || 0),
    utilityTemplatesLimit: Number(statusPayload.limits?.utility_templates_limit || 0),
    utilityAuthenticationTemplatesLimit: Number(statusPayload.limits?.utility_authentication_templates_limit || 0),
  };

  return {
    ok: true,
    success: true,
    status,
    data: status,
  };
}

async function getTenantBillingStatus(req) {
  const authUser = await requireAuthUser(req);
  const tenant = await resolveTenantForAuthUser(authUser);
  const [subscription, plans, usage] = await Promise.all([
    findSubscription(tenant),
    loadPlans(),
    countUsers(tenant.companyId),
  ]);

  const planInfo = resolvePlan({
    client: tenant.client,
    subscription,
    plans,
  });

  return buildStatusPayload({
    tenant,
    subscription,
    planInfo,
    usage,
  });
}

async function asyncHandler(req, res, next) {
  try {
    const status = await getTenantBillingStatus(req);
    return res.json(status);
  } catch (error) {
    return next(error);
  }
}

router.get('/api/billing/status', asyncHandler);

router.get('/api/users/agents/seat-status', async (req, res, next) => {
  try {
    const status = await getTenantBillingStatus(req);
    return res.json(buildSeatStatusPayload(status));
  } catch (error) {
    return next(error);
  }
});

router.use((error, req, res, next) => {
  if (!error) return next();

  if (error.code === 'TENANT_CONTEXT_FORBIDDEN') {
    return res.status(403).json({
      ok: false,
      success: false,
      source: 'tenant_aware_d5g_b',
      error: 'tenant_context_forbidden',
      message: 'Não foi possível validar o contexto de billing.',
      details: null,
    });
  }

  if (isSupabaseAdminUnavailableError(error)) {
    return res.status(503).json({
      ok: false,
      success: false,
      source: 'tenant_aware_d5g_b',
      error: 'billing_admin_unavailable',
      message: 'Serviço administrativo de billing temporariamente indisponível.',
      details: null,
    });
  }

  safeLogger.error('[billing.tenant_aware] request_failed', safeErrorFields(error, {
    method: req.method,
    route: String(req.originalUrl || req.url || '').split('?')[0],
  }));

  const requestedStatus = Number(error.statusCode || error.status || 500);
  const statusCode = requestedStatus === 401 ? 401 : requestedStatus === 403 ? 403 : 500;
  return res.status(statusCode).json({
    ok: false,
    success: false,
    source: 'tenant_aware_d5g_b',
    error: statusCode === 401 ? 'authentication_required' : 'billing_status_failed',
    message: statusCode === 401
      ? 'Autenticação inválida ou ausente.'
      : 'Não foi possível consultar o status de billing.',
    details: null,
  });
});

module.exports = router;
