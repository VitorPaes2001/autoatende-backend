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
        conversations_limit
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
    limit: data.plan.conversations_limit,
  };
}

module.exports = {
  getCompany,
  getActivePlan,
};

