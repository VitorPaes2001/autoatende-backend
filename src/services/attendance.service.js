const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { safeErrorFields, safeLogFields } = require('../security/telemetrySanitizer');
const safeLogger = require('../security/safeLogger');

/**
 * Attendance service
 * Fonte principal de controle: conversation_states
 * Fonte espelhada para UI/listagens: inbox_conversations
 */

const STATE_TABLE = 'conversation_states';
const CONVERSATIONS_TABLE = 'inbox_conversations';

function normalizeContact(contact) {
  return String(contact || '').replace(/\D/g, '').trim();
}

function normalizeMode(value) {
  return value === 'human' ? 'human' : 'bot';
}

function mapConversationRowToState(row) {
  if (!row || typeof row !== 'object') {
    return { mode: 'bot', assigned_agent_id: null };
  }

  return {
    mode: normalizeMode(row.mode),
    assigned_agent_id:
      row.assigned_agent_id ??
      row.assigned_user_id ??
      null
  };
}

async function getStateRow(companyId, contact) {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('id, company_id, contact, mode, assigned_agent_id, created_at, updated_at')
    .eq('company_id', companyId)
    .eq('contact', contact)
    .maybeSingle();

  if (error) {
    safeLogger.error('[Attendance] Error fetching conversation_states', error);
    return null;
  }

  return data || null;
}

