const supabase = require('../config/supabase');

function planFromPriceCents(priceCents) {
  if (priceCents === 69900) return { name: 'Business', templates_limit: 2000, conversations_limit: 2000 };
  if (priceCents === 44900) return { name: 'Pro', templates_limit: 800, conversations_limit: 800 };
  return { name: 'Starter', templates_limit: 300, conversations_limit: 300 };
}

async function getCompany(companyId) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, client_id, slug, status, created_at')
    .eq('id', companyId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getCompanyByClientId(clientId) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, client_id, slug, status, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getSubscription(clientId) {
  // ✅ NÃO selecionar conversations_limit/templates_limit (não existem no schema)
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      client_id,
      plan_id,
      status,
      start_date,
      end_date,
      created_at,
      provider,
      stripe_customer_id,
      stripe_subscription_id,
      company_id,
      plan:plans(id, price_cents, name)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Se o relacionamento não trouxer plan, busca direto pelo plan_id
  let planRow = data.plan || null;
  if (!planRow && data.plan_id) {
    const { data: p, error: pe } = await supabase
      .from('plans')
      .select('id, price_cents, name')
      .eq('id', data.plan_id)
      .maybeSingle();
    if (pe) throw pe;
    planRow = p || null;
  }

  const cents = planRow?.price_cents;
  const derived = planFromPriceCents(cents);

  return {
    ...data,
    plan: {
      ...(planRow || {}),
      name: planRow?.name || derived.name,
      templates_limit: derived.templates_limit,
      conversations_limit: derived.conversations_limit
    }
  };
}


/**
 * Retorna o plano ATIVO do client (usado por plan.middleware).
 * Fonte: subscriptions (mais recente) + plans (price_cents/name).
 * Retorno: { plan, status, limits } no formato esperado pelos middlewares.
 */
async function getActivePlan(clientId) {
  const sub = await getSubscription(clientId);
  if (!sub) return null;

  // só considera plano "ativo" para liberar rotas protegidas
  if ((sub.status || '').toLowerCase() != 'active') return null;

  const planName = sub.plan?.name || 'Starter';

  return {
    client_id: sub.client_id,
    company_id: sub.company_id,
    provider: sub.provider,
    status: sub.status,
    plan: planName, // ex: 'Starter' | 'Pro' | 'Business'
    limits: {
      templates: sub.plan?.templates_limit,
      conversations: sub.plan?.conversations_limit,
    },
    plan_id: sub.plan_id,
  };
}


module.exports = {
  getCompany,
  getCompanyByClientId,
  getSubscription,
  getActivePlan,
};
