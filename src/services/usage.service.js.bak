const supabase = require('../config/supabase');
const conversationWindowService = require('./conversationWindow.service');
const companyService = require('./company.service');
const AppError = require('../utils/AppError');

/**
 * Service de Consumo (Usage Service)
 * Responsável por validar regras de consumo e aplicar limites.
 * Fonte da Verdade: Regra-Mãe.
 */

/**
 * Valida e consome uso para uma ação específica
 * @param {Object} params
 * @param {number} params.companyId
 * @param {string} params.type - 'inbound' | 'template' | 'message'
 * @param {string} params.contact - Phone number (from/to)
 * @param {Date} params.timestamp
 */
async function authorizeAction({ companyId, type, contact, timestamp }) {
  // 1️⃣ Identificar Cliente e Plano
  const company = await companyService.getCompany(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  // Busca assinatura para verificar status de pagamento
  const subscription = await companyService.getSubscription(company.client_id);

  if (!subscription) {
    throw new AppError('No subscription found', 403, { code: 'NO_ACTIVE_PLAN' });
  }

  // Validação de pagamento (Billing)
  if (['past_due', 'unpaid'].includes(subscription.status)) {
    throw new AppError('Payment required', 402, { 
      code: 'PAYMENT_REQUIRED',
      action: 'update_payment'
    });
  }

  // Validação de status ativo
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new AppError('Subscription not active', 403, { 
      code: 'NO_ACTIVE_PLAN',
      action: 'upgrade_plan' // Ou contact_support
    });
  }

  const plan = subscription.plan;
  if (!plan) {
    throw new AppError('No plan associated with subscription', 403, { 
      code: 'NO_ACTIVE_PLAN',
      action: 'contact_support'
    });
  }

  // 2️⃣ Verificar Janela de Conversa (24h)
  const { active: windowActive } = await conversationWindowService.checkActiveWindow(companyId, contact);

  // 3️⃣ Determinar Consumo (Regra-Mãe)
  let cost = {
    conversations: 0,
    templates: 0
  };

  switch (type) {
    case 'inbound':
      // Conversa iniciada pelo cliente:
      // - Consome 1 conversa (se não houver janela ativa)
      // - NÃO consome template
      if (!windowActive) {
        cost.conversations = 1;
      }
      break;

    case 'template':
      // Template:
      // - Consome 1 template (sempre)
      // - Consome 1 conversa (se iniciar fora da janela)
      cost.templates = 1;
      if (!windowActive) {
        cost.conversations = 1;
      }
      break;

    case 'message':
      // Mensagem dentro da janela:
      // - NÃO consome template
      // - NÃO consome conversa adicional
      // Se tentar enviar message fora da janela, tecnicamente falha no WhatsApp API,
      // mas aqui vamos considerar bloqueio se não houver janela.
      if (!windowActive) {
         throw new AppError('Session message not allowed outside 24h window', 403, { code: 'WINDOW_CLOSED' });
      }
      break;

    default:
      throw new AppError('Invalid action type', 400);
  }

  // Se não há consumo, retorna sucesso imediatamente
  if (cost.conversations === 0 && cost.templates === 0) {
    return { authorized: true, cost };
  }

  // 4️⃣ Verificar e Atualizar Limites (Transacional/Atômico se possível, ou Check-then-Act)
  // Como Supabase não tem transações simples via JS client, usamos Check-then-Act com upsert
  
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Busca uso atual
  const { data: usage, error: fetchError } = await supabase
    .from('monthly_usage')
    .select('conversations_used, templates_used')
    .eq('client_id', company.client_id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (fetchError) {
    console.error('[Usage] Error fetching usage', fetchError);
    throw new AppError('Failed to fetch usage data', 500);
  }

  const currentConversations = usage?.conversations_used ?? 0;
  const currentTemplates = usage?.templates_used ?? 0;

  // Valida Limites
  if (cost.conversations > 0) {
    // ⚠️ Conversas não bloqueiam mais (Regra de Negócio: Ilimitado)
    // Mantemos a contagem apenas para métricas.
    /*
    if (currentConversations + cost.conversations > plan.conversations_limit) {
      throw new AppError('Conversation limit exceeded', 402, { 
        code: 'LIMIT_EXCEEDED', 
        resource: 'conversations',
        limit: plan.conversations_limit,
        used: currentConversations,
        action: 'upgrade_plan'
      });
    }
    */
  }

  if (cost.templates > 0) {
    // Nota: Se o plano não tiver limite de templates definido (null/undefined), assume ilimitado?
    // Ou assume 0? Vamos assumir que plan.templates_limit existe.
    // Se for null, vamos tratar como 0 ou infinito?
    // Padrão seguro: tratar como 0 se undefined.
    const limitTemplates = plan.templates_limit ?? 0;
    if (currentTemplates + cost.templates > limitTemplates) {
      throw new AppError('Template limit exceeded', 402, { 
        code: 'LIMIT_EXCEEDED',
        resource: 'templates',
        limit: limitTemplates,
        used: currentTemplates,
        action: 'upgrade_plan'
      });
    }
  }

  // Persiste Uso
  const { error: updateError } = await supabase.from('monthly_usage').upsert(
    {
      client_id: company.client_id,
      month,
      year,
      conversations_used: currentConversations + cost.conversations,
      templates_used: currentTemplates + cost.templates,
    },
    {
      onConflict: 'client_id,month,year',
    }
  );

  if (updateError) {
    console.error('[Usage] Error updating usage', updateError);
    throw new AppError('Failed to update usage', 500);
  }

  return { authorized: true, cost };
}

// Mantendo compatibilidade com código legado, mas encapsulando lógica nova se possível
// ou apenas exportando para não quebrar outras partes (será refatorado depois)
async function consumeUsage(params) {
  // Esta função antiga recebia 'plan' explicitamente.
  // Idealmente, deveríamos migrar tudo para authorizeAction.
  // Por enquanto, mantemos a implementação original para não quebrar 'whatsappMessageHandler'
  // se ele ainda for usado, mas o ideal é que 'whatsappMessageHandler' use authorizeAction.
  
  // ... implementação original ...
  // Vou reimplementar a original aqui para garantir que o arquivo fique completo
  const { clientId, isNewConversation, requiresTemplate, plan } = params;
  
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: usage, error } = await supabase
    .from('monthly_usage')
    .select('conversations_used, templates_used')
    .eq('client_id', clientId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (error) throw error;

  const conversationsUsed = usage?.conversations_used ?? 0;
  const templatesUsed = usage?.templates_used ?? 0;

  if (isNewConversation && conversationsUsed + 1 > plan.conversations_limit) {
    return { allowed: false, reason: 'CONVERSATION_LIMIT_EXCEEDED' };
  }

  if (requiresTemplate && templatesUsed + 1 > plan.templates_limit) {
    return { allowed: false, reason: 'TEMPLATE_LIMIT_EXCEEDED' };
  }

  const { error: upsertError } = await supabase.from('monthly_usage').upsert({
    client_id: clientId,
    month,
    year,
    conversations_used: conversationsUsed + (isNewConversation ? 1 : 0),
    templates_used: templatesUsed + (requiresTemplate ? 1 : 0),
  }, { onConflict: 'client_id,month,year' });

  if (upsertError) throw upsertError;

  return { allowed: true };
}


module.exports = {
  authorizeAction,
  consumeUsage
};
