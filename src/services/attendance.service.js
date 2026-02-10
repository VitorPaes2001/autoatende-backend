const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');

/**
 * Service de Controle de Atendimento (Attendance)
 * Gerencia o estado da conversa (Bot vs Humano)
 */

const TABLE_NAME = 'conversation_states';

/**
 * Obtém o estado atual da conversa
 * @param {number} companyId
 * @param {string} contact
 */
async function getConversationState(companyId, contact) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('mode, assigned_agent_id')
    .eq('company_id', companyId)
    .eq('contact', contact)
    .maybeSingle();

  if (error) {
    console.error('[Attendance] Error fetching state', error);
    // Em caso de erro, assume padrão seguro (bot) para não travar, 
    // ou lança erro dependendo da criticidade. 
    // Aqui vamos assumir que se não existe, é bot.
    return { mode: 'bot', assigned_agent_id: null };
  }

  return data || { mode: 'bot', assigned_agent_id: null };
}

/**
 * Atualiza o estado da conversa
 */
async function updateConversationState(companyId, contact, updates) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({
      company_id: companyId,
      contact: contact,
      ...updates,
      updated_at: new Date()
    }, { onConflict: 'company_id,contact' });

  if (error) {
    console.error('[Attendance] Error updating state', error);
    throw new AppError('Failed to update conversation state', 500);
  }
}

/**
 * Transfere para Humano (Pausa Bot)
 */
async function transferToHuman(companyId, contact, agentId = null) {
  await updateConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });
  return { success: true, mode: 'human', assigned_agent_id: agentId };
}

/**
 * Transfere entre Agentes
 */
async function transferToAgent(companyId, contact, agentId) {
  // Verifica se já está em modo humano? 
  // O requisito diz "Permitir trocar assigned_agent_id".
  // Vamos garantir que fique em modo humano.
  
  await updateConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });
  return { success: true, mode: 'human', assigned_agent_id: agentId };
}

/**
 * Retorna ao Bot
 */
async function returnToBot(companyId, contact) {
  await updateConversationState(companyId, contact, {
    mode: 'bot',
    assigned_agent_id: null
  });
  return { success: true, mode: 'bot' };
}

module.exports = {
  getConversationState,
  transferToHuman,
  transferToAgent,
  returnToBot
};
