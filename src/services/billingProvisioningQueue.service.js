const Stripe = require('stripe');
const { getSupabaseAdminConfig } = require('../config/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  timeout: 20000,
  maxNetworkRetries: 2,
});

const OPERATIONAL_QUEUE_STATUSES = new Set([
  'pending',
  'contacted',
  'in_progress',
  'configured',
  'done',
  'canceled',
]);

function safeString(value, max = 500) {
  if (value === null || value === undefined) return null;
  const textValue = String(value).trim();
  if (!textValue) return null;
  return textValue.slice(0, max);
}

function asInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizePlanKey(value) {
  const raw = safeString(value, 120);
  if (!raw) return null;

  const normalized = raw.toLowerCase();

  if (normalized.includes('prof') || normalized === 'pro') return 'profissional';
  if (normalized.includes('business')) return 'business';
  if (normalized.includes('essencial') || normalized.includes('starter')) return 'essencial';

  return normalized;
}

function internalPlanFromKey(planKey) {
  if (planKey === 'profissional') return 'pro';
  if (planKey === 'business') return 'business';
  if (planKey === 'essencial') return 'starter';
  return planKey || null;
}

function planNameFromKey(planKey) {
  if (planKey === 'profissional') return 'Profissional';
  if (planKey === 'business') return 'Business';
  if (planKey === 'essencial') return 'Essencial';
  return planKey || null;
}

function metadataValue(metadata, keys) {
  for (const key of keys) {
    if (metadata && Object.prototype.hasOwnProperty.call(metadata, key)) {
      const value = safeString(metadata[key], 500);
      if (value) return value;
    }
  }

  return null;
}

function buildQueuePayload(session, context = {}) {
  const metadata = session.metadata || {};

  const planKey = normalizePlanKey(
    metadataValue(metadata, ['planKey', 'plan_key', 'plan', 'selectedPlan']) ||
    context.planKey ||
    session.client_reference_id
  );

  const customerObj = session.customer && typeof session.customer === 'object'
    ? session.customer
    : null;

  const subscriptionObj = session.subscription && typeof session.subscription === 'object'
    ? session.subscription
    : null;

  const customerName =
    safeString(session.customer_details?.name) ||
    metadataValue(metadata, ['name', 'customerName', 'customer_name', 'contactName']);

  const customerEmail =
    safeString(session.customer_details?.email) ||
    safeString(session.customer_email) ||
    safeString(customerObj?.email) ||
    metadataValue(metadata, ['email', 'customerEmail', 'customer_email']);

  const customerPhone =
    safeString(session.customer_details?.phone) ||
    safeString(customerObj?.phone) ||
    metadataValue(metadata, ['whatsapp', 'phone', 'customerPhone', 'customer_phone']);

  const companyName =
    metadataValue(metadata, ['companyName', 'company_name', 'company', 'businessName']) ||
    customerName;

  const companyPhone =
    metadataValue(metadata, ['companyPhone', 'company_phone']) ||
    customerPhone;

  const document =
    metadataValue(metadata, ['document', 'cpfCnpj', 'cpf_cnpj', 'cnpj', 'taxId']);

  const subscriptionStatus =
    safeString(subscriptionObj?.status) ||
    safeString(context.subscriptionStatus);

  const stripeSubscriptionId =
    safeString(subscriptionObj?.id) ||
    safeString(typeof session.subscription === 'string' ? session.subscription : null) ||
    safeString(context.subscriptionId);

  return {
    source: 'stripe_checkout',
    status: 'pending',
    priority: 50,

    checkout_session_id: safeString(session.id, 255),
    stripe_customer_id: safeString(customerObj?.id || session.customer, 255),
    stripe_subscription_id: stripeSubscriptionId,

    payment_status: safeString(session.payment_status, 80),
    subscription_status: subscriptionStatus,

    plan_key: planKey,
    internal_plan: internalPlanFromKey(planKey),
    plan_name: planNameFromKey(planKey),

    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,

    company_name: companyName,
    company_phone: companyPhone,
    document,

    amount_subtotal: asInteger(session.amount_subtotal),
    amount_total: asInteger(session.amount_total),
    currency: safeString(session.currency || 'brl', 12),

    onboarding_gate_token: null,
    gate_expires_at: null,

    metadata: {
      eventId: context.eventId || null,
      webhookType: context.webhookType || null,
      sessionMode: session.mode || null,
      livemode: Boolean(session.livemode),
      created: session.created || null,
      customerCreation: session.customer_creation || null,
      paymentIntent: session.payment_intent || null,
      invoice: session.invoice || null,
      rawMetadata: metadata,
    },
  };
}

function queueEndpoint(supabaseUrl) {
  return new URL(
    'rest/v1/billing_provisioning_queue',
    supabaseUrl.endsWith('/') ? supabaseUrl : supabaseUrl + '/'
  );
}

function requestHeaders(key, prefer = null) {
  const headers = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  };

  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function readResponseBody(response) {
  const body = await response.text();

  if (!body) return null;

  try {
    return JSON.parse(body);
  } catch (_) {
    return null;
  }
}

function responseRows(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && !data.code) return [data];
  return [];
}

