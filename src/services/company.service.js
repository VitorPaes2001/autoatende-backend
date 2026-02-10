const supabase = require('../config/supabase');

/**
 * Busca empresa pelo ID
 */
async function getCompany(companyId) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, client_id')
    .eq('id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[Company] Error fetching company', error);
    return null;
  }

  return data;
}

/**
 * Busca plano ativo
 */
async function getActivePlan(clientId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      plan:plans (
        name,
        conversations_limit,
        templates_limit
      )
    `)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data?.plan) {
    console.error('[Company] Error fetching active plan', error);
    return null;
  }

  return {
    plan: data.plan.name,
    conversations_limit: data.plan.conversations_limit,
    templates_limit: data.plan.templates_limit
  };
}

/**
 * Busca assinatura (independente do status)
 * Retorna status e limites para enforcement
 */
async function getSubscription(clientId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      stripe_subscription_id,
      stripe_customer_id,
      plan:plans (
        name,
        conversations_limit,
        templates_limit
      )
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Company] Error fetching subscription', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    status: data.status,
    stripe_subscription_id: data.stripe_subscription_id,
    stripe_customer_id: data.stripe_customer_id,
    plan: data.plan ? {
      name: data.plan.name,
      conversations_limit: data.plan.conversations_limit,
      templates_limit: data.plan.templates_limit
    } : null
  };
}

async function getCompanyByPhoneNumber(phoneNumber) {
  // Normalize phone (remove + and spaces)
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Try to find in whatsapp_accounts
  // Note: This assumes 1-to-1 mapping or we pick the first
  const { data, error } = await supabase
    .from('whatsapp_accounts')
    .select('client_id')
    .ilike('phone_number', `%${cleanPhone}%`) // Loose match
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Get company details
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, client_id, plan, status')
    .eq('client_id', data.client_id)
    .maybeSingle();

  if (companyError) return null;
  return company;
}

module.exports = {
  getCompany,
  getActivePlan,
  getSubscription,
  getCompanyByPhoneNumber
};

