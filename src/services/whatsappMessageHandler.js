const { handleInboundMessage } = require('./conversationWindow.service');
const { consumeUsage } = require('./usage.service');
const { getCompany, getActivePlan } = require('./company.service');

/**
 * Orquestra o processamento de mensagens inbound do WhatsApp
 * Nunca lança erro de regra de negócio
 */
async function handleIncomingWhatsAppMessage(payload) {
  const { company_id, from, message } = payload;

  if (!company_id || !from || !message) {
    return {
      blocked: true,
      reason: 'INVALID_PAYLOAD',
    };
  }

  // 1️⃣ Empresa
  const company = await getCompany(company_id);
  if (!company) {
    return {
      blocked: true,
      reason: 'COMPANY_NOT_FOUND',
    };
  }

  // 2️⃣ Plano ativo
  const planData = await getActivePlan(company.client_id);
  if (!planData) {
    return {
      blocked: true,
      reason: 'NO_ACTIVE_SUBSCRIPTION',
    };
  }

  // 3️⃣ Janela de conversa
  const window = await handleInboundMessage(company_id, from);

  // inbound nunca exige template
  const requiresTemplate = false;

  // 4️⃣ Consome uso (SE NECESSÁRIO)
  const usage = await consumeUsage({
    clientId: company.client_id,
    isNewConversation: window.opened,
    requiresTemplate,
    plan: planData.plan,
  });

  if (!usage.allowed) {
    return {
      blocked: true,
      reason: usage.reason,
    };
  }

  // 5️⃣ Aqui entra:
  // - salvar mensagem inbound
  // - responder WhatsApp
  // (fora do escopo agora)

  return {
    success: true,
    conversationOpened: window.opened,
  };
}

module.exports = {
  handleIncomingWhatsAppMessage,
};

