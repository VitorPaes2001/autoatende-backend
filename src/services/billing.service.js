// __AUTOATENDE_C6C_R4_COMPANY_EMAIL_COLUMN_FIX__
// __AUTOATENDE_C6C_R1_BILLING_PORTAL_SELF_HEAL__
const stripe = require('../config/stripe');
const supabase = require('../config/supabase');
const { isSupabaseAdminUnavailableError } = supabase;
const { getCompany, getSubscription } = require('./company.service');
const metricsService = require('./metrics.service');
const { PLANS } = require('../config/plans');
const overageBillingService = require('./overageBilling.service');

/**
 * Billing Service
 * Responsável por gerenciar assinaturas e integração com Stripe.
 * Sincroniza planos do código com o banco de dados.
 */

/**
 * Obtém o status blindado de billing para o frontend
 * @param {string} companyId 
 * @param {string} clientId 
 */
async function getBillingStatus(companyId, clientId) {
  try {
    if (!clientId) throw new Error('Missing clientId');

    // 1) Fonte da verdade (DB): clients + subscriptions (+ plans.price_cents)
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('plan, plan_id, plan_status, status')
      .eq('id', clientId)
      .maybeSingle();

    if (clientErr) console.warn('[BillingService] clientErr:', clientErr.message);

    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('status, plan_id, provider, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) console.warn('[BillingService] subErr:', subErr.message);

    let planKey = (client?.plan || '').toLowerCase().trim();
    const planId = client?.plan_id || sub?.plan_id || null;

    if (!planKey && planId) {
      const { data: planRow, error: planErr } = await supabase
        .from('plans')
        .select('price_cents')
        .eq('id', planId)
        .maybeSingle();

      if (planErr) console.warn('[BillingService] planErr:', planErr.message);

      const cents = planRow?.price_cents;
      if (cents === 24900) planKey = 'starter';
      else if (cents === 44900) planKey = 'pro';
      else if (cents === 69900) planKey = 'business';
    }

    if (!planKey) planKey = 'starter';

    // status: preferir clients.plan_status; senão subscriptions.status (enum)
    let subStatus = (client?.plan_status || '').toLowerCase().trim();
    if (!subStatus) {
      const s = (sub?.status || '').toLowerCase().trim();
      subStatus = (s === 'active' || s === 'trialing') ? 'active' : 'inactive';
    }

    const planLabel =
      planKey === 'business' ? 'Business' :
      planKey === 'pro' ? 'Pro' :
      'Starter';

    // Plano config (features/agents etc)
    const { getPlanByName } = require('../config/plans');
    const planConfigRaw = getPlanByName(planLabel);

    const templatesLimit = planConfigRaw?.limits?.templates || (planKey === 'business' ? 2000 : planKey === 'pro' ? 800 : 300);

    // ✅ Evitar NaN no frontend: conversations SEMPRE numérico
    const limits = {
      conversations: templatesLimit,
      templates: templatesLimit,
      agents: planConfigRaw?.limits?.agents || 1
    };

    // Uso: use monthly summary (já está consistente no seu DB)
    const monthlySummary = await overageBillingService
      .getMonthlyUsageSummary(clientId)
      .catch((error) => {
        if (isSupabaseAdminUnavailableError(error)) throw error;
        return null;
      });

    const usage = {
      conversations: monthlySummary?.conversations_used || 0,
      templates: monthlySummary?.templates_used || 0,
      marketingTemplates:
        monthlySummary?.marketing_templates_used ||
        monthlySummary?.marketingTemplatesUsed ||
        0,
      utilityAuthTemplates:
        monthlySummary?.utility_auth_templates_used ||
        monthlySummary?.utilityAuthTemplatesUsed ||
        0,
      marketingTemplatesUsed:
        monthlySummary?.marketing_templates_used ||
        monthlySummary?.marketingTemplatesUsed ||
        0,
      utilityAuthTemplatesUsed:
        monthlySummary?.utility_auth_templates_used ||
        monthlySummary?.utilityAuthTemplatesUsed ||
        0,
      agents: 1
    };

    // Agentes: conta users por company_id se tiver companyId
    if (!companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle();
      companyId = company?.id || null;
    }

    if (companyId) {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (count !== null && count !== undefined) usage.agents = count;
    }

    // Bloqueio: templates não bloqueiam (overage), mas pagamento pode bloquear
    const rawSubStatus = (sub?.status || '').toLowerCase().trim();
    const isPastDue = ['past_due', 'unpaid', 'canceled'].includes(rawSubStatus);

    const blockedInfo = {
      isBlocked: false,
      reason: null,
      action: null
    };

    if (isPastDue) {
      blockedInfo.isBlocked = true;
      blockedInfo.reason = 'payment_required';
      blockedInfo.action = 'update_payment';
    } else if (usage.templates >= limits.templates) {
      blockedInfo.isBlocked = false;
      blockedInfo.reason = 'overage_active';
      blockedInfo.action = null;
    }

    const featuresList = planConfigRaw?.features || planConfigRaw?.limits?.features || [];

    const features = {
      analytics: featuresList.includes('analytics'),
      attendance_transfer: true,
      custom_integration: featuresList.includes('custom_integration'),
      whitelabel: featuresList.includes('whitelabel')
    };

    return {
      plan: planConfigRaw?.name || planLabel,
      status: subStatus,
      limits,
      usage,
      features,
      blocked: blockedInfo,
      monthlySummary
    };
  } catch (error) {
    if (isSupabaseAdminUnavailableError(error)) throw error;

    console.error('[BillingService] Critical error building status:', error);
    return {
      plan: 'Starter',
      status: 'inactive',
      limits: { conversations: 300, templates: 300, agents: 1 },
      usage: {
        conversations: 0,
        templates: 0,
        agents: 1,
        marketingTemplates: 0,
        utilityAuthTemplates: 0,
        marketingTemplatesUsed: 0,
        utilityAuthTemplatesUsed: 0
      },
      features: {},
      blocked: { isBlocked: false }
    };
  }
}


/**
 * Cria ou atualiza um cliente no Stripe
 */
async function syncCustomer(companyId, email) {
  const company = await getCompany(companyId);
  if (!company) throw new Error('Company not found');

  let { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('client_id', company.client_id)
    .maybeSingle();

  let customerId = subscription?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        companyId: companyId,
        clientId: company.client_id
      }
    });
    customerId = customer.id;

    await persistStripeCustomerId(company.client_id, customerId);
  }

  return customerId;
}

