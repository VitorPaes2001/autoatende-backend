const supabase = require('../config/supabase');

/**
 * Regra operacional temporária e estável:
 * - usa inbox_conversations em vez de inbox_messages
 * - evita depender de colunas divergentes (from / to / from_number / to_number)
 * - nunca derruba o bot por erro de janela
 *
 * Observação:
 * como o inbound já é persistido antes deste check no fluxo atual,
 * o campo "opened" não é confiável para billing fino neste momento.
 * Aqui o objetivo é destravar o bot com segurança.
 */
async function checkActiveWindow(companyId, contact) {
  try {
    const sinceMs = Date.now() - (24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('inbox_conversations')
      .select('id, last_message_at, last_inbound_at, updated_at')
      .eq('company_id', companyId)
      .eq('contact_number', String(contact))
      .maybeSingle();

    if (error) {
      console.error('[ConversationWindow] Error checking window', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      // fallback seguro: não bloquear o bot
      return { active: false };
    }

    if (!data) {
      return { active: false };
    }

    const timestamps = [
      data.last_message_at,
      data.last_inbound_at,
      data.updated_at
    ]
      .filter(Boolean)
      .map((v) => new Date(v).getTime())
      .filter((n) => Number.isFinite(n));

    if (timestamps.length === 0) {
      return { active: false };
    }

    const latestTs = Math.max(...timestamps);
    return { active: latestTs >= sinceMs };
  } catch (error) {
    console.error('[ConversationWindow] Unexpected failure', {
      message: error?.message || String(error)
    });

    // fallback seguro: não bloquear o bot
    return { active: false };
  }
}

async function handleInboundMessage(companyId, from) {
  const { active } = await checkActiveWindow(companyId, from);
  return { opened: !active };
}

module.exports = {
  checkActiveWindow,
  handleInboundMessage,
};