async function getConversationMirrorRow(companyId, contact) {
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select('id, company_id, contact_number, contact_phone, mode, assigned_user_id, updated_at')
    .eq('company_id', companyId)
    .or(`contact_number.eq.${contact},contact_phone.eq.${contact}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    safeLogger.error('[Attendance] Error fetching inbox_conversations', error);
    return null;
  }

  return data || null;
}

async function syncConversationMirror(companyId, contact, updates) {
  const payload = {
    mode: normalizeMode(updates.mode),
    updated_at: new Date().toISOString()
  };

  // schema real observado: assigned_user_id
  if (Object.prototype.hasOwnProperty.call(updates, 'assigned_agent_id')) {
    payload.assigned_user_id = updates.assigned_agent_id || null;
  }

  const { error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update(payload)
    .eq('company_id', companyId)
    .or(`contact_number.eq.${contact},contact_phone.eq.${contact}`);

  if (error) {
    safeLogger.warn('[Attendance] Warning syncing inbox_conversations mirror:', error.message || error);
  }
}

async function updateConversationState(companyId, contact, updates) {
  const normalizedContact = normalizeContact(contact);

  const statePayload = {
    company_id: companyId,
    contact: normalizedContact,
    mode: normalizeMode(updates.mode),
    updated_at: new Date().toISOString()
  };

  if (Object.prototype.hasOwnProperty.call(updates, 'assigned_agent_id')) {
    statePayload.assigned_agent_id = updates.assigned_agent_id || null;
  }

  const { error } = await supabase
    .from(STATE_TABLE)
    .upsert(statePayload, { onConflict: 'company_id,contact' });

  if (error) {
    safeLogger.error('[Attendance] Error updating conversation_states', error);
    throw new AppError('Failed to update conversation state', 500);
  }

  await syncConversationMirror(companyId, normalizedContact, updates);

  return {
    success: true,
    mode: statePayload.mode,
    assigned_agent_id: statePayload.assigned_agent_id || null
  };
}

/**
 * Lê do estado principal.
 * Se não existir, faz fallback para inbox_conversations.
 * Se existir diferença, privilegia conversation_states.
 */
async function getConversationState(companyId, contact) {
  const normalizedContact = normalizeContact(contact);

  const [stateRow, conversationRow] = await Promise.all([
    getStateRow(companyId, normalizedContact),
    getConversationMirrorRow(companyId, normalizedContact)
  ]);

  if (stateRow) {
    return {
      mode: normalizeMode(stateRow.mode),
      assigned_agent_id: stateRow.assigned_agent_id || null
    };
  }

  if (conversationRow) {
    return mapConversationRowToState(conversationRow);
  }

  return { mode: 'bot', assigned_agent_id: null };
}

async function transferToHuman(companyId, contact, agentId = null) {
  return updateConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });
}

async function transferToAgent(companyId, contact, agentId) {
  return updateConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });
}

async function returnToBot(companyId, contact) {
  return updateConversationState(companyId, contact, {
    mode: 'bot',
    assigned_agent_id: null
  });
}

module.exports = {
  getConversationState,
  transferToHuman,
  transferToAgent,
  returnToBot
};

/* __AUTOATENDE_B53_ASSIGNMENT_SEMANTICS_HARDEN__ */

function b53NormalizeContact(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function b53IsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function b53NormalizeMode(value) {
  return String(value || '').trim().toLowerCase() === 'human' ? 'human' : 'bot';
}

function b53NormalizeAgentId(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (
    lowered === 'agent_default' ||
    lowered === 'default' ||
    lowered === 'bot' ||
    lowered === 'null' ||
    lowered === 'undefined' ||
    lowered === 'false'
  ) {
    return null;
  }

  return b53IsUuid(raw) ? raw : null;
}

async function b53SyncConversationMirror(companyId, contact, updates) {
  const normalizedContact = b53NormalizeContact(contact);
  if (!companyId || !normalizedContact) return;

  const mode = b53NormalizeMode(updates?.mode);
  const assignedUserId =
    mode === 'human'
      ? b53NormalizeAgentId(updates?.assigned_agent_id || updates?.assigned_user_id || null)
      : null;

  const mirrorPayload = {
    mode,
    assigned_user_id: assignedUserId,
    updated_at: new Date().toISOString()
  };

  for (const contactColumn of ['contact_number', 'contact_phone']) {
    try {
      const { data, error } = await supabase
        .from('inbox_conversations')
        .update(mirrorPayload)
        .eq('company_id', companyId)
        .eq(contactColumn, normalizedContact)
        .select('id');

      if (error) {
        safeLogger.warn(`[B53] mirror sync warning (${contactColumn}):`, error.message || error);
        continue;
      }

      if (Array.isArray(data) && data.length > 0) {
        return;
      }
    } catch (err) {
      safeLogger.warn(`[B53] mirror sync exception (${contactColumn}):`, err?.message || err);
    }
  }
}

async function b53UpsertConversationState(companyId, contact, updates) {
  const normalizedContact = b53NormalizeContact(contact);
  if (!companyId || !normalizedContact) {
    throw new AppError('Missing company/contact to update conversation state', 400);
  }

  const mode = b53NormalizeMode(updates?.mode);
  const assignedAgentId =
    mode === 'human'
      ? b53NormalizeAgentId(updates?.assigned_agent_id || updates?.assigned_user_id || null)
      : null;

  const payload = {
    company_id: companyId,
    contact: normalizedContact,
    mode,
    assigned_agent_id: assignedAgentId,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'company_id,contact' });

  if (error) {
    safeLogger.error('[B53] Error updating conversation state', error);
    throw new AppError('Failed to update conversation state', 500);
  }

  await b53SyncConversationMirror(companyId, normalizedContact, payload);
}

async function b53GetConversationState(companyId, contact) {
  const normalizedContact = b53NormalizeContact(contact);
  if (!companyId || !normalizedContact) {
    return { mode: 'bot', assigned_agent_id: null };
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('mode, assigned_agent_id')
    .eq('company_id', companyId)
    .eq('contact', normalizedContact)
    .maybeSingle();

  if (error) {
    safeLogger.error('[B53] Error fetching state', error);
    return { mode: 'bot', assigned_agent_id: null };
  }

  const mode = b53NormalizeMode(data?.mode);
  const assignedAgentId = mode === 'human' ? b53NormalizeAgentId(data?.assigned_agent_id) : null;

  return {
    mode,
    assigned_agent_id: assignedAgentId
  };
}

async function b53TransferToHuman(companyId, contact, agentId = null) {
  await b53UpsertConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });

  const state = await b53GetConversationState(companyId, contact);
  return { success: true, ...state };
}

async function b53TransferToAgent(companyId, contact, agentId) {
  await b53UpsertConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });

  const state = await b53GetConversationState(companyId, contact);
  return { success: true, ...state };
}

async function b53ReturnToBot(companyId, contact) {
  await b53UpsertConversationState(companyId, contact, {
    mode: 'bot',
    assigned_agent_id: null
  });

  return { success: true, mode: 'bot', assigned_agent_id: null };
}

module.exports.getConversationState = b53GetConversationState;
module.exports.transferToHuman = b53TransferToHuman;
module.exports.transferToAgent = b53TransferToAgent;
module.exports.returnToBot = b53ReturnToBot;

/* __AUTOATENDE_B531_FIX_TABLE_NAME_SCOPE__ */

const B531_CONVERSATION_STATES_TABLE = 'conversation_states';
const B531_INBOX_CONVERSATIONS_TABLE = 'inbox_conversations';

function b531NormalizeContact(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function b531NormalizeMode(value) {
  return String(value || '').trim().toLowerCase() === 'human' ? 'human' : 'bot';
}

function b531IsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function b531NormalizeAgentId(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (
    lowered === 'agent_default' ||
    lowered === 'default' ||
    lowered === 'bot' ||
    lowered === 'null' ||
    lowered === 'undefined' ||
    lowered === 'false'
  ) {
    return null;
  }

  return b531IsUuid(raw) ? raw : null;
}

async function b531SyncConversationMirror(companyId, contact, updates) {
  const normalizedContact = b531NormalizeContact(contact);
  if (!companyId || !normalizedContact) return;

  const mode = b531NormalizeMode(updates?.mode);
  const assignedUserId =
    mode === 'human'
      ? b531NormalizeAgentId(updates?.assigned_agent_id || updates?.assigned_user_id || null)
      : null;

  const payload = {
    mode,
    assigned_user_id: assignedUserId,
    updated_at: new Date().toISOString()
  };

  for (const column of ['contact_number', 'contact_phone']) {
    try {
      const { data, error } = await supabase
        .from(B531_INBOX_CONVERSATIONS_TABLE)
        .update(payload)
        .eq('company_id', companyId)
        .eq(column, normalizedContact)
        .select('id');

      if (error) {
        safeLogger.warn(`[B531] mirror sync warning (${column}):`, error.message || error);
        continue;
      }

      if (Array.isArray(data) && data.length > 0) {
        return;
      }
    } catch (err) {
      safeLogger.warn(`[B531] mirror sync exception (${column}):`, err?.message || err);
    }
  }
}

async function b531UpsertConversationState(companyId, contact, updates) {
  const normalizedContact = b531NormalizeContact(contact);

  if (!companyId || !normalizedContact) {
    throw new AppError('Missing company/contact to update conversation state', 400);
  }

  const mode = b531NormalizeMode(updates?.mode);
  const assignedAgentId =
    mode === 'human'
      ? b531NormalizeAgentId(updates?.assigned_agent_id || updates?.assigned_user_id || null)
      : null;

  const payload = {
    company_id: companyId,
    contact: normalizedContact,
    mode,
    assigned_agent_id: assignedAgentId,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(B531_CONVERSATION_STATES_TABLE)
    .upsert(payload, { onConflict: 'company_id,contact' });

  if (error) {
    safeLogger.error('[B531] Error updating conversation state', error);
    throw new AppError('Failed to update conversation state', 500);
  }

  await b531SyncConversationMirror(companyId, normalizedContact, payload);
}

async function b531GetConversationState(companyId, contact) {
  const normalizedContact = b531NormalizeContact(contact);

  if (!companyId || !normalizedContact) {
    return { mode: 'bot', assigned_agent_id: null };
  }

  const { data, error } = await supabase
    .from(B531_CONVERSATION_STATES_TABLE)
    .select('mode, assigned_agent_id')
    .eq('company_id', companyId)
    .eq('contact', normalizedContact)
    .maybeSingle();

  if (error) {
    safeLogger.error('[B531] Error fetching state', error);
    return { mode: 'bot', assigned_agent_id: null };
  }

  const mode = b531NormalizeMode(data?.mode);
  const assignedAgentId =
    mode === 'human'
      ? b531NormalizeAgentId(data?.assigned_agent_id)
      : null;

  return {
    mode,
    assigned_agent_id: assignedAgentId
  };
}

async function b531TransferToHuman(companyId, contact, agentId = null) {
  await b531UpsertConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });

  const state = await b531GetConversationState(companyId, contact);
  return { success: true, ...state };
}

async function b531TransferToAgent(companyId, contact, agentId) {
  await b531UpsertConversationState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });

  const state = await b531GetConversationState(companyId, contact);
  return { success: true, ...state };
}

async function b531ReturnToBot(companyId, contact) {
  await b531UpsertConversationState(companyId, contact, {
    mode: 'bot',
    assigned_agent_id: null
  });

  return { success: true, mode: 'bot', assigned_agent_id: null };
}

module.exports.getConversationState = b531GetConversationState;
module.exports.transferToHuman = b531TransferToHuman;
module.exports.transferToAgent = b531TransferToAgent;
module.exports.returnToBot = b531ReturnToBot;

/* __AUTOATENDE_B54_ATTENDANCE_AUTHORITY__ */

const B54_CONVERSATION_STATES_TABLE = 'conversation_states';
const B54_INBOX_CONVERSATIONS_TABLE = 'inbox_conversations';

function b54NormalizeContact(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function b54NormalizeMode(value) {
  return String(value || '').trim().toLowerCase() === 'human' ? 'human' : 'bot';
}

function b54IsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function b54NormalizeAssignedAgentId(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (
    lowered === 'null' ||
    lowered === 'undefined' ||
    lowered === 'false' ||
    lowered === 'agent_default' ||
    lowered === 'default' ||
    lowered === 'bot'
  ) {
    return null;
  }

  return b54IsUuid(raw) ? raw : null;
}

async function b54ReadStateRow(companyId, contact) {
  const normalizedContact = b54NormalizeContact(contact);
  if (!companyId || !normalizedContact) return null;

  const { data, error } = await supabase
    .from(B54_CONVERSATION_STATES_TABLE)
    .select('id, company_id, contact, mode, assigned_agent_id, updated_at')
    .eq('company_id', companyId)
    .eq('contact', normalizedContact)
    .maybeSingle();

  if (error) {
    safeLogger.error('[B54] Error reading conversation_states', error);
    return null;
  }

  return data || null;
}

async function b54ReadMirrorRow(companyId, contact) {
  const normalizedContact = b54NormalizeContact(contact);
  if (!companyId || !normalizedContact) return null;

  for (const column of ['contact_number', 'contact_phone']) {
    try {
      const { data, error } = await supabase
        .from(B54_INBOX_CONVERSATIONS_TABLE)
        .select('id, company_id, mode, assigned_user_id, contact_number, contact_phone, updated_at')
        .eq('company_id', companyId)
        .eq(column, normalizedContact)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) continue;
      if (data) return data;
    } catch (err) {
      safeLogger.warn(`[B54] mirror read warning (${column}):`, err?.message || err);
    }
  }

  return null;
}

function b54ComposeAuthoritativeState(stateRow, mirrorRow) {
  if (stateRow) {
    return {
      mode: b54NormalizeMode(stateRow.mode),
      assigned_agent_id: b54NormalizeAssignedAgentId(stateRow.assigned_agent_id)
    };
  }

  if (mirrorRow) {
    return {
      mode: b54NormalizeMode(mirrorRow.mode),
      assigned_agent_id: b54NormalizeAssignedAgentId(mirrorRow.assigned_user_id)
    };
  }

  return {
    mode: 'bot',
    assigned_agent_id: null
  };
}

async function b54SyncMirror(companyId, contact, authoritativeState) {
  const normalizedContact = b54NormalizeContact(contact);
  if (!companyId || !normalizedContact) return;

  const payload = {
    mode: b54NormalizeMode(authoritativeState?.mode),
    assigned_user_id: b54NormalizeAssignedAgentId(authoritativeState?.assigned_agent_id),
    updated_at: new Date().toISOString()
  };

  for (const column of ['contact_number', 'contact_phone']) {
    try {
      await supabase
        .from(B54_INBOX_CONVERSATIONS_TABLE)
        .update(payload)
        .eq('company_id', companyId)
        .eq(column, normalizedContact);
    } catch (err) {
      safeLogger.warn(`[B54] mirror sync warning (${column}):`, err?.message || err);
    }
  }
}

async function b54PersistState(companyId, contact, state) {
  const normalizedContact = b54NormalizeContact(contact);
  if (!companyId || !normalizedContact) {
    throw new AppError('Missing company/contact to update conversation state', 400);
  }

  const payload = {
    company_id: companyId,
    contact: normalizedContact,
    mode: b54NormalizeMode(state?.mode),
    assigned_agent_id: b54NormalizeAssignedAgentId(state?.assigned_agent_id),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(B54_CONVERSATION_STATES_TABLE)
    .upsert(payload, { onConflict: 'company_id,contact' });

  if (error) {
    safeLogger.error('[B54] Error upserting conversation_states', error);
    throw new AppError('Failed to update conversation state', 500);
  }

  await b54SyncMirror(companyId, normalizedContact, payload);
  return payload;
}

async function b54GetConversationState(companyId, contact) {
  const normalizedContact = b54NormalizeContact(contact);
  if (!companyId || !normalizedContact) {
    return { mode: 'bot', assigned_agent_id: null };
  }

  const stateRow = await b54ReadStateRow(companyId, normalizedContact);
  const mirrorRow = await b54ReadMirrorRow(companyId, normalizedContact);
  const authoritative = b54ComposeAuthoritativeState(stateRow, mirrorRow);

  const stateNeedsHeal =
    !stateRow ||
    b54NormalizeMode(stateRow.mode) !== authoritative.mode ||
    b54NormalizeAssignedAgentId(stateRow.assigned_agent_id) !== authoritative.assigned_agent_id;

  if (stateNeedsHeal) {
    try {
      await supabase
        .from(B54_CONVERSATION_STATES_TABLE)
        .upsert({
          company_id: companyId,
          contact: normalizedContact,
          mode: authoritative.mode,
          assigned_agent_id: authoritative.assigned_agent_id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'company_id,contact' });
    } catch (err) {
      safeLogger.warn('[B54] state self-heal warning:', err?.message || err);
    }
  }

  const mirrorMode = b54NormalizeMode(mirrorRow?.mode);
  const mirrorAssigned = b54NormalizeAssignedAgentId(mirrorRow?.assigned_user_id);
  const mirrorNeedsHeal =
    !mirrorRow ||
    mirrorMode !== authoritative.mode ||
    mirrorAssigned !== authoritative.assigned_agent_id;

  if (mirrorNeedsHeal) {
    await b54SyncMirror(companyId, normalizedContact, authoritative);
  }

  return authoritative;
}

async function b54TransferToHuman(companyId, contact, agentId = null) {
  const saved = await b54PersistState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });

  return {
    success: true,
    mode: saved.mode,
    assigned_agent_id: saved.assigned_agent_id
  };
}

async function b54TransferToAgent(companyId, contact, agentId) {
  const saved = await b54PersistState(companyId, contact, {
    mode: 'human',
    assigned_agent_id: agentId
  });

  return {
    success: true,
    mode: saved.mode,
    assigned_agent_id: saved.assigned_agent_id
  };
}

async function b54ReturnToBot(companyId, contact) {
  const saved = await b54PersistState(companyId, contact, {
    mode: 'bot',
    assigned_agent_id: null
  });

  return {
    success: true,
    mode: saved.mode,
    assigned_agent_id: saved.assigned_agent_id
  };
}

module.exports.getConversationState = b54GetConversationState;
module.exports.transferToHuman = b54TransferToHuman;
module.exports.transferToAgent = b54TransferToAgent;
module.exports.returnToBot = b54ReturnToBot;

/* __AUTOATENDE_B57_SAFE_ORPHAN_GUARD__ */

const __b57OriginalGetConversationState = module.exports.getConversationState;
const __b57OriginalReturnToBot = module.exports.returnToBot;

async function __b57HasHumanOutboundHistory(companyId, contact) {
  if (!companyId || !contact) return false;

  try {
    const normalizedContact = String(contact);

    const { data: conversations, error: convError } = await supabase
      .from('inbox_conversations')
      .select('id')
      .eq('company_id', companyId)
      .or(`contact_number.eq.${normalizedContact},contact_phone.eq.${normalizedContact}`);

    if (convError) {
      safeLogger.warn('[B57] hasHumanOutboundHistory conversation lookup warning:', convError?.message || convError);
      return false;
    }

    const conversationIds = (conversations || []).map((row) => row.id).filter(Boolean);
    if (!conversationIds.length) return false;

    const { data: message, error: msgError } = await supabase
      .from('inbox_messages')
      .select('id, sender_type, direction, created_at')
      .eq('company_id', companyId)
      .in('conversation_id', conversationIds)
      .eq('direction', 'outbound')
      .in('sender_type', ['human', 'agent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (msgError) {
      safeLogger.warn('[B57] hasHumanOutboundHistory message lookup warning:', msgError?.message || msgError);
      return false;
    }

    return !!message?.id;
  } catch (err) {
    safeLogger.warn('[B57] hasHumanOutboundHistory exception:', err?.message || err);
    return false;
  }
}

async function __b57SafeGetConversationState(companyId, contact) {
  const state = await __b57OriginalGetConversationState(companyId, contact);

  if (!companyId || !contact) {
    return state;
  }

  if (!state || state.mode !== 'human') {
    return state;
  }

  if (state.assigned_agent_id) {
    return state;
  }

  const hasHumanHistory = await __b57HasHumanOutboundHistory(companyId, contact);
  if (hasHumanHistory) {
    return state;
  }

  try {
    await __b57OriginalReturnToBot(companyId, contact);

    safeLogger.log('[B57] auto_released_orphan_human', safeLogFields({
      company_id: companyId,
      contact,
      status: 'released',
    }));

    return {
      mode: 'bot',
      assigned_agent_id: null,
      auto_released_orphan_human: true
    };
  } catch (err) {
    safeLogger.warn('[B57] auto release failed', {
      ...safeLogFields({ company_id: companyId, contact }),
      ...safeErrorFields(err),
    });
    return state;
  }
}

module.exports.getConversationState = __b57SafeGetConversationState;


/* __AUTOATENDE_C7E_R3_OBS_SERVICE_RETURN_TO_BOT__ */
if (typeof module.exports.returnToBot === 'function') {
  const __c7eR3ObsPrevServiceReturnToBot = module.exports.returnToBot;
  const __c7eR3ObsPrevServiceGetConversationState =
    typeof module.exports.getConversationState === 'function'
      ? module.exports.getConversationState
      : null;

  module.exports.returnToBot = async function c7eR3ObsServiceReturnToBot(companyId, contact) {
    const normalizedContact = String(contact || '').replace(/\D/g, '').trim();

    safeLogger.log('[C7E_R3_OBS] service.returnToBot start', safeLogFields({
      company_id: companyId,
      contact: normalizedContact,
      status: 'started',
    }));

    if (__c7eR3ObsPrevServiceGetConversationState) {
      try {
        const before = await __c7eR3ObsPrevServiceGetConversationState(companyId, normalizedContact);
        safeLogger.log('[C7E_R3_OBS] service.returnToBot before', safeLogFields({
          company_id: companyId,
          contact: normalizedContact,
          status: before?.mode || 'unknown',
        }));
      } catch (err) {
        safeLogger.warn('[C7E_R3_OBS] service.returnToBot before failed', safeErrorFields(err));
      }
    }

    const result = await __c7eR3ObsPrevServiceReturnToBot(companyId, normalizedContact);

    safeLogger.log('[C7E_R3_OBS] service.returnToBot result', safeLogFields({
      company_id: companyId,
      contact: normalizedContact,
      status: result?.mode || 'completed',
    }));

    if (__c7eR3ObsPrevServiceGetConversationState) {
      try {
        const after = await __c7eR3ObsPrevServiceGetConversationState(companyId, normalizedContact);
        safeLogger.log('[C7E_R3_OBS] service.returnToBot after', safeLogFields({
          company_id: companyId,
          contact: normalizedContact,
          status: after?.mode || 'unknown',
        }));
      } catch (err) {
        safeLogger.warn('[C7E_R3_OBS] service.returnToBot after failed', safeErrorFields(err));
      }
    }

    return result;
  };
}
/* __AUTOATENDE_C7E_R2_OPERATIONAL_AUTHORITY_CONVERGENCE__ */
function __aaC7eR2NormalizeContactLoose(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    if (typeof normalizeContact === 'function') {
      return normalizeContact(raw);
    }
  } catch (_) {}

  return raw.replace(/\D/g, '').trim();
}

function __aaC7eR2CloneWithNormalizedContacts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const next = { ...value };
  const contactKeys = [
    'contact',
    'customer_phone',
    'customerPhone',
    'phone',
    'remote_jid',
    'remoteJid',
    'jid',
    'from'
  ];

  for (const key of contactKeys) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      next[key] = __aaC7eR2NormalizeContactLoose(next[key]);
    }
  }

  return next;
}

/* __AUTOATENDE_C7E_R2B_POSITIONAL_CONTEXT_EXTRACTION__ */
function __aaC7eR2PrimitiveString(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim();
  return '';
}

function __aaC7eR2LooksLikeUuid(value) {
  const v = __aaC7eR2PrimitiveString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function __aaC7eR2LooksLikePhone(value) {
  const normalized = __aaC7eR2NormalizeContactLoose(value);
  return Boolean(normalized && /^\d{8,16}$/.test(normalized));
}

function __aaC7eR2CollectObjects(items, depth = 0, seen = new WeakSet(), out = []) {
  if (depth > 3) return out;

  const list = Array.isArray(items) ? items : [items];

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    if (seen.has(item)) continue;
    seen.add(item);

    if (!Array.isArray(item)) {
      out.push(item);
      __aaC7eR2CollectObjects(Object.values(item), depth + 1, seen, out);
    } else {
      __aaC7eR2CollectObjects(item, depth + 1, seen, out);
    }
  }

  return out;
}

function __aaC7eR2ExtractCompanyId(...items) {
  const primitives = [];

  for (const item of items) {
    const raw = __aaC7eR2PrimitiveString(item);
    if (raw) primitives.push(raw);
    if (__aaC7eR2LooksLikeUuid(raw)) return raw;
  }

  const objects = __aaC7eR2CollectObjects(items);
  const keys = ['companyId', 'company_id'];

  for (const obj of objects) {
    for (const key of keys) {
      const raw = __aaC7eR2PrimitiveString(obj[key]);
      if (__aaC7eR2LooksLikeUuid(raw)) return raw;
    }
  }

  for (const raw of primitives) {
    if (__aaC7eR2LooksLikeUuid(raw)) return raw;
  }

  return '';
}


function __aaC7eR2ExtractContact(...items) {
  const candidateKeys = [
    'contact',
    'contact_phone',
    'contactPhone',
    'phone',
    'phone_number',
    'phoneNumber',
    'customer_phone',
    'customerPhone',
    'chat_id',
    'chatId',
    'normalized_contact',
    'conversation_contact',
    'remote_jid',
    'remoteJid',
    'jid',
    'from'
  ];

  const primitives = [];

  for (const item of items) {
    const raw = __aaC7eR2PrimitiveString(item);
    if (raw) primitives.push(raw);
  }

  const objects = __aaC7eR2CollectObjects(items);

  for (const obj of objects) {
    for (const key of candidateKeys) {
      const raw = obj ? obj[key] : null;
      const normalized = __aaC7eR2NormalizeContactLoose(raw);
      if (normalized && !__aaC7eR2LooksLikeUuid(raw) && __aaC7eR2LooksLikePhone(raw)) {
        return normalized;
      }
    }
  }

  for (const raw of primitives) {
    const normalized = __aaC7eR2NormalizeContactLoose(raw);
    if (normalized && !__aaC7eR2LooksLikeUuid(raw) && __aaC7eR2LooksLikePhone(raw)) {
      return normalized;
    }
  }

  return '';
}


function __aaC7eR2ExtractStateLike(...items) {
  const out = {
    mode: null,
    assigned_agent_id: null
  };

  const modeKeys = ['mode', 'current_mode'];
  const assignedKeys = [
    'assigned_agent_id',
    'assigned_user_id',
    'responsible_agent_id',
    'responsible_user_id',
    'owner_id',
    'agentId',
    'agent_id'
  ];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const pool = [item];
    for (const nestedKey of ['payload', 'data', 'state', 'conversation', 'context']) {
      const nested = item[nestedKey];
      if (nested && typeof nested === 'object') pool.push(nested);
    }

    for (const obj of pool) {
      for (const key of modeKeys) {
        if (obj[key] === 'human' || obj[key] === 'bot') {
          out.mode = obj[key];
        }
      }

      for (const key of assignedKeys) {
        if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim()) {
          out.assigned_agent_id = obj[key];
          break;
        }
      }
    }
  }

  if (out.mode !== 'human') out.mode = 'bot';
  return out;
}

async function __aaC7eR2FindMirrorConversation(companyId, contact) {
  const normalizedContact = __aaC7eR2NormalizeContactLoose(contact);
  if (!companyId || !normalizedContact) return null;

  const tableName =
    (typeof CONVERSATIONS_TABLE === 'string' && CONVERSATIONS_TABLE) ||
    'inbox_conversations';

  let rows = [];
  let error = null;

  try {
    const res = await supabase
      .from(tableName)
      .select('*')
      .eq('company_id', companyId)
      .limit(300);

    rows = Array.isArray(res.data) ? res.data : [];
    error = res.error || null;
  } catch (err) {
    error = err;
  }

  if (error) {
    safeLogger.error('[C7E_R2][MIRROR_FIND_ERROR]', error.message || error);
    return null;
  }

  const candidateKeys = [
    'contact',
    'customer_phone',
    'customerPhone',
    'phone',
    'remote_jid',
    'remoteJid',
    'jid',
    'from'
  ];

  for (const row of rows) {
    for (const key of candidateKeys) {
      const value = row ? row[key] : null;
      if (__aaC7eR2NormalizeContactLoose(value) === normalizedContact) {
        return row;
      }
    }
  }

  return null;
}

async function __aaC7eR2SyncMirror(companyId, contact, stateLike = {}) {
  const normalizedContact = __aaC7eR2NormalizeContactLoose(contact);
  if (!companyId || !normalizedContact) return false;

  const row = await __aaC7eR2FindMirrorConversation(companyId, normalizedContact);
  if (!row || !row.id) {
    safeLogger.info('[C7E_R2][MIRROR_SYNC_SKIPPED]', safeLogFields({
      reason: 'mirror_not_found',
      companyId,
      contact: normalizedContact,
    }));
    return false;
  }

  const tableName =
    (typeof CONVERSATIONS_TABLE === 'string' && CONVERSATIONS_TABLE) ||
    'inbox_conversations';

  const mode = stateLike.mode === 'human' ? 'human' : 'bot';
  const assigned =
    stateLike.assigned_agent_id !== undefined
      ? stateLike.assigned_agent_id
      : null;

  const updates = {};

  if (Object.prototype.hasOwnProperty.call(row, 'mode')) {
    updates.mode = mode;
  }

  for (const key of [
    'assigned_agent_id',
    'assigned_user_id',
    'responsible_agent_id',
    'responsible_user_id',
    'owner_id'
  ]) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      updates[key] = assigned;
    }
  }

  if (Object.prototype.hasOwnProperty.call(row, 'is_human')) {
    updates.is_human = mode === 'human';
  }

  if (Object.prototype.hasOwnProperty.call(row, 'is_human_handoff')) {
    updates.is_human_handoff = mode === 'human';
  }

  if (Object.prototype.hasOwnProperty.call(row, 'updated_at')) {
    updates.updated_at = new Date().toISOString();
  }

  if (!Object.keys(updates).length) {
    safeLogger.info('[C7E_R2][MIRROR_SYNC_SKIPPED]', safeLogFields({
      reason: 'no_mutable_columns_detected',
      companyId,
      contact: normalizedContact,
    }));
    return false;
  }

  const { error } = await supabase
    .from(tableName)
    .update(updates)
    .eq('id', row.id);

  if (error) {
    safeLogger.error('[C7E_R2][MIRROR_SYNC_ERROR]', {
      ...safeLogFields({ companyId, contact: normalizedContact }),
      ...safeErrorFields(error),
    });
    return false;
  }

  safeLogger.info('[C7E_R2][MIRROR_SYNC_OK]', safeLogFields({
    companyId,
    contact: normalizedContact,
    status: mode,
  }));

  return true;
}

function __aaC7eR2WrapExport(name, opts = {}) {
  if (!module.exports || typeof module.exports !== 'object') return;

  const original = module.exports[name];
  if (typeof original !== 'function') return;
  if (original.__aaC7eR2Wrapped) return;

  const syncMirror = Boolean(opts.syncMirror);

  const wrapped = async function __aaC7eR2WrappedExport(...args) {
    const safeArgs = args.map((arg) => __aaC7eR2CloneWithNormalizedContacts(arg));
    const result = await original.apply(this, safeArgs);

    if (syncMirror) {
      try {
        const companyId = __aaC7eR2ExtractCompanyId(...safeArgs, result);
        const contact = __aaC7eR2ExtractContact(...safeArgs, result);
        const stateLike = __aaC7eR2ExtractStateLike(...safeArgs, result);

        if (companyId && contact) {
          await __aaC7eR2SyncMirror(companyId, contact, stateLike);
        } else {
          safeLogger.info('[C7E_R2][MIRROR_SYNC_SKIPPED]', safeLogFields({
            reason: 'insufficient_context',
            companyId,
            contact,
            status: name,
          }));
        }
      } catch (error) {
        safeLogger.error('[C7E_R2][WRAP_SYNC_ERROR]', safeErrorFields(error, { status: name }));
      }
    }

    return result;
  };

  wrapped.__aaC7eR2Wrapped = true;
  module.exports[name] = wrapped;
}

__aaC7eR2WrapExport('getState');
__aaC7eR2WrapExport('transferToHuman', { syncMirror: true });
__aaC7eR2WrapExport('transferToAgent', { syncMirror: true });
__aaC7eR2WrapExport('returnToBot', { syncMirror: true });

if (module.exports && typeof module.exports === 'object') {
  module.exports.__aaC7eR2SyncMirror = __aaC7eR2SyncMirror;
}

/* __AUTOATENDE_C7E_R3_MIRROR_MATCH_HARDENING__ START */
function __aaC7eR3Log(event, payload) {
  try {
    safeLogger.log(`[C7E_R3][${event}]`, safeLogFields(payload || {}));
  } catch (err) {
    safeLogger.log(`[C7E_R3][${event}]`, safeErrorFields(err));
  }
}

function __aaC7eR3IsObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function __aaC7eR3PickFirst() {
  for (const value of arguments) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function __aaC7eR3NormalizePhone(value) {
  if (value === undefined || value === null) return null;
  const digits = String(value).replace(/\D+/g, '');
  return digits || null;
}

function __aaC7eR3TailDigits(value, size) {
  const digits = __aaC7eR3NormalizePhone(value);
  if (!digits) return null;
  return digits.length > size ? digits.slice(-size) : digits;
}

function __aaC7eR3CollectFacts(node, bucket, depth, seen) {
  if (depth > 3 || node === null || node === undefined) return;
  if (typeof node !== 'object') return;
  if (seen.has(node)) return;
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) __aaC7eR3CollectFacts(item, bucket, depth + 1, seen);
    return;
  }

  const directMap = {
    companyId: 'companyId',
    company_id: 'companyId',
    clientId: 'companyId',
    client_id: 'companyId',
    conversationId: 'conversationId',
    conversation_id: 'conversationId',
    chatId: 'chatId',
    chat_id: 'chatId',
    inboxConversationId: 'inboxConversationId',
    inbox_conversation_id: 'inboxConversationId',
    contact: 'contact',
    phone: 'contact',
    phoneNumber: 'contact',
    phone_number: 'contact',
    waId: 'contact',
    wa_id: 'contact',
    customerPhone: 'contact',
    customer_phone: 'contact',
    participantPhone: 'contact',
    participant_phone: 'contact',
    assignedAgentId: 'assignedAgentId',
    assigned_agent_id: 'assignedAgentId',
    agentId: 'assignedAgentId',
    agent_id: 'assignedAgentId',
    mode: 'mode',
    status: 'status'
  };

  for (const [key, value] of Object.entries(node)) {
    if (directMap[key] && bucket[directMap[key]] == null && value !== undefined && value !== null && value !== '') {
      bucket[directMap[key]] = value;
    }
  }

  if (bucket.companyId == null && __aaC7eR3IsObject(node.company)) {
    bucket.companyId = __aaC7eR3PickFirst(node.company.id, node.company.company_id, node.company.client_id);
  }

  if (bucket.conversationId == null && __aaC7eR3IsObject(node.conversation)) {
    bucket.conversationId = __aaC7eR3PickFirst(node.conversation.id, node.conversation.conversation_id);
    bucket.chatId = __aaC7eR3PickFirst(bucket.chatId, node.conversation.chat_id, node.conversation.chatId);
    bucket.contact = __aaC7eR3PickFirst(bucket.contact, node.conversation.contact, node.conversation.phone);
  }

  if (bucket.assignedAgentId == null && __aaC7eR3IsObject(node.assigned_agent)) {
    bucket.assignedAgentId = __aaC7eR3PickFirst(node.assigned_agent.id, node.assigned_agent.agent_id);
  }

  for (const value of Object.values(node)) {
    __aaC7eR3CollectFacts(value, bucket, depth + 1, seen);
  }
}

function __aaC7eR3ExtractFacts(argsLike, result, operationName) {
  const facts = {
    operationName: operationName || null,
    companyId: null,
    conversationId: null,
    chatId: null,
    inboxConversationId: null,
    contact: null,
    assignedAgentId: null,
    mode: null,
    status: null
  };

  const argsArray = Array.isArray(argsLike) ? argsLike : Array.from(argsLike || []);

  try {
    __aaC7eR3CollectFacts(argsArray, facts, 0, new WeakSet());
  } catch (_) {}

  try {
    __aaC7eR3CollectFacts(result, facts, 0, new WeakSet());
  } catch (_) {}

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const primitiveStrings = argsArray
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean);

  const uuidCandidates = primitiveStrings.filter(value => uuidRegex.test(value));

  const phoneLikeCandidates = primitiveStrings
    .filter(value => !uuidRegex.test(value))
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      const normalized = value.replace(/\s+/g, '');
      if (/^\+?\d{8,15}$/.test(normalized)) {
        return normalized.replace(/^\+/, '');
      }
      return null;
    })
    .filter(Boolean);

  if (!facts.contact && phoneLikeCandidates.length) {
    facts.contact = phoneLikeCandidates[0];
  }

  if (!facts.chatId && phoneLikeCandidates.length) {
    facts.chatId = phoneLikeCandidates[0];
  }

  if (!facts.companyId) {
    if (uuidCandidates.length >= 2) {
      if (facts.assignedAgentId && uuidCandidates[0] !== facts.assignedAgentId) {
        facts.companyId = uuidCandidates[0];
      } else if (facts.assignedAgentId && uuidCandidates[1] !== facts.assignedAgentId) {
        facts.companyId = uuidCandidates[1];
      } else {
        facts.companyId = uuidCandidates[0];
      }
    } else if (uuidCandidates.length === 1) {
      if (!facts.assignedAgentId || uuidCandidates[0] !== facts.assignedAgentId) {
        facts.companyId = uuidCandidates[0];
      }
    }
  }

  if (!facts.assignedAgentId && uuidCandidates.length >= 2) {
    const reversed = [...uuidCandidates].reverse();
    facts.assignedAgentId = reversed.find(value => value !== facts.companyId) || null;
  }

  if (!facts.companyId) {
    facts.companyId =
      process.env.AUTOATENDE_DEFAULT_COMPANY_ID ||
      process.env.DEFAULT_COMPANY_ID ||
      null;
  }

  if (!facts.contact && facts.conversationId && /^\d{8,}$/.test(String(facts.conversationId))) {
    facts.contact = String(facts.conversationId);
  }

  if (!facts.contact && facts.chatId && /^\d{8,}$/.test(String(facts.chatId))) {
    facts.contact = String(facts.chatId);
  }

  facts.normalizedContact = __aaC7eR3NormalizePhone(facts.contact);
  facts.contactTail11 = __aaC7eR3TailDigits(facts.contact, 11);
  facts.contactTail10 = __aaC7eR3TailDigits(facts.contact, 10);
  facts.stableConversationId = __aaC7eR3PickFirst(
    facts.conversationId,
    facts.chatId,
    facts.inboxConversationId
  );

  facts.extractionMeta = {
    primitiveStrings,
    uuidCandidates,
    phoneLikeCandidates
  };

  return facts;
}

function __aaC7eR3GetDbClient() {
  const candidates = [
    ['supabaseAdmin', (typeof supabaseAdmin !== 'undefined' ? supabaseAdmin : null)],
    ['supabase', (typeof supabase !== 'undefined' ? supabase : null)],
    ['supabaseServiceRole', (typeof supabaseServiceRole !== 'undefined' ? supabaseServiceRole : null)],
    ['serviceSupabase', (typeof serviceSupabase !== 'undefined' ? serviceSupabase : null)],
    ['adminClient', (typeof adminClient !== 'undefined' ? adminClient : null)],
    ['db', (typeof db !== 'undefined' ? db : null)]
  ];

  for (const [name, client] of candidates) {
    if (client && typeof client.from === 'function') {
      return { name, client };
    }
  }

  return null;
}

function __aaC7eR3BuildTenantScopes(facts) {
  const scopes = [[]];

  if (facts.companyId) {
    scopes.unshift([['company_id', facts.companyId]]);
    scopes.unshift([['client_id', facts.companyId]]);
  }

  return scopes;
}

async function __aaC7eR3TrySelectOne(client, table, column, value, scopes) {
  if (!client || !table || !column || value == null || value === '') return null;

  const scopeList = Array.isArray(scopes) && scopes.length ? scopes : [[]];

  for (const scope of scopeList) {
    try {
      let query = client.from(table).select('*').eq(column, value);
      for (const [scopeColumn, scopeValue] of scope) {
        if (scopeValue !== undefined && scopeValue !== null && scopeValue !== '') {
          query = query.eq(scopeColumn, scopeValue);
        }
      }
      if (typeof query.order === 'function') {
        query = query.order('updated_at', { ascending: false });
      }
      if (typeof query.limit === 'function') {
        query = query.limit(1);
      }
      const response = await query;
      if (response && !response.error) {
        const rows = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
        if (rows.length) {
          return {
            row: rows[0],
            strategy: {
              table,
              column,
              value,
              scope
            }
          };
        }
      }
    } catch (_) {}
  }

  return null;
}

async function __aaC7eR3FindAuthoritativeState(dbClient, facts) {
  const client = dbClient && dbClient.client;
  if (!client) return null;

  const scopes = __aaC7eR3BuildTenantScopes(facts);
  const stableIdCandidates = [
    ['conversation_id', facts.stableConversationId],
    ['conversationId', facts.stableConversationId],
    ['chat_id', facts.chatId],
    ['chatId', facts.chatId]
  ];

  for (const [column, value] of stableIdCandidates) {
    const match = await __aaC7eR3TrySelectOne(client, 'conversation_states', column, value, scopes);
    if (match) return match;
  }

  const contactCandidates = [
    ['contact', facts.normalizedContact],
    ['phone', facts.normalizedContact],
    ['phone_number', facts.normalizedContact],
    ['customer_phone', facts.normalizedContact],
    ['wa_id', facts.normalizedContact],
    ['contact', facts.contactTail11],
    ['phone', facts.contactTail11],
    ['phone_number', facts.contactTail11],
    ['customer_phone', facts.contactTail11],
    ['wa_id', facts.contactTail11],
    ['contact', facts.contactTail10],
    ['phone', facts.contactTail10],
    ['phone_number', facts.contactTail10],
    ['customer_phone', facts.contactTail10],
    ['wa_id', facts.contactTail10]
  ];

  for (const [column, value] of contactCandidates) {
    const match = await __aaC7eR3TrySelectOne(client, 'conversation_states', column, value, scopes);
    if (match) return match;
  }

  return null;
}

async function __aaC7eR3FindMirrorRow(dbClient, facts) {
  const client = dbClient && dbClient.client;
  if (!client) return null;

  const scopes = __aaC7eR3BuildTenantScopes(facts);
  const stableIdCandidates = [
    ['conversation_id', facts.stableConversationId],
    ['conversationId', facts.stableConversationId],
    ['chat_id', facts.chatId],
    ['chatId', facts.chatId],
    ['inbox_conversation_id', facts.inboxConversationId],
    ['id', facts.inboxConversationId]
  ];

  for (const [column, value] of stableIdCandidates) {
    const match = await __aaC7eR3TrySelectOne(client, 'inbox_conversations', column, value, scopes);
    if (match) return match;
  }

  const contactCandidates = [
    ['contact', facts.normalizedContact],
    ['phone', facts.normalizedContact],
    ['phone_number', facts.normalizedContact],
    ['customer_phone', facts.normalizedContact],
    ['wa_id', facts.normalizedContact],
    ['contact_phone', facts.normalizedContact],
    ['contact_number', facts.normalizedContact],

    ['contact', facts.contactTail11],
    ['phone', facts.contactTail11],
    ['phone_number', facts.contactTail11],
    ['customer_phone', facts.contactTail11],
    ['wa_id', facts.contactTail11],
    ['contact_phone', facts.contactTail11],
    ['contact_number', facts.contactTail11],

    ['contact', facts.contactTail10],
    ['phone', facts.contactTail10],
    ['phone_number', facts.contactTail10],
    ['customer_phone', facts.contactTail10],
    ['wa_id', facts.contactTail10],
    ['contact_phone', facts.contactTail10],
    ['contact_number', facts.contactTail10]
  ];

  for (const [column, value] of contactCandidates) {
    const match = await __aaC7eR3TrySelectOne(client, 'inbox_conversations', column, value, scopes);
    if (match) return match;
  }

  return null;
}

async function __aaC7eR3GetMirrorSchemaSample(dbClient, facts) {
  const client = dbClient && dbClient.client;
  if (!client) return null;

  const attempts = [
    ['company_id', facts.companyId],
    ['client_id', facts.companyId],
    [null, null]
  ];

  for (const [scopeColumn, scopeValue] of attempts) {
    try {
      let query = client.from('inbox_conversations').select('*').limit(1);
      if (scopeColumn && scopeValue) {
        query = query.eq(scopeColumn, scopeValue);
      }
      const response = await query;
      if (response && !response.error) {
        const rows = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
        if (rows.length) return rows[0];
      }
    } catch (_) {}
  }

  return null;
}

function __aaC7eR3BuildMirrorInsertPayload(sampleRow, facts, desiredState, authoritativeRow) {
  const sampleKeys = new Set(sampleRow ? Object.keys(sampleRow) : []);
  const payload = {};

  const preferredContact =
    facts.normalizedContact ||
    facts.contact ||
    facts.chatId ||
    facts.conversationId ||
    null;

  const preferredConversationId =
    facts.conversationId ||
    facts.chatId ||
    facts.contact ||
    null;

  const preferredMode =
    __aaC7eR3PickFirst(
      desiredState && desiredState.mode,
      authoritativeRow && authoritativeRow.mode,
      facts.mode,
      'bot'
    );

  const preferredAssignedUserId =
    desiredState && Object.prototype.hasOwnProperty.call(desiredState, 'assigned_agent_id')
      ? desiredState.assigned_agent_id
      : __aaC7eR3PickFirst(
          authoritativeRow && authoritativeRow.assigned_agent_id,
          authoritativeRow && authoritativeRow.assignedAgentId,
          facts.assignedAgentId,
          null
        );

  const nowIso = new Date().toISOString();
  const safeStatus = preferredMode === 'human' ? 'open' : null;

  const candidates = {
    company_id: facts.companyId,
    client_id: facts.companyId,

    contact: preferredContact,
    phone: preferredContact,
    phone_number: preferredContact,
    customer_phone: preferredContact,
    wa_id: preferredContact,
    contact_phone: preferredContact,
    contact_number: preferredContact,

    chat_id: facts.chatId || preferredContact,
    chatId: facts.chatId || preferredContact,
    conversation_id: preferredConversationId,
    conversationId: preferredConversationId,

    mode: preferredMode,
    assigned_user_id: preferredAssignedUserId,
    assigned_agent_id: preferredAssignedUserId,
    assignedAgentId: preferredAssignedUserId,

    status: safeStatus,
    updated_at: nowIso,
    last_message_at: nowIso
  };

  for (const [column, value] of Object.entries(candidates)) {
    if (!sampleKeys.has(column)) continue;
    if (value === undefined || value === null || value === '') continue;
    payload[column] = value;
  }

  return {
    payload,
    sampleKeys: Array.from(sampleKeys)
  };
}

async function __aaC7eR3TryInsertMirrorRow(dbClient, facts, desiredState, authoritativeRow) {
  const client = dbClient && dbClient.client;
  if (!client) {
    return { ok: false, reason: 'db_client_not_found' };
  }

  const sampleRow = await __aaC7eR3GetMirrorSchemaSample(dbClient, facts);
  if (!sampleRow) {
    return { ok: false, reason: 'mirror_schema_sample_not_found' };
  }

  const built = __aaC7eR3BuildMirrorInsertPayload(sampleRow, facts, desiredState, authoritativeRow);
  const payload = built && built.payload ? built.payload : {};

  if (!payload || Object.keys(payload).length < 3) {
    return {
      ok: false,
      reason: 'insufficient_insert_payload',
      payload,
      sampleKeys: built ? built.sampleKeys : []
    };
  }

  try {
    const response = await client
      .from('inbox_conversations')
      .insert(payload)
      .select('id');

    if (response && !response.error) {
      return {
        ok: true,
        payload,
        sampleKeys: built.sampleKeys,
        data: response.data
      };
    }

    return {
      ok: false,
      reason: 'insert_failed',
      payload,
      sampleKeys: built.sampleKeys,
      error: response && response.error ? response.error.message : 'unknown_insert_error'
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'insert_exception',
      payload,
      sampleKeys: built.sampleKeys,
      error: error && error.message ? error.message : 'unknown_insert_exception'
    };
  }
}

function __aaC7eR3ResolveDesiredState(operationName, facts, authoritativeRow) {
  const desired = {
    mode: __aaC7eR3PickFirst(
      authoritativeRow && authoritativeRow.mode,
      facts.mode,
      operationName === 'returnToBot' ? 'bot' : null,
      operationName === 'transferToHuman' || operationName === 'transferToAgent' ? 'human' : null
    ),
    assigned_agent_id: __aaC7eR3PickFirst(
      authoritativeRow && authoritativeRow.assigned_agent_id,
      authoritativeRow && authoritativeRow.assignedAgentId,
      operationName === 'returnToBot' ? null : facts.assignedAgentId
    )
  };

  if (operationName === 'returnToBot') {
    desired.assigned_agent_id = null;
  }

  return desired;
}

async function __aaC7eR3UpdateMirrorRow(dbClient, mirrorMatch, desiredState) {
  const client = dbClient && dbClient.client;
  const row = mirrorMatch && mirrorMatch.row;
  if (!client || !row || !row.id) return { ok: false, reason: 'missing_row_id' };

  const rowKeys = new Set(Object.keys(row || {}));
  const basePayload = {};
  const nextAssignedUserId =
    desiredState && Object.prototype.hasOwnProperty.call(desiredState, 'assigned_agent_id')
      ? desiredState.assigned_agent_id
      : null;

  if (rowKeys.has('mode') && desiredState.mode !== undefined) {
    basePayload.mode = desiredState.mode;
  }

  if (rowKeys.has('assigned_user_id')) {
    basePayload.assigned_user_id = nextAssignedUserId;
  }

  if (rowKeys.has('assigned_agent_id')) {
    basePayload.assigned_agent_id = nextAssignedUserId;
  }

  if (rowKeys.has('assignedAgentId')) {
    basePayload.assignedAgentId = nextAssignedUserId;
  }

  if (rowKeys.has('status') && desiredState.mode === 'human') {
    basePayload.status = 'open';
  }

  if (rowKeys.has('updated_at')) {
    basePayload.updated_at = new Date().toISOString();
  }

  const attempts = [{ ...basePayload }];

  for (const payload of attempts) {
    try {
      const response = await client
        .from('inbox_conversations')
        .update(payload)
        .eq('id', row.id)
        .select('*');

      if (response && !response.error) {
        return {
          ok: true,
          payload,
          data: response.data
        };
      }
    } catch (_) {}
  }

  return {
    ok: false,
    reason: 'mirror_update_failed',
    payload: basePayload
  };
}

async function __aaC7eR3ReconcileMirror(operationName, argsLike, result) {
  const facts = __aaC7eR3ExtractFacts(argsLike, result, operationName);
  const dbClient = __aaC7eR3GetDbClient();

  if (!dbClient) {
    __aaC7eR3Log('MIRROR_RECONCILE_SKIPPED', {
      operationName,
      reason: 'db_client_not_found',
      facts
    });
    return;
  }

  const authoritative = await __aaC7eR3FindAuthoritativeState(dbClient, facts);
  const authoritativeRow = authoritative ? authoritative.row : null;
  const desiredState = __aaC7eR3ResolveDesiredState(operationName, facts, authoritativeRow);

  let mirrorMatch = await __aaC7eR3FindMirrorRow(dbClient, facts);
  let rehydrateResult = null;

  if (!mirrorMatch) {
    rehydrateResult = await __aaC7eR3TryInsertMirrorRow(dbClient, facts, desiredState, authoritativeRow);

    if (rehydrateResult && rehydrateResult.ok) {
      __aaC7eR3Log('MIRROR_REHYDRATE_INSERT_OK', {
        operationName,
        dbClient: dbClient.name,
        facts,
        authoritativeStrategy: authoritative ? authoritative.strategy : null,
        rehydrateResult
      });

      const insertedId =
        rehydrateResult &&
        rehydrateResult.data &&
        Array.isArray(rehydrateResult.data) &&
        rehydrateResult.data[0] &&
        rehydrateResult.data[0].id
          ? rehydrateResult.data[0].id
          : null;

      const sampleRow = (await __aaC7eR3GetMirrorSchemaSample(dbClient, facts)) || {};

      if (insertedId) {
        mirrorMatch = {
          row: { id: insertedId, ...sampleRow },
          strategy: {
            table: 'inbox_conversations',
            column: 'id',
            value: insertedId,
            scope: []
          }
        };
      }
    } else {
      __aaC7eR3Log('MIRROR_REHYDRATE_INSERT_FAILED', {
        operationName,
        dbClient: dbClient.name,
        facts,
        authoritativeStrategy: authoritative ? authoritative.strategy : null,
        rehydrateResult
      });

      mirrorMatch = await __aaC7eR3FindMirrorRow(dbClient, facts);
    }
  }

  if (!mirrorMatch) {
    __aaC7eR3Log('MIRROR_RECONCILE_SKIPPED', {
      operationName,
      reason: 'mirror_not_found',
      dbClient: dbClient.name,
      facts,
      authoritativeStrategy: authoritative ? authoritative.strategy : null,
      rehydrateResult
    });
    return;
  }

  const updateResult = await __aaC7eR3UpdateMirrorRow(dbClient, mirrorMatch, desiredState);

  __aaC7eR3Log(updateResult.ok ? 'MIRROR_RECONCILE_OK' : 'MIRROR_RECONCILE_FAILED', {
    operationName,
    dbClient: dbClient.name,
    facts,
    authoritativeStrategy: authoritative ? authoritative.strategy : null,
    mirrorStrategy: mirrorMatch.strategy,
    desiredState,
    rehydrateResult,
    updateResult
  });
}

function __aaC7eR3WrapExport(operationName) {
  if (!module || !module.exports) return;
  const original = module.exports[operationName];
  if (typeof original !== 'function') return;
  if (original.__aaC7eR3Wrapped) return;

  const wrapped = async function() {
    const result = await original.apply(this, arguments);
    try {
      await __aaC7eR3ReconcileMirror(operationName, arguments, result);
    } catch (error) {
      __aaC7eR3Log('WRAPPER_ERROR', {
        operationName,
        message: error && error.message ? error.message : 'unknown_wrapper_error'
      });
    }
    return result;
  };

  wrapped.__aaC7eR3Wrapped = true;
  module.exports[operationName] = wrapped;
}

__aaC7eR3WrapExport('transferToHuman');
__aaC7eR3WrapExport('transferToAgent');
__aaC7eR3WrapExport('returnToBot');
/* __AUTOATENDE_C7E_R3_MIRROR_MATCH_HARDENING__ END */


const { normalizeOperationalAuthorityResult } = require('./operationalAuthorityProjection.service');


/* __AUTOATENDE_C16N_C16F_PHASE1_OPERATIONAL_AUTHORITY_NORMALIZATION__ */
for (const __aaExportName of ['getConversationState', 'transferToHuman', 'transferToAgent', 'returnToBot', '__aaC7eR2SyncMirror']) {
  if (typeof module.exports[__aaExportName] !== 'function') continue;
  const __aaOriginal = module.exports[__aaExportName];
  module.exports[__aaExportName] = async function (...args) {
    const __aaResult = await __aaOriginal.apply(this, args);
    return normalizeOperationalAuthorityResult({
      result: __aaResult,
      args,
    });
  };
}



/* __AUTOATENDE_C16N_C16H_R1_INTERNAL_MIRROR_BINDING_FIX_AND_WRITE_PATH_HARDENING__ */
function __aaC16HR1FirstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function __aaC16HR1NormalizeContact(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\D+/g, '');
}

function __aaC16HR1DeriveCompanyId(args, result) {
  const safeArgs = Array.isArray(args) ? args : [];
  const candidates = [];

  for (let index = 0; index < safeArgs.length; index += 1) {
    const arg = safeArgs[index];

    if (arg && typeof arg === 'object') {
      candidates.push(
        arg.companyId,
        arg.company_id,
        arg?.company?.id,
        arg?.auth?.companyId,
        arg?.session?.companyId
      );
      continue;
    }

    if ((typeof arg === 'string' || typeof arg === 'number') && index === 0) {
      candidates.push(arg);
    }
  }

  if (result && typeof result === 'object') {
    candidates.push(
      result.companyId,
      result.company_id,
      result?.company?.id
    );
  }

  return __aaC16HR1FirstDefined(candidates);
}

function __aaC16HR1DeriveContact(args, result) {
  const safeArgs = Array.isArray(args) ? args : [];
  const candidates = [];

  for (let index = 0; index < safeArgs.length; index += 1) {
    const arg = safeArgs[index];

    if (arg && typeof arg === 'object') {
      candidates.push(
        arg.contact,
        arg.contact_number,
        arg.contactNumber,
        arg.phone,
        arg.phone_number,
        arg.customer_phone,
        arg.wa_id,
        arg.remote_jid,
        arg?.contact?.phone,
        arg?.contact?.number
      );
      continue;
    }

    if (typeof arg === 'string' && index > 0) {
      candidates.push(arg);
    }
  }

  if (result && typeof result === 'object') {
    candidates.push(
      result.contact,
      result.contact_number,
      result.contactNumber,
      result.phone,
      result.phone_number,
      result.customer_phone,
      result.wa_id,
      result.remote_jid,
      result?.contact?.phone,
      result?.contact?.number
    );
  }

  return __aaC16HR1NormalizeContact(__aaC16HR1FirstDefined(candidates));
}

async function __aaC16HR1BestEffortMirrorAfterWrite(args, result) {
  try {
    if (typeof __aaC7eR2SyncMirror !== 'function') return;

    const companyId = __aaC16HR1DeriveCompanyId(args, result);
    const contact = __aaC16HR1DeriveContact(args, result);

    if (!companyId || !contact) return;

    const stateLike = result && typeof result === 'object' ? result : {};
    await __aaC7eR2SyncMirror(companyId, contact, stateLike);
  } catch (_error) {
    // best-effort only: não derrubar o write path
  }
}

for (const __aaC16HR1ExportName of ['transferToHuman', 'transferToAgent', 'returnToBot']) {
  if (typeof module.exports[__aaC16HR1ExportName] !== 'function') continue;

  const __aaC16HR1Original = module.exports[__aaC16HR1ExportName];

  module.exports[__aaC16HR1ExportName] = async function (...args) {
    const __aaC16HR1Result = await __aaC16HR1Original.apply(this, args);
    await __aaC16HR1BestEffortMirrorAfterWrite(args, __aaC16HR1Result);
    return __aaC16HR1Result;
  };
}

