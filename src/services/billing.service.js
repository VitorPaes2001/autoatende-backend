const stripe = require('../config/stripe');
const supabase = require('../config/supabase');
const { getCompany, getSubscription } = require('./company.service');
const metricsService = require('./metrics.service');
const { getPlanByPriceId, PLANS } = require('../config/plans');
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
    const monthlySummary = await overageBillingService.getMonthlyUsageSummary(clientId).catch(() => null);

    const usage = {
      conversations: monthlySummary?.conversations_used || 0,
      templates: monthlySummary?.templates_used || 0,
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
    console.error('[BillingService] Critical error building status:', error);
    return {
      plan: 'Starter',
      status: 'inactive',
      limits: { conversations: 300, templates: 300, agents: 1 },
      usage: { conversations: 0, templates: 0, agents: 1 },
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
  }

  return customerId;
}

/**
 * Cria uma sessão de checkout ou assinatura direta (Opcional, para uso interno)
 */
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

/**
 * Processa Webhook do Stripe
 */
async function handleWebhook(event) {
  const type = event.type;
  const data = event.data.object;

  console.log(`[Billing] Processing webhook: ${type}`);

  switch (type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionChange(data);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(data);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(data);
      break;

    default:
      console.log(`[Billing] Ignoring unsupported webhook event: ${type}`);
  }
}

/**
 * Sincroniza o plano definido no código com a tabela 'plans' no banco
 * Retorna o ID do plano no banco.
 */
async function syncPlanToDatabase(planConfig) {
  // Upsert do plano na tabela 'plans' para garantir que os limites estejam atualizados
  const { data, error } = await supabase
    .from('plans')
    .upsert({
      name: planConfig.name,
      stripe_price_id: planConfig.stripePriceId, // Pode ser null se for plano custom/free sem stripe
      conversations_limit: planConfig.limits.conversations,
      templates_limit: planConfig.limits.templates,
      // Se houver mais campos na tabela plans, eles ficarão como estão ou null
    }, { onConflict: 'name' }) // Assumindo que 'name' é unique. Se não for, precisaríamos de outro identificador.
    .select('id')
    .single();

  if (error) {
    console.error(`[Billing] Error syncing plan ${planConfig.name} to DB:`, error);
    // Tenta buscar se o upsert falhar (ex: constraint violation não tratada)
    const { data: existing } = await supabase
      .from('plans')
      .select('id')
      .eq('name', planConfig.name)
      .maybeSingle();
      
    if (existing) return existing.id;
    throw error;
  }

  return data.id;
}

/**
 * Trata mudanças na assinatura
 */
async function handleSubscriptionChange(stripeSubscription) {
  const customerId = stripeSubscription.customer;
  const status = stripeSubscription.status;
  const priceId = stripeSubscription.items.data[0].price.id;

  // 1. Identificar Cliente
  // Tenta pelo metadata da subscription primeiro
  let clientId = stripeSubscription.metadata?.clientId;

  if (!clientId) {
    // Busca no customer
    const customer = await stripe.customers.retrieve(customerId);
    clientId = customer.metadata?.clientId;
  }

  if (!clientId) {
    // Tenta buscar na tabela subscriptions pelo stripe_customer_id
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('client_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    
    if (sub) clientId = sub.client_id;
  }

  if (!clientId) {
    console.error(`[Billing] Client ID not found for customer ${customerId}`);
    return;
  }

  // 2. Identificar Plano
  const planConfig = getPlanByPriceId(priceId);
  console.log(`[Billing] Detected plan ${planConfig.name} for client ${clientId}`);

  // 3. Sincronizar Plano com DB
  const planId = await syncPlanToDatabase(planConfig);

  // 4. Atualizar Assinatura
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      client_id: clientId,
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id: customerId,
      status: status,
      plan_id: planId,
      updated_at: new Date()
    }, { onConflict: 'client_id' });

  if (error) {
    console.error('[Billing] Error updating subscription:', error);
  } else {
    console.log(`[Billing] Subscription updated for client ${clientId}: ${status} (${planConfig.name})`);
    await logBillingEvent(clientId, 'subscription_update', { status, plan: planConfig.name });
  }
}

/**
 * Trata pagamento com sucesso
 */
async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Se o status estava past_due, ele deve mudar para active via webhook subscription.updated.
  // Aqui apenas logamos e garantimos consistência se necessário.
  console.log(`[Billing] Payment succeeded for subscription ${subscriptionId}`);
  
  // Opcional: Se quiséssemos forçar status 'active' aqui, mas o 'subscription.updated' é mais confiável.
}

/**
 * Trata falha de pagamento
 */
async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  console.warn(`[Billing] Payment failed for subscription ${subscriptionId}`);
  
  // Identificar cliente para logar
  // A atualização de status para 'past_due' virá no evento customer.subscription.updated
}

/**
 * Log de Auditoria de Billing
 */
async function logBillingEvent(clientId, event, details) {
  // Poderia ser uma tabela 'billing_audit'
  // Por enquanto, vamos usar console estruturado ou tabela 'audit_logs' se existir
  // O prompt pediu "Billing Audit", vamos assumir console + inserção se houver tabela
  
  const logEntry = {
    client_id: clientId,
    event,
    details,
    timestamp: new Date()
  };

  console.log('[Billing Audit]', JSON.stringify(logEntry));

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
  handleWebhook,
  handleSubscriptionChange, // Exportado para testes ou chamadas manuais
  createPortalSession,
  getBillingStatus
};

/**
 * Cria sessão do Portal do Cliente (Self-service)
 */
async function createPortalSession(clientId, returnUrl) {
  // Buscar stripe_customer_id
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('client_id', clientId)
    .maybeSingle();

  if (!sub || !sub.stripe_customer_id) {
    throw new Error('Customer not found in billing system');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  });

  return session.url;
}
