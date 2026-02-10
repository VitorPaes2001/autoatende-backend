const stripe = require('../config/stripe');
const supabase = require('../config/supabase');
const { getCompany, getSubscription } = require('./company.service');
const metricsService = require('./metrics.service');
const { getPlanByPriceId, PLANS } = require('../config/plans');

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
    // 1. Obter Assinatura (Safe)
    let subscription = null;
    try {
      subscription = await getSubscription(clientId);
    } catch (e) {
      console.error('[BillingService] Error fetching subscription, using fallback:', e);
    }

    // 2. Obter Dados da Empresa (Manual Billing Fallback)
    // CRITICAL FIX: Always fetch company details to allow fallback to manual plan
    // even if an inactive subscription exists.
    let companyPlan = null;
    let companyStatus = null;

    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('plan, status')
        .eq('id', companyId)
        .maybeSingle();
      
      if (!error && company) {
        companyPlan = company.plan;
        companyStatus = company.status;
      }
    } catch (e) {
      console.error('[BillingService] Error fetching company details:', e);
    }

    // DIAGNÓSTICO OBRIGATÓRIO
    console.log('=== BILLING DIAGNOSTICS ===');
    console.log('CompanyId:', companyId);
    console.log('Company Plan:', companyPlan);
    console.log('Company Status:', companyStatus);
    console.log('Subscription:', subscription ? `Found (Status: ${subscription.status})` : 'NULL');

    // 3. Resolver Status e Plano Final (CORREÇÃO OBRIGATÓRIA - HIERARQUIA ESTRITA)
    let subStatus = 'inactive';
    let subPlanName = 'Starter'; // Default to Starter

    if (subscription && subscription.status === 'active') {
      console.log('[BillingService] Decision: Using Subscription');
      subStatus = subscription.status;
      subPlanName = subscription.plan?.name || 'Starter';
    } else if (companyPlan && companyPlan.toLowerCase() === 'business' && companyStatus === 'active') {
      console.log('[BillingService] Decision: Using Company Manual Plan (Business)');
      subStatus = 'active';
      subPlanName = 'Business'; // Force Capital B
    } else {
      console.log('[BillingService] Decision: Fallback to Starter');
      subStatus = 'active'; // Starter plan is active by default
      subPlanName = 'Starter';
    }

    console.log('Final Decision -> Plan:', subPlanName, 'Status:', subStatus);
    console.log('===========================');

    // 4. Resolver Config do Plano (Safe)
    // Busca na config do código usando helper de normalização
    const { getPlanByName, PLANS } = require('../config/plans');
    let planConfigRaw = getPlanByName(subPlanName);
    
    // Normalizar features (pode estar em root ou limits dependendo da versão do plans.js)
    const featuresList = planConfigRaw.features || planConfigRaw.limits?.features || [];
    
    // 4. Obter Uso (Safe)
    let overview = null;
    try {
      overview = await metricsService.getCompanyOverview(companyId);
    } catch (e) {
      console.error('[BillingService] Error fetching overview, using zeroed fallback:', e);
    }

    // Garantir estrutura mínima de usage
    const usage = {
      conversations: overview?.usage?.conversations?.used || 0,
      templates: overview?.usage?.templates?.used || 0,
      agents: 1 // Será atualizado abaixo
    };

    const limits = {
      conversations: overview?.usage?.conversations?.total || planConfigRaw.limits.conversations || 0,
      templates: overview?.usage?.templates?.total || planConfigRaw.limits.templates || 0,
      agents: planConfigRaw.limits.agents || 1
    };

    // 5. Contar Agentes (Safe)
    let agentCount = 1;
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      
      if (!error && count !== null) {
        agentCount = count;
      }
    } catch (e) {
      console.error('[BillingService] Error counting agents:', e);
    }
    usage.agents = agentCount;

    // 6. Determinar Bloqueio
    const isPastDue = ['past_due', 'unpaid', 'canceled'].includes(subStatus);
    // CHANGE: Conversations never block, only templates
    const limitExceeded = (usage.templates >= limits.templates);

    let blockedInfo = {
      isBlocked: false,
      reason: null,
      action: null
    };

    if (isPastDue) {
      blockedInfo.isBlocked = true;
      blockedInfo.reason = 'payment_required';
      blockedInfo.action = 'update_payment';
    } else if (limitExceeded) {
      blockedInfo.isBlocked = true;
      blockedInfo.reason = 'limit_exceeded';
      blockedInfo.action = 'upgrade_plan';
    }

    // 7. Montar Features
    const features = {
      analytics: featuresList.includes('analytics'),
      attendance_transfer: true, // Core feature
      custom_integration: featuresList.includes('custom_integration'),
      whitelabel: featuresList.includes('whitelabel')
    };

    // 8. Retorno Blindado
    return {
      plan: planConfigRaw.name,
      status: subStatus,
      limits,
      usage,
      features,
      blocked: blockedInfo
    };

  } catch (error) {
    console.error('[BillingService] Critical error building status:', error);
    // Fallback de Último Recurso (Starter / Inactive)
    return {
      plan: 'Starter',
      status: 'inactive',
      limits: { conversations: Infinity, templates: 300, agents: 1 },
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

  try {
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
    }
  } catch (error) {
    console.error(`[Billing] Error processing webhook ${type}:`, error);
    // Não lança erro para não retentar infinitamente se for erro de lógica, 
    // mas em prod deveríamos analisar retry policies.
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
