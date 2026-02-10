const supabase = require('../config/supabase');

/**
 * Verifica se uma nova janela de conversa foi aberta
 * Regra oficial:
 * - Se NÃO houve mensagem entre company_id + contact nos últimos 24h
 *   → nova conversa
 * - Caso contrário → mesma conversa
 */
async function checkActiveWindow(companyId, contact) {
  const since = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  // Verifica mensagens em ambas as direções (inbound/outbound)
  // Assumindo que 'messages' tem 'from' e 'to' ou similar
  // Se não tiver certeza, verificamos pelo menos o 'from' = contact (inbound)
  // ou 'to' = contact (outbound)
  // Como a estrutura exata de 'messages' não é garantida, vamos buscar por 'from' OR 'to' se possível
  // Mas o Supabase não tem OR simples na query builder sem raw filter ou sintaxe específica
  // Vamos manter simples: verificar se existe *alguma* mensagem associada a essa conversa
  
  // Opção A: Buscar mensagem onde (from = contact OR to = contact) AND company_id = companyId
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('company_id', companyId)
    .or(`from.eq.${contact},to.eq.${contact}`) // Sintaxe Supabase para OR
    .gte('created_at', since)
    .limit(1);

  if (error) {
    console.error('[ConversationWindow] Error checking window', error);
    throw error;
  }

  const hasActiveWindow = data && data.length > 0;

  return {
    active: hasActiveWindow,
  };
}

// Mantendo compatibilidade com código existente, mas redirecionando
async function handleInboundMessage(companyId, from) {
  const { active } = await checkActiveWindow(companyId, from);
  return { opened: !active };
}

module.exports = {
  checkActiveWindow,
  handleInboundMessage,
};

