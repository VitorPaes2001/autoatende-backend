const supabase = require('../config/supabase');
const conversationWindowService = require('./conversationWindow.service');
const companyService = require('./company.service');
const AppError = require('../utils/AppError');

function getMonthYear(ts) {
  const d = (ts instanceof Date) ? ts : new Date(ts || Date.now());
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

async function tryConsumeUsage({ clientId, year, month, templatesDelta, conversationsDelta, templatesLimit }) {
  const { data, error } = await supabase.rpc('try_consume_usage', {
    p_client_id: clientId,
    p_year: year,
    p_month: month,
    p_templates_delta: templatesDelta,
    p_conversations_delta: conversationsDelta,
    p_templates_limit: templatesLimit,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || { allowed: true, templates_used: 0, conversations_used: 0, reason: 'OK' };
}


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
  // 4️⃣ Verificar e Atualizar Limites (ATÔMICO via RPC)
  const { month, year } = getMonthYear(timestamp || new Date());
  const templatesLimit = plan.templates_limit ?? 0;

  try {
    const result = await tryConsumeUsage({
      clientId: company.client_id,
      year,
      month,
      templatesDelta: cost.templates,
      conversationsDelta: cost.conversations,
      templatesLimit
    });

    if (!result.allowed && result.reason === 'TEMPLATE_LIMIT_EXCEEDED') {
      throw new AppError('Template limit exceeded', 402, {
        code: 'LIMIT_EXCEEDED',
        resource: 'templates',
        limit: templatesLimit,
        used: result.templates_used ?? 0,
        action: 'upgrade_plan'
      });
    }

    if (!result.allowed && (result.reason === 'INVALID_CLIENT_ID' || result.reason === 'UNKNOWN_CLIENT')) {
      throw new AppError('Invalid client_id', 500, { code: 'STRUCTURAL_FAILURE' });
    }

    return { authorized: true, cost };
  } catch (err) {
    // degraded safety: em dev, não derruba operação
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Usage] degraded: RPC try_consume_usage failed, allowing in non-production', {
        message: err?.message
      });
      return { authorized: true, cost, degraded: true };
    }
    throw err;
  }
}


// Mantendo compatibilidade com código legado, mas encapsulando lógica nova se possível
// ou apenas exportando para não quebrar outras partes (será refatorado depois)
async function consumeUsage(params) {
  const { clientId, isNewConversation, requiresTemplate, plan } = params;

  const { month, year } = getMonthYear(new Date());
  const templatesDelta = requiresTemplate ? 1 : 0;
  const conversationsDelta = isNewConversation ? 1 : 0;

  // Regra do produto: conversas não bloqueiam mais; só templates bloqueiam
  const templatesLimit = plan?.templates_limit ?? 0;

  try {
    const result = await tryConsumeUsage({
      clientId,
      year,
      month,
      templatesDelta,
      conversationsDelta,
      templatesLimit
    });

    if (!result.allowed && result.reason === 'TEMPLATE_LIMIT_EXCEEDED') {
      return { allowed: false, reason: 'TEMPLATE_LIMIT_EXCEEDED' };
    }

    return { allowed: true };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Usage] degraded: RPC try_consume_usage failed in consumeUsage, allowing in non-production', {
        message: err?.message
      });
      return { allowed: true, degraded: true };
    }
    throw err;
  }
}

module.exports = {
  authorizeAction,
  consumeUsage
};
