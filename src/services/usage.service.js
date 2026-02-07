const supabase = require('../config/supabase');

/**
 * Consome uso mensal de forma segura e centralizada
 * ESTA É A ÚNICA FUNÇÃO AUTORIZADA A ALTERAR monthly_usage
 */
async function consumeUsage({
  clientId,
  isNewConversation,
  requiresTemplate,
  plan,
}) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // 1️⃣ Busca uso atual
  const { data: usage, error } = await supabase
    .from('monthly_usage')
    .select('conversations_used, templates_used')
    .eq('client_id', clientId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (error) {
    console.error('[Usage] Error fetching monthly usage', error);
    throw error;
  }

  const conversationsUsed = usage?.conversations_used ?? 0;
  const templatesUsed = usage?.templates_used ?? 0;

  // 2️⃣ Valida limites
  if (isNewConversation) {
    if (conversationsUsed + 1 > plan.conversations_limit) {
      return {
        allowed: false,
        reason: 'CONVERSATION_LIMIT_EXCEEDED',
      };
    }
  }

  if (requiresTemplate) {
    if (templatesUsed + 1 > plan.templates_limit) {
      return {
        allowed: false,
        reason: 'TEMPLATE_LIMIT_EXCEEDED',
      };
    }
  }

  // 3️⃣ Persiste uso
  const { error: upsertError } = await supabase.from('monthly_usage').upsert(
    {
      client_id: clientId,
      month,
      year,
      conversations_used:
        conversationsUsed + (isNewConversation ? 1 : 0),
      templates_used:
        templatesUsed + (requiresTemplate ? 1 : 0),
    },
    {
      onConflict: 'client_id,month,year',
    }
  );

  if (upsertError) {
    console.error('[Usage] Error updating monthly usage', upsertError);
    throw upsertError;
  }

  return { allowed: true };
}

module.exports = {
  consumeUsage,
};