/**
 * Cria uma sessão de checkout ou assinatura direta (Opcional, para uso interno)
 */

async function persistStripeCustomerId(clientId, customerId) {
  if (!clientId || !customerId) return;

  const { data: existingSub, error: existingErr } = await supabase
    .from('subscriptions')
    .select('id, stripe_customer_id, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    console.warn('[BillingService] persist existingSub error:', existingErr.message);
  }

  if (existingSub?.id) {
    if (existingSub.stripe_customer_id === customerId) return;

    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('id', existingSub.id);

    if (updateErr) {
      console.warn('[BillingService] persist updateErr:', updateErr.message);
    }
    return;
  }

  const payload = {
    client_id: clientId,
    stripe_customer_id: customerId,
    provider: 'stripe',
    status: 'inactive'
  };

  const { error: insertErr } = await supabase
    .from('subscriptions')
    .insert(payload);

  if (insertErr) {
    console.warn('[BillingService] persist insertErr:', insertErr.message);
  }
}

async function createSubscription(companyId, priceId) {
  const company = await getCompany(companyId);
  if (!company) throw new Error('Company not found');

  const customerId = await syncCustomer(companyId, company.email || `company_${companyId}@example.com`);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: {
      clientId: company.client_id
    }
  });

  await handleSubscriptionChange(subscription);

  return subscription;
}

const WEBHOOK_EVENT_OPERATIONS = Object.freeze({
  'customer.subscription.created': 'subscription_change',
  'customer.subscription.updated': 'subscription_change',
  'customer.subscription.deleted': 'subscription_change',
});

const SUPPORTED_WEBHOOK_EVENT_TYPES = Object.freeze(
  Object.keys(WEBHOOK_EVENT_OPERATIONS)
);

function isSupportedWebhookEventType(type) {
  return (
    typeof type === 'string' &&
    Object.prototype.hasOwnProperty.call(WEBHOOK_EVENT_OPERATIONS, type)
  );
}

function getSupportedWebhookEventTypes() {
  return SUPPORTED_WEBHOOK_EVENT_TYPES;
}