function hasUsableQueueId(value) {
  return (
    (typeof value === 'string' || typeof value === 'number') &&
    String(value).trim().length > 0
  );
}

function createBillingProvisioningQueueService({
  stripeClient = stripe,
  fetchImpl = global.fetch,
  getConfig = getSupabaseAdminConfig,
} = {}) {
  async function retrieveFullCheckoutSession(sessionId) {
    return stripeClient.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });
  }

  async function findExistingQueueRow(config, checkoutSessionId) {
    const endpoint = queueEndpoint(config.url);
    endpoint.searchParams.set('checkout_session_id', 'eq.' + checkoutSessionId);
    endpoint.searchParams.set('select', 'id,checkout_session_id,status');
    endpoint.searchParams.set('limit', '2');

    const response = await fetchImpl(endpoint.toString(), {
      method: 'GET',
      headers: requestHeaders(config.key),
    });
    const data = await readResponseBody(response);

    if (!response.ok) {
      return {
        ok: false,
        reason: 'existing_queue_lookup_failed',
        httpStatus: response.status,
      };
    }

    const rows = responseRows(data);

    const row = rows.length === 1 ? rows[0] : null;

    if (
      !row ||
      !hasUsableQueueId(row.id) ||
      row.checkout_session_id !== checkoutSessionId ||
      !OPERATIONAL_QUEUE_STATUSES.has(row.status)
    ) {
      return {
        ok: false,
        reason: 'unique_violation_without_expected_queue',
        httpStatus: response.status,
      };
    }

    return {
      ok: true,
      row,
    };
  }

  async function insertQueuePayload(payload) {
    const config = getConfig();

    if (
      config?.configured === false ||
      !config?.url ||
      !config?.key ||
      typeof fetchImpl !== 'function'
    ) {
      return {
        ok: false,
        durable: false,
        inserted: false,
        upserted: false,
        reason: 'supabase_service_role_not_configured',
      };
    }

    let endpoint;

    try {
      endpoint = queueEndpoint(config.url);
    } catch (_) {
      return {
        ok: false,
        durable: false,
        inserted: false,
        upserted: false,
        reason: 'supabase_url_invalid',
      };
    }

    const response = await fetchImpl(endpoint.toString(), {
      method: 'POST',
      headers: requestHeaders(config.key, 'return=representation'),
      body: JSON.stringify(payload),
    });
    const data = await readResponseBody(response);

    if (response.ok) {
      const rows = responseRows(data);
      const row = rows.length === 1 ? rows[0] : null;

      if (!row || row.checkout_session_id !== payload.checkout_session_id) {
        return {
          ok: false,
          durable: false,
          inserted: false,
          upserted: false,
          reason: 'insert_response_not_confirmed',
          httpStatus: response.status,
        };
      }

      return {
        ok: true,
        durable: true,
        inserted: true,
        upserted: true,
        existing: false,
        httpStatus: response.status,
        queueId: row.id || null,
        status: row.status,
        checkoutSessionId: payload.checkout_session_id,
      };
    }

    if (data?.code === '23505') {
      const existing = await findExistingQueueRow(config, payload.checkout_session_id);

      if (!existing.ok) {
        return {
          ...existing,
          durable: false,
          inserted: false,
          upserted: false,
        };
      }

      return {
        ok: true,
        durable: true,
        inserted: false,
        upserted: false,
        existing: true,
        reason: 'existing_queue_row',
        httpStatus: response.status,
        queueId: existing.row.id || null,
        status: existing.row.status || null,
        checkoutSessionId: payload.checkout_session_id,
      };
    }

    return {
      ok: false,
      durable: false,
      inserted: false,
      upserted: false,
      reason: 'supabase_insert_failed',
      httpStatus: response.status,
      errorCode: safeString(data?.code, 80),
    };
  }

  async function ensureFromCheckoutSessionId(sessionId, context = {}) {
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return {
        ok: false,
        durable: false,
        inserted: false,
        upserted: false,
        reason: 'invalid_session_id',
      };
    }

    const session = await retrieveFullCheckoutSession(sessionId);

    if (
      typeof session?.id !== 'string' ||
      !session.id.startsWith('cs_') ||
      session.id !== sessionId
    ) {
      return {
        ok: false,
        durable: false,
        inserted: false,
        upserted: false,
        reason: 'checkout_session_id_mismatch',
        checkoutSessionId: session?.id || null,
      };
    }

    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      return {
        ok: false,
        durable: false,
        inserted: false,
        upserted: false,
        reason: 'payment_not_confirmed',
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        checkoutSessionId: session.id,
      };
    }

    const payload = buildQueuePayload(session, context);
    const result = await insertQueuePayload(payload);

    return {
      ...result,
      paymentStatus: session.payment_status,
      sessionStatus: session.status,
      planKey: payload.plan_key,
      customerEmail: payload.customer_email,
      companyName: payload.company_name,
    };
  }

  return {
    ensureFromCheckoutSessionId,
    upsertFromCheckoutSessionId: ensureFromCheckoutSessionId,
  };
}

const defaultService = createBillingProvisioningQueueService();

module.exports = {
  ...defaultService,
  buildQueuePayload,
  createBillingProvisioningQueueService,
};
