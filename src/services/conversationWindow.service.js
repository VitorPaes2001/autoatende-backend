const supabase = require('../config/supabase');

/**
 * Verifica se uma nova janela de conversa foi aberta
 * Regra oficial:
 * - Se NÃO houve mensagem entre company_id + from nos últimos 24h
 *   → nova conversa
 * - Caso contrário → mesma conversa
 */
async function handleInboundMessage(companyId, from) {
  const since = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('company_id', companyId)
    .eq('from', from)
    .gte('created_at', since)
    .limit(1);

  if (error) {
    console.error('[ConversationWindow] Error checking window', error);
    throw error;
  }

  const opened = !data || data.length === 0;

  return {
    opened,
  };
}

module.exports = {
  handleInboundMessage,
};

