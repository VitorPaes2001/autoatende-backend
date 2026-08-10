const { getSupabaseAdminConfig } = require('../config/supabase');

const ALLOWED_STATUS = new Set([
  'pending',
  'contacted',
  'in_progress',
  'configured',
  'done',
  'canceled',
]);

function requireSupabase() {
  return getSupabaseAdminConfig();
}

function safeString(value, max = 500) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function safeLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

function buildHeaders(config, extra = {}) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    ...extra,
  };
}

function encodeLike(value) {
  return safeString(value, 120)
    .replace(/[%*]/g, '')
    .replace(/[(),]/g, ' ')
    .trim();
}

async function listQueue(query = {}) {
  const config = requireSupabase();

  const limit = safeLimit(query.limit);
  const status = safeString(query.status, 80);
  const search = encodeLike(query.q || query.search || '');

  const params = new URLSearchParams();

  params.set('select', '*');
  params.set('order', 'created_at.desc');
  params.set('limit', String(limit));

  if (status && status !== 'all') {
    if (!ALLOWED_STATUS.has(status)) {
      const error = new Error('invalid_status');
      error.statusCode = 400;
      throw error;
    }

    params.set('status', `eq.${status}`);
  }

  if (search) {
    params.set(
      'or',
      `(customer_email.ilike.*${search}*,customer_name.ilike.*${search}*,company_name.ilike.*${search}*,checkout_session_id.ilike.*${search}*,stripe_subscription_id.ilike.*${search}*)`
    );
  }

  const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/billing_provisioning_queue?${params.toString()}`;

  const response = await fetch(endpoint, {
    headers: buildHeaders(config),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error('queue_list_failed');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  const stats = await getQueueStats().catch(() => null);

  return {
    ok: true,
    rows: Array.isArray(data) ? data : [],
    count: Array.isArray(data) ? data.length : 0,
    stats,
  };
}

async function getQueueById(id) {
  const config = requireSupabase();
  const safeId = safeString(id, 80);

  if (!safeId) {
    const error = new Error('missing_id');
    error.statusCode = 400;
    throw error;
  }

  const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/billing_provisioning_queue?id=eq.${encodeURIComponent(safeId)}&select=*`;

  const response = await fetch(endpoint, {
    headers: buildHeaders(config),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error('queue_read_failed');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;

  if (!row) {
    const error = new Error('queue_item_not_found');
    error.statusCode = 404;
    throw error;
  }

  return {
    ok: true,
    row,
  };
}

async function getQueueStats() {
  const config = requireSupabase();

  const params = new URLSearchParams();
  params.set('select', 'status');

  const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/billing_provisioning_queue?${params.toString()}`;

  const response = await fetch(endpoint, {
    headers: buildHeaders(config),
  });

  const data = await response.json().catch(() => []);

  if (!response.ok) {
    return null;
  }

  const stats = {
    total: 0,
    pending: 0,
    contacted: 0,
    in_progress: 0,
    configured: 0,
    done: 0,
    canceled: 0,
  };

  for (const row of Array.isArray(data) ? data : []) {
    stats.total += 1;

    if (row.status && Object.prototype.hasOwnProperty.call(stats, row.status)) {
      stats[row.status] += 1;
    }
  }

  return stats;
}

async function updateQueueItem(id, payload = {}) {
  const config = requireSupabase();
  const safeId = safeString(id, 80);

  if (!safeId) {
    const error = new Error('missing_id');
    error.statusCode = 400;
    throw error;
  }

  const patch = {};

  if (payload.status !== undefined) {
    const status = safeString(payload.status, 80);

    if (!ALLOWED_STATUS.has(status)) {
      const error = new Error('invalid_status');
      error.statusCode = 400;
      throw error;
    }

    patch.status = status;

    if (status === 'contacted') patch.contacted_at = new Date().toISOString();
    if (status === 'in_progress') patch.started_at = new Date().toISOString();
    if (status === 'done') patch.completed_at = new Date().toISOString();
    if (status === 'canceled') patch.canceled_at = new Date().toISOString();
  }

  if (payload.notes !== undefined) {
    patch.notes = safeString(payload.notes, 3000) || null;
  }

  if (payload.priority !== undefined) {
    const priority = Number(payload.priority);

    if (!Number.isFinite(priority)) {
      const error = new Error('invalid_priority');
      error.statusCode = 400;
      throw error;
    }

    patch.priority = Math.max(0, Math.min(100, Math.trunc(priority)));
  }

  if (Object.keys(patch).length === 0) {
    const error = new Error('empty_update');
    error.statusCode = 400;
    throw error;
  }

  const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/billing_provisioning_queue?id=eq.${encodeURIComponent(safeId)}`;

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: buildHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(patch),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error('queue_update_failed');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;

  return {
    ok: true,
    row,
  };
}


/**
 * __AUTOATENDE_STRIPE_PHASE2R_D5D_B_ADMIN_COMPANY_ACTIVATION_SERVICE__
 *
 * Prepara uma contratação paga para virar empresa/tenant operacional.
 *
 * Decisão de segurança:
 * - Cria client/company/subscription/bot_settings mínimo.
 * - Não cria usuário de login.
 * - Não cria perfil auth.
 * - Não conecta WhatsApp.
 * - Não ativa bot automaticamente.
 * - Guarda vínculo em billing_provisioning_queue.metadata.activation.
 *
 * A função só escreve no banco quando chamada pelo endpoint admin protegido.
 */

function aaD5dBNowIso() {
  return new Date().toISOString();
}

function aaD5dBToday() {
  return new Date().toISOString().slice(0, 10);
}

function aaD5dBUuid() {
  return require('crypto').randomUUID();
}

function aaD5dBNormalizePlan(value) {
  const normalized = safeString(value, 120).toLowerCase();

  if (normalized.includes('business')) return 'business';
  if (normalized.includes('prof') || normalized === 'pro') return 'profissional';
  if (normalized.includes('essencial') || normalized.includes('starter') || normalized.includes('start')) return 'essencial';

  return normalized || 'profissional';
}

function aaD5dBInternalPlan(planKey) {
  if (planKey === 'business') return 'business';
  if (planKey === 'profissional') return 'pro';
  if (planKey === 'essencial') return 'starter';
  return planKey || 'pro';
}

function aaD5dBSlug(value, suffix) {
  const base = safeString(value, 120)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 58) || 'empresa';

  const safeSuffix = safeString(suffix, 20).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || aaD5dBUuid().slice(0, 8);

  return `${base}-${safeSuffix}`.slice(0, 72);
}

function aaD5dBParseMetadata(value) {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  return {};
}

function aaD5dBSafeEmail(row) {
  const email = safeString(row.customer_email, 240);

  if (email && email.includes('@')) return email.toLowerCase();

  return `cliente-${safeString(row.id, 40).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@autoatendeai.local`;
}

function aaD5dBRestBase(config) {
  return `${config.url.replace(/\/$/, '')}/rest/v1`;
}

async function aaD5dBRestRequest(config, table, params, options = {}) {
  const url = `${aaD5dBRestBase(config)}/${table}${params ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: buildHeaders(config, {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    }),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(options.errorCode || 'rest_request_failed');
    error.statusCode = response.status;
    error.details = {
      table,
      response: typeof data === 'string' ? data.slice(0, 600) : data,
    };
    throw error;
  }

  return data;
}

async function aaD5dBSelectOne(config, table, filters = {}) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('limit', '1');

  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && String(value).trim()) {
      params.set(key, `eq.${String(value).trim()}`);
    }
  }

  const data = await aaD5dBRestRequest(config, table, params, {
    errorCode: `${table}_select_failed`,
  });

  return Array.isArray(data) ? data[0] || null : null;
}

async function aaD5dBInsertOne(config, table, payload) {
  const data = await aaD5dBRestRequest(config, table, null, {
    method: 'POST',
    body: payload,
    prefer: 'return=representation',
    errorCode: `${table}_insert_failed`,
  });

  return Array.isArray(data) ? data[0] || null : data;
}

async function aaD5dBPatchOneById(config, table, id, patch) {
  const params = new URLSearchParams();
  params.set('id', `eq.${String(id).trim()}`);

  const data = await aaD5dBRestRequest(config, table, params, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
    errorCode: `${table}_patch_failed`,
  });

  return Array.isArray(data) ? data[0] || null : data;
}

function aaD5dBAssertQueueCanActivate(row) {
  if (!row) {
    const error = new Error('queue_item_not_found');
    error.statusCode = 404;
    throw error;
  }

  const paymentStatus = safeString(row.payment_status, 80).toLowerCase();
  const subscriptionStatus = safeString(row.subscription_status, 80).toLowerCase();
  const queueStatus = safeString(row.status, 80).toLowerCase();

  if (queueStatus === 'canceled') {
    const error = new Error('queue_item_canceled');
    error.statusCode = 409;
    throw error;
  }

  if (paymentStatus !== 'paid') {
    const error = new Error('payment_not_paid');
    error.statusCode = 409;
    error.details = { payment_status: row.payment_status || null };
    throw error;
  }

  if (subscriptionStatus && !['active', 'trialing'].includes(subscriptionStatus)) {
    const error = new Error('subscription_not_active');
    error.statusCode = 409;
    error.details = { subscription_status: row.subscription_status || null };
    throw error;
  }
}

async function aaD5dBTryRecoverExistingActivation(config, row, metadata) {
  const activation = metadata.activation || metadata.companyActivation || null;

  if (activation && activation.companyId && activation.clientId) {
    return {
      ok: true,
      idempotent: true,
      recovered: false,
      activation,
      message: 'activation_already_prepared_in_queue_metadata',
    };
  }

  const stripeSubscriptionId = safeString(row.stripe_subscription_id, 255);

  if (!stripeSubscriptionId) return null;

  const existingSubscription = await aaD5dBSelectOne(config, 'subscriptions', {
    stripe_subscription_id: stripeSubscriptionId,
  }).catch(() => null);

  if (!existingSubscription || !existingSubscription.company_id || !existingSubscription.client_id) {
    return null;
  }

  const recoveredActivation = {
    version: 'd5d_b',
    recoveredAt: aaD5dBNowIso(),
    companyId: existingSubscription.company_id,
    clientId: existingSubscription.client_id,
    subscriptionId: existingSubscription.id,
    botSettingsId: null,
    userId: existingSubscription.user_id || null,
    requiresOwnerInvite: true,
    whatsappConnectionRequired: true,
    assistantSetupRequired: true,
    source: 'existing_subscription_recovery',
  };

  const nextMetadata = {
    ...metadata,
    activation: recoveredActivation,
  };

  const patchedQueue = await aaD5dBPatchOneById(config, 'billing_provisioning_queue', row.id, {
    status: row.status === 'pending' || row.status === 'contacted' || row.status === 'in_progress' ? 'configured' : row.status,
    started_at: row.started_at || aaD5dBNowIso(),
    metadata: nextMetadata,
    updated_at: aaD5dBNowIso(),
  });

  return {
    ok: true,
    idempotent: true,
    recovered: true,
    activation: recoveredActivation,
    row: patchedQueue,
    message: 'activation_recovered_from_existing_subscription',
  };
}

async function prepareCompanyActivation(id, actor = {}) {
  const config = requireSupabase();
  const queueResult = await getQueueById(id);
  const row = queueResult.row;

  aaD5dBAssertQueueCanActivate(row);

  const metadata = aaD5dBParseMetadata(row.metadata);
  const recovered = await aaD5dBTryRecoverExistingActivation(config, row, metadata);

  if (recovered) return recovered;

  const now = aaD5dBNowIso();

  const queueId = safeString(row.id, 80);
  const planKey = aaD5dBNormalizePlan(row.plan_key || row.internal_plan || metadata?.rawMetadata?.aa_plan_key);
  const internalPlan = safeString(row.internal_plan, 80) || aaD5dBInternalPlan(planKey);
  const companyName =
    safeString(row.company_name, 180) ||
    safeString(row.customer_name, 180) ||
    'Empresa AutoAtendeAI';

  const email = aaD5dBSafeEmail(row);
  const clientId = aaD5dBUuid();
  const companyId = aaD5dBUuid();
  const subscriptionId = aaD5dBUuid();
  const botSettingsId = aaD5dBUuid();

  const slug = aaD5dBSlug(companyName, queueId);

  const client = await aaD5dBInsertOne(config, 'clients', {
    id: clientId,
    name: companyName,
    email,
    status: 'active',
    plan: internalPlan,
    plan_status: safeString(row.subscription_status, 80) || 'active',
    bot_active: false,
    user_id: null,
    created_at: now,
  });

  const company = await aaD5dBInsertOne(config, 'companies', {
    id: companyId,
    name: companyName,
    client_id: clientId,
    slug,
    status: 'active',
    created_at: now,
  });

  const patchedClient = await aaD5dBPatchOneById(config, 'clients', clientId, {
    company_id: companyId,
  });

  const subscription = await aaD5dBInsertOne(config, 'subscriptions', {
    id: subscriptionId,
    client_id: clientId,
    company_id: companyId,
    user_id: null,
    plan_id: null,
    status: safeString(row.subscription_status, 80) || 'active',
    provider: 'stripe',
    start_date: aaD5dBToday(),
    end_date: null,
    stripe_customer_id: safeString(row.stripe_customer_id, 255),
    stripe_subscription_id: safeString(row.stripe_subscription_id, 255),
    created_at: now,
  });

  const botSettings = await aaD5dBInsertOne(config, 'bot_settings', {
    id: botSettingsId,
    client_id: clientId,
    active: false,
    pause_on_human: true,
    onboarding_completed: false,
    created_at: now,
    config: {
      source: 'stripe_provisioning_activation_prepare',
      queueId,
      companyId,
      planKey,
      internalPlan,
      preparedAt: now,
      assistantSetupRequired: true,
      whatsappConnectionRequired: true,
    },
  }).catch((error) => {
    return {
      id: null,
      skipped: true,
      reason: 'bot_settings_insert_failed_non_blocking',
      details: error.details || error.message || null,
    };
  });

  const activation = {
    version: 'd5d_b',
    preparedAt: now,
    preparedBy: {
      id: actor.id || actor.user_id || null,
      email: actor.email || actor.user_email || null,
      role: actor.role || null,
    },
    queueId,
    checkoutSessionId: row.checkout_session_id || null,
    companyId,
    clientId,
    subscriptionId,
    botSettingsId: botSettings && botSettings.id ? botSettings.id : null,
    userId: null,
    planKey,
    internalPlan,
    companyName,
    customerEmail: email,
    requiresOwnerInvite: true,
    whatsappConnectionRequired: true,
    assistantSetupRequired: true,
    notes: 'Empresa preparada a partir de contratação Stripe. Login, WhatsApp e assistente ainda exigem implantação assistida.',
  };

  const nextMetadata = {
    ...metadata,
    activation,
  };

  const patchedQueue = await aaD5dBPatchOneById(config, 'billing_provisioning_queue', row.id, {
    status: 'configured',
    started_at: row.started_at || now,
    metadata: nextMetadata,
    updated_at: now,
  });

  return {
    ok: true,
    idempotent: false,
    message: 'company_activation_prepared',
    activation,
    created: {
      client,
      company,
      patchedClient,
      subscription,
      botSettings,
    },
    row: patchedQueue,
  };
}



/**
 * __AUTOATENDE_STRIPE_PHASE2R_D5E_B_OWNER_ACCESS_SERVICE__
 *
 * Prepara o acesso do dono da empresa após a base técnica já existir.
 *
 * Decisão:
 * - Não automatiza implantação operacional.
 * - Não conecta WhatsApp.
 * - Não ativa bot.
 * - Não conclui assistente.
 * - Apenas cria/vincula acesso do dono à company/client/subscription já preparada.
 *
 * Esta função só escreve no banco/Auth quando chamada pelo endpoint admin protegido.
 */

function aaD5eBNowIso() {
  return new Date().toISOString();
}

function aaD5eBUuid() {
  return require('crypto').randomUUID();
}

function aaD5eBRandomPassword() {
  const crypto = require('crypto');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*-_';
  let password = '';

  for (let i = 0; i < 18; i += 1) {
    password += alphabet[crypto.randomInt(0, alphabet.length)];
  }

  if (!/[A-Z]/.test(password)) password += 'A';
  if (!/[a-z]/.test(password)) password += 'a';
  if (!/[0-9]/.test(password)) password += '7';
  if (!/[!@#%*\-_]/.test(password)) password += '!';

  return password;
}

function aaD5eBNormalizeEmail(value) {
  const email = safeString(value, 240).toLowerCase();

  if (!email || !email.includes('@') || email.endsWith('@autoatendeai.local')) return null;

  return email;
}

function aaD5eBNormalizeName(value) {
  return safeString(value, 160) || 'Dono da empresa';
}

function aaD5eBParseMetadata(value) {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  return {};
}

function aaD5eBRestBase(config) {
  return `${config.url.replace(/\/$/, '')}/rest/v1`;
}

function aaD5eBAuthBase(config) {
  return `${config.url.replace(/\/$/, '')}/auth/v1`;
}

function aaD5eBHeaders(config, extra = {}) {
  return buildHeaders(config, {
    ...extra,
  });
}

async function aaD5eBRestRequest(config, table, params, options = {}) {
  const endpoint = `${aaD5eBRestBase(config)}/${table}${params ? `?${params.toString()}` : ''}`;

  const response = await fetch(endpoint, {
    method: options.method || 'GET',
    headers: aaD5eBHeaders(config, {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    }),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(options.errorCode || 'rest_request_failed');
    error.statusCode = response.status;
    error.details = {
      table,
      response: typeof data === 'string' ? data.slice(0, 800) : data,
    };
    throw error;
  }

  return data;
}

async function aaD5eBSelectOne(config, table, filters = {}) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('limit', '1');

  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && String(value).trim()) {
      params.set(key, `eq.${String(value).trim()}`);
    }
  }

  const data = await aaD5eBRestRequest(config, table, params, {
    errorCode: `${table}_select_failed`,
  });

  return Array.isArray(data) ? data[0] || null : null;
}

async function aaD5eBInsertOne(config, table, payload) {
  const data = await aaD5eBRestRequest(config, table, null, {
    method: 'POST',
    body: payload,
    prefer: 'return=representation',
    errorCode: `${table}_insert_failed`,
  });

  return Array.isArray(data) ? data[0] || null : data;
}

async function aaD5eBPatchById(config, table, id, patch) {
  const params = new URLSearchParams();
  params.set('id', `eq.${String(id).trim()}`);

  const data = await aaD5eBRestRequest(config, table, params, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
    errorCode: `${table}_patch_failed`,
  });

  return Array.isArray(data) ? data[0] || null : data;
}

async function aaD5eBFindAuthUserByEmail(config, email) {
  const endpoint = `${aaD5eBAuthBase(config)}/admin/users?page=1&per_page=1000`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: aaD5eBHeaders(config),
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    return null;
  }

  const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];

  return users.find((user) => String(user.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function aaD5eBCreateAuthUser(config, payload) {
  const endpoint = `${aaD5eBAuthBase(config)}/admin/users`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: aaD5eBHeaders(config, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error('auth_user_create_failed');
    error.statusCode = response.status;
    error.details = typeof data === 'string' ? data.slice(0, 800) : data;
    throw error;
  }

  return data && data.user ? data.user : data;
}

async function aaD5eBUpdateAuthUserMetadata(config, userId, payload) {
  if (!userId) return null;

  const endpoint = `${aaD5eBAuthBase(config)}/admin/users/${encodeURIComponent(userId)}`;

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: aaD5eBHeaders(config, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      details: typeof data === 'string' ? data.slice(0, 600) : data,
    };
  }

  return {
    ok: true,
    user: data && data.user ? data.user : data,
  };
}

function aaD5eBAssertPreparedActivation(row) {
  const metadata = aaD5eBParseMetadata(row?.metadata);
  const activation = metadata.activation || null;

  if (!row) {
    const error = new Error('queue_item_not_found');
    error.statusCode = 404;
    throw error;
  }

  if (!activation || !activation.companyId || !activation.clientId || !activation.subscriptionId) {
    const error = new Error('activation_base_not_prepared');
    error.statusCode = 409;
    error.details = {
      message: 'Prepare primeiro o ambiente/base técnica do cliente.',
    };
    throw error;
  }

  return { metadata, activation };
}

async function prepareOwnerAccess(id, payload = {}, actor = {}) {
  const config = requireSupabase();
  const queueResult = await getQueueById(id);
  const row = queueResult.row;

  const { metadata, activation } = aaD5eBAssertPreparedActivation(row);

  if (activation.userId && activation.ownerAccessPreparedAt) {
    return {
      ok: true,
      idempotent: true,
      message: 'owner_access_already_prepared',
      activation,
      temporaryPassword: null,
      passwordReturned: false,
    };
  }

  const companyId = activation.companyId;
  const clientId = activation.clientId;
  const subscriptionId = activation.subscriptionId;

  const company = await aaD5eBSelectOne(config, 'companies', { id: companyId });
  const client = await aaD5eBSelectOne(config, 'clients', { id: clientId });
  const subscription = await aaD5eBSelectOne(config, 'subscriptions', { id: subscriptionId });

  if (!company || !client || !subscription) {
    const error = new Error('activation_relationship_not_found');
    error.statusCode = 409;
    error.details = {
      companyFound: Boolean(company),
      clientFound: Boolean(client),
      subscriptionFound: Boolean(subscription),
    };
    throw error;
  }

  const requestedEmail = aaD5eBNormalizeEmail(payload.email);
  const email =
    requestedEmail ||
    aaD5eBNormalizeEmail(row.customer_email) ||
    aaD5eBNormalizeEmail(client.email);

  if (!email) {
    const error = new Error('owner_email_required');
    error.statusCode = 400;
    error.details = {
      message: 'Informe um e-mail válido do dono para criar o acesso.',
    };
    throw error;
  }

  const name =
    aaD5eBNormalizeName(payload.name) ||
    aaD5eBNormalizeName(row.customer_name) ||
    aaD5eBNormalizeName(company.name);

  const existingPublicUserByCompany = await aaD5eBSelectOne(config, 'users', {
    company_id: companyId,
  }).catch(() => null);

  if (existingPublicUserByCompany && existingPublicUserByCompany.id) {
    const nextActivation = {
      ...activation,
      userId: existingPublicUserByCompany.id,
      ownerAccessPreparedAt: activation.ownerAccessPreparedAt || aaD5eBNowIso(),
      ownerEmail: existingPublicUserByCompany.email || email,
      ownerAccessSource: 'existing_public_user_by_company',
    };

    const patchedQueue = await aaD5eBPatchById(config, 'billing_provisioning_queue', row.id, {
      metadata: {
        ...metadata,
        activation: nextActivation,
      },
      updated_at: aaD5eBNowIso(),
    });

    return {
      ok: true,
      idempotent: true,
      message: 'owner_access_recovered_from_existing_public_user',
      activation: nextActivation,
      row: patchedQueue,
      temporaryPassword: null,
      passwordReturned: false,
    };
  }

  const existingPublicUserByEmail = await aaD5eBSelectOne(config, 'users', {
    email,
  }).catch(() => null);

  if (existingPublicUserByEmail && existingPublicUserByEmail.company_id && String(existingPublicUserByEmail.company_id) !== String(companyId)) {
    const error = new Error('email_already_linked_to_another_company');
    error.statusCode = 409;
    error.details = {
      email,
      existingCompanyId: existingPublicUserByEmail.company_id,
      targetCompanyId: companyId,
    };
    throw error;
  }

  let authUser = null;
  let temporaryPassword = null;
  let authCreateMode = 'reused';

  const existingAuthUser = await aaD5eBFindAuthUserByEmail(config, email).catch(() => null);

  if (existingAuthUser && existingAuthUser.id) {
    authUser = existingAuthUser;
    authCreateMode = 'existing_auth_user';
  } else {
    temporaryPassword = aaD5eBRandomPassword();

    authUser = await aaD5eBCreateAuthUser(config, {
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'company',
        company_id: companyId,
        client_id: clientId,
        source: 'stripe_owner_access_prepare',
      },
      app_metadata: {
        role: 'company',
        company_id: companyId,
        client_id: clientId,
      },
    });

    authCreateMode = 'created_auth_user';
  }

  const userId = authUser && authUser.id;

  if (!userId) {
    const error = new Error('auth_user_id_missing');
    error.statusCode = 500;
    throw error;
  }

  await aaD5eBUpdateAuthUserMetadata(config, userId, {
    user_metadata: {
      ...(authUser.user_metadata || {}),
      name,
      role: 'company',
      company_id: companyId,
      client_id: clientId,
      source: 'stripe_owner_access_prepare',
    },
    app_metadata: {
      ...(authUser.app_metadata || {}),
      role: 'company',
      company_id: companyId,
      client_id: clientId,
    },
  }).catch(() => null);

  let publicUser = existingPublicUserByEmail || null;

  if (!publicUser) {
    publicUser = await aaD5eBInsertOne(config, 'users', {
      id: userId,
      company_id: companyId,
      name,
      email,
      role: 'company',
      onboarding_completed: false,
      created_at: aaD5eBNowIso(),
    });
  } else {
    publicUser = await aaD5eBPatchById(config, 'users', publicUser.id, {
      company_id: companyId,
      name: publicUser.name || name,
      role: publicUser.role || 'company',
      onboarding_completed: Boolean(publicUser.onboarding_completed),
    });
  }

  let profile = await aaD5eBSelectOne(config, 'profiles', {
    id: userId,
  }).catch(() => null);

  if (!profile) {
    profile = await aaD5eBInsertOne(config, 'profiles', {
      id: userId,
      client_id: clientId,
      role: 'admin',
      created_at: aaD5eBNowIso(),
    });
  }

  const patchedClient = await aaD5eBPatchById(config, 'clients', clientId, {
    user_id: userId,
  });

  const patchedSubscription = await aaD5eBPatchById(config, 'subscriptions', subscriptionId, {
    user_id: userId,
  });

  const nextActivation = {
    ...activation,
    userId,
    ownerEmail: email,
    ownerName: name,
    ownerAccessPreparedAt: aaD5eBNowIso(),
    ownerAccessPreparedBy: {
      id: actor.id || actor.user_id || null,
      email: actor.email || actor.user_email || null,
      role: actor.role || null,
    },
    ownerAccessSource: authCreateMode,
    requiresOwnerInvite: false,
    loginReady: true,
    whatsappConnectionRequired: true,
    assistantSetupRequired: true,
    implementationStillManual: true,
  };

  const patchedQueue = await aaD5eBPatchById(config, 'billing_provisioning_queue', row.id, {
    metadata: {
      ...metadata,
      activation: nextActivation,
    },
    updated_at: aaD5eBNowIso(),
  });

  return {
    ok: true,
    idempotent: false,
    message: 'owner_access_prepared',
    activation: nextActivation,
    owner: {
      id: userId,
      email,
      name,
      role: 'company',
      profileRole: 'admin',
    },
    created: {
      authCreateMode,
      publicUser,
      profile,
      patchedClient,
      patchedSubscription,
    },
    row: patchedQueue,
    temporaryPassword,
    passwordReturned: Boolean(temporaryPassword),
    warning: temporaryPassword
      ? 'A senha temporária é exibida somente nesta resposta. Copie e envie ao cliente por canal seguro.'
      : 'Usuário Auth já existia. Nenhuma senha temporária foi gerada.',
  };
}


module.exports = {
  listQueue,
  getQueueById,
  updateQueueItem,
  prepareCompanyActivation,
  prepareOwnerAccess,
};