function makeBillingWebhookError(code, message, eventType, { retryable = true } = {}) {
  const error = new Error(message);
  error.name = 'BillingWebhookError';
  error.code = code;
  error.statusCode = 503;
  error.retryable = retryable;
  error.eventType = eventType || null;
  return error;
}

function isBillingWebhookError(error) {
  return error?.name === 'BillingWebhookError' && typeof error?.code === 'string';
}

function normalizedText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function usableIdentifier(value) {
  return (
    (typeof value === 'string' || typeof value === 'number') &&
    String(value).trim().length > 0
  );
}

function createBillingWebhookService({
  stripeClient = stripe,
  supabaseClient = supabase,
  planCatalog = PLANS,
  logger = console,
} = {}) {
  function strictPlanByPriceId(priceId, eventType) {
    const plan = Object.values(planCatalog || {}).find(
      (candidate) => candidate?.stripePriceId === priceId
    );

    if (!plan) {
      throw makeBillingWebhookError(
        'BILLING_PLAN_MAPPING_NOT_FOUND',
        'Billing plan mapping was not found.',
        eventType
      );
    }

    return plan;
  }

  async function syncWebhookPlanToDatabase(planConfig, eventType) {
    const { data, error } = await supabaseClient
      .from('plans')
      .upsert({
        name: planConfig.name,
        stripe_price_id: planConfig.stripePriceId,
        conversations_limit: planConfig.limits.conversations,
        templates_limit: planConfig.limits.templates,
      }, { onConflict: 'name' })
      .select('id')
      .single();

    if (error || !usableIdentifier(data?.id)) {
      throw makeBillingWebhookError(
        'BILLING_PLAN_PERSIST_FAILED',
        'Billing plan could not be persisted.',
        eventType
      );
    }

    return data.id;
  }

  async function processSubscriptionChange(stripeSubscription, eventType = null) {
    if (!stripeSubscription || typeof stripeSubscription !== 'object' || Array.isArray(stripeSubscription)) {
      throw makeBillingWebhookError(
        'BILLING_SUBSCRIPTION_DATA_INVALID',
        'Stripe subscription payload is invalid.',
        eventType,
        { retryable: false }
      );
    }

    const subscriptionId = normalizedText(stripeSubscription.id);
    const customerId = normalizedText(
      typeof stripeSubscription.customer === 'object'
        ? stripeSubscription.customer?.id
        : stripeSubscription.customer
    );
    const status = normalizedText(stripeSubscription.status);
    const priceId = normalizedText(stripeSubscription.items?.data?.[0]?.price?.id);

    if (!subscriptionId || !customerId || !status || !priceId) {
      throw makeBillingWebhookError(
        'BILLING_SUBSCRIPTION_DATA_INVALID',
        'Stripe subscription payload is missing required data.',
        eventType,
        { retryable: false }
      );
    }

    let clientId = normalizedText(stripeSubscription.metadata?.clientId);

    if (!clientId) {
      const customer = await stripeClient.customers.retrieve(customerId);
      clientId = normalizedText(customer?.metadata?.clientId);
    }

    if (!clientId) {
      const { data: existingSubscription, error: lookupError } = await supabaseClient
        .from('subscriptions')
        .select('client_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (lookupError) {
        throw makeBillingWebhookError(
          'BILLING_SUBSCRIPTION_LOOKUP_FAILED',
          'Billing subscription lookup failed.',
          eventType
        );
      }

      clientId = normalizedText(existingSubscription?.client_id);
    }

    if (!clientId) {
      throw makeBillingWebhookError(
        'BILLING_CLIENT_NOT_FOUND',
        'Billing client could not be resolved.',
        eventType
      );
    }

    const planConfig = strictPlanByPriceId(priceId, eventType);
    const planId = await syncWebhookPlanToDatabase(planConfig, eventType);
    const { error: persistenceError } = await supabaseClient
      .from('subscriptions')
      .upsert({
        client_id: clientId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status,
        plan_id: planId,
        updated_at: new Date(),
      }, { onConflict: 'client_id' });

    if (persistenceError) {
      throw makeBillingWebhookError(
        'BILLING_SUBSCRIPTION_PERSIST_FAILED',
        'Billing subscription could not be persisted.',
        eventType
      );
    }

    await logBillingEvent(
      clientId,
      'subscription_update',
      { status, plan: planConfig.name },
      logger
    );

    return {
      ok: true,
      clientId,
      subscriptionId,
    };
  }

  async function strictHandleWebhook(event) {
    const eventType = normalizedText(event?.type);

    if (!isSupportedWebhookEventType(eventType)) {
      return {
        ok: false,
        handled: false,
        eventType,
        code: 'UNSUPPORTED_EVENT',
      };
    }

    const data = event?.data?.object;

    try {
      const operation = WEBHOOK_EVENT_OPERATIONS[eventType];

      if (operation !== 'subscription_change') {
        throw makeBillingWebhookError(
          'BILLING_WEBHOOK_CONTRACT_INVALID',
          'Billing webhook contract has no implemented operation.',
          eventType,
          { retryable: false }
        );
      }

      await processSubscriptionChange(data, eventType);
    } catch (error) {
      if (isSupabaseAdminUnavailableError(error)) throw error;
      if (isBillingWebhookError(error)) throw error;

      throw makeBillingWebhookError(
        'BILLING_WEBHOOK_OPERATION_FAILED',
        'Billing webhook operation failed.',
        eventType
      );
    }

    return {
      ok: true,
      handled: true,
      eventType,
    };
  }

  return {
    getSupportedWebhookEventTypes,
    isSupportedWebhookEventType,
    handleWebhook: strictHandleWebhook,
    handleSubscriptionChange: processSubscriptionChange,
  };
}

const defaultBillingWebhookService = createBillingWebhookService();

async function handleWebhook(event) {
  return defaultBillingWebhookService.handleWebhook(event);
}

async function handleSubscriptionChange(stripeSubscription) {
  return defaultBillingWebhookService.handleSubscriptionChange(stripeSubscription);
}

/**
 * Log de Auditoria de Billing
 */
async function logBillingEvent(clientId, event, details, logger = console) {
  // Poderia ser uma tabela 'billing_audit'
  // Por enquanto, vamos usar console estruturado ou tabela 'audit_logs' se existir
  // O prompt pediu "Billing Audit", vamos assumir console + inserção se houver tabela
  
  const logEntry = {
    client_id: clientId,
    event,
    details,
    timestamp: new Date()
  };

  logger.log('[Billing Audit]', JSON.stringify(logEntry));

  // Tenta inserir na tabela audit_logs se existir (best effort)
  /*
  await supabase.from('audit_logs').insert({
    company_id: clientId, // ou mapear para id da company
    action: `BILLING_${event.toUpperCase()}`,
    details: details,
    ip_address: 'stripe-webhook'
  });
  */
}

module.exports = {
  syncCustomer,
  createSubscription,
  createBillingWebhookService,
  getSupportedWebhookEventTypes,
  isSupportedWebhookEventType,
  handleWebhook,
  handleSubscriptionChange, // Exportado para testes ou chamadas manuais
  createPortalSession,
  getBillingStatus
};

/**
 * Cria sessão do Portal do Cliente (Self-service)
 */

async function resolveBillingCustomerEmail(companyId, clientId) {
  try {
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('email')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();

    if (userErr) {
      console.warn('[BillingService] resolveBillingCustomerEmail userErr:', userErr.message);
    }

    if (userRow?.email) {
      return userRow.email;
    }
  } catch (err) {
    if (isSupabaseAdminUnavailableError(err)) throw err;

    console.warn('[BillingService] resolveBillingCustomerEmail unexpected:', err?.message || err);
  }

  return `company_${clientId || companyId}@example.com`;
}

async function createPortalSession(clientId, returnUrl) {
  let { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) {
    console.warn('[BillingService] createPortalSession subErr:', subErr.message);
  }

  let customerId = sub?.stripe_customer_id || null;

  if (!customerId) {
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, client_id')
      .eq('client_id', clientId)
      .maybeSingle();

    if (companyErr) {
      console.warn('[BillingService] createPortalSession companyErr:', companyErr.message);
    }

    if (!company?.id) {
      throw new Error('Company not found for billing portal');
    }

    const resolvedEmail = await resolveBillingCustomerEmail(
      company.id,
      company.client_id || clientId
    );

    customerId = await syncCustomer(
      company.id,
      resolvedEmail
    );

    if (!customerId) {
      throw new Error('Unable to provision billing customer');
    }

    await persistStripeCustomerId(clientId, customerId);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}
