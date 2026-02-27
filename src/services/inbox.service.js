const supabase = require('../config/supabase');
const attendanceService = require('./attendance.service');
const whatsappService = require('./whatsapp.service');

const INBOX_CONVERSATIONS_TABLE = 'inbox_conversations';
const INBOX_MESSAGES_TABLE = 'inbox_messages';

function toMessageObjectFromLegacy(message) {
  if (!message) return null;
  if (typeof message === 'string') {
    return { type: 'text', text: { body: message } };
  }
  if (typeof message === 'object') {
    return message;
  }
  return null;
}

function normalizeInboundPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  // Legacy normalized format
  if (payload.company_id && payload.from && payload.message) {
    const messageObj = toMessageObjectFromLegacy(payload.message);
    if (!messageObj) return null;

    return {
      company_id: payload.company_id,
      from: String(payload.from),
      phone_number_id: payload.phone_number_id || payload.whatsapp_account_id || null,
      message: messageObj,
      raw: payload,
    };
  }

  // Meta Cloud API payload
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!value || !message || !message.from) {
    return null;
  }

  const normalized = {
    company_id: payload.company_id || payload.companyId || null,
    from: String(message.from),
    phone_number_id: value?.metadata?.phone_number_id || payload.phone_number_id || null,
    message: {
      type: message.type,
    },
    raw: payload,
  };

  if (message.type === 'text') {
    normalized.message.text = { body: message.text?.body || '' };
  }

  if (message.type === 'audio') {
    normalized.message.audio = {
      id: message.audio?.id,
      file_size: message.audio?.file_size,
    };
  }

  return normalized;
}

async function resolveCompanyIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  if (payload.company_id) return payload.company_id;
  if (payload.companyId) return payload.companyId;

  const legacyWaAccountId = payload.whatsapp_account_id;
  if (legacyWaAccountId) {
    const { data: waById } = await supabase
      .from('whatsapp_accounts')
      .select('company_id, client_id')
      .eq('id', legacyWaAccountId)
      .maybeSingle();

    if (waById?.company_id) return waById.company_id;
    if (waById?.client_id) {
      const { data: companyByClient } = await supabase
        .from('companies')
        .select('id')
        .eq('client_id', waById.client_id)
        .maybeSingle();
      if (companyByClient?.id) return companyByClient.id;
    }
  }

  const phoneNumberId =
    payload.phone_number_id ||
    payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ||
    null;

  if (!phoneNumberId) return null;

  const { data: waByPhoneId } = await supabase
    .from('whatsapp_accounts')
    .select('company_id, client_id')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();

  if (waByPhoneId?.company_id) return waByPhoneId.company_id;

  if (!waByPhoneId) {
    // Backward compatibility: some tenants may have saved phone_number_id in waba_id.
    const { data: waByWabaFallback } = await supabase
      .from('whatsapp_accounts')
      .select('company_id, client_id')
      .eq('waba_id', phoneNumberId)
      .maybeSingle();

    if (waByWabaFallback?.company_id) return waByWabaFallback.company_id;
    if (waByWabaFallback?.client_id) {
      const { data: companyFallback } = await supabase
        .from('companies')
        .select('id')
        .eq('client_id', waByWabaFallback.client_id)
        .maybeSingle();
      if (companyFallback?.id) return companyFallback.id;
    }
  }

  if (waByPhoneId?.client_id) {
    const { data: companyByClient } = await supabase
      .from('companies')
      .select('id')
      .eq('client_id', waByPhoneId.client_id)
      .maybeSingle();

    if (companyByClient?.id) return companyByClient.id;
  }

  return null;
}

async function upsertConversationInbound({ companyId, from, nowIso }) {
  const upsertPayload = {
    company_id: companyId,
    contact_number: from,
    status: 'open',
    last_message_at: nowIso,
    last_inbound_at: nowIso,
    updated_at: nowIso,
  };

  const { data: upserted, error: upsertErr } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .upsert(upsertPayload, { onConflict: 'company_id,contact_number' })
    .select('*')
    .maybeSingle();

  if (!upsertErr && upserted) {
    return upserted;
  }

  // Fallback if onConflict is not available in tenant schema.
  const { data: existing } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('contact_number', from)
    .maybeSingle();

  if (existing?.id) {
    const { data: updated, error: updateErr } = await supabase
      .from(INBOX_CONVERSATIONS_TABLE)
      .update({
        status: 'open',
        last_message_at: nowIso,
        last_inbound_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();

    if (updateErr) throw updateErr;
    return updated || existing;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .insert(upsertPayload)
    .select('*')
    .maybeSingle();

  if (insertErr) throw insertErr;
  return inserted;
}

function extractMessageBody(messageObj) {
  if (!messageObj || typeof messageObj !== 'object') return '';
  if (messageObj.type === 'text') return messageObj.text?.body || '';
  return '';
}

async function insertMessageWithFallback(payloadCandidates) {
  let lastError = null;

  for (const candidate of payloadCandidates) {
    const { data, error } = await supabase
      .from(INBOX_MESSAGES_TABLE)
      .insert(candidate)
      .select('*')
      .maybeSingle();

    if (!error) return data || null;
    lastError = error;
  }

  if (lastError) throw lastError;
  return null;
}

function buildInboundMessageCandidates({ companyId, conversationId, from, messageObj, nowIso, rawPayload }) {
  const body = extractMessageBody(messageObj);

  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'inbound',
      message_type: messageObj.type || 'text',
      content: body,
      body,
      from_number: from,
      metadata: rawPayload,
      status: 'received',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'inbound',
      type: messageObj.type || 'text',
      body,
      from: from,
      status: 'received',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'inbound',
      body,
      created_at: nowIso,
    },
  ];
}

function buildOutboundMessageCandidates({ companyId, conversationId, to, text, nowIso, metadata }) {
  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      message_type: 'text',
      content: text,
      body: text,
      to_number: to,
      metadata,
      status: 'pending',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      body: text,
      to,
      status: 'pending',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      body: text,
      created_at: nowIso,
    },
  ];
}

async function processInboundWebhook(rawPayload) {
  const normalized = normalizeInboundPayload(rawPayload);
  if (!normalized) {
    return {
      processed: false,
      reason: 'UNSUPPORTED_PAYLOAD',
      normalized: null,
    };
  }

  const resolvedCompanyId =
    normalized.company_id || (await resolveCompanyIdFromPayload(rawPayload));

  if (!resolvedCompanyId) {
    return {
      processed: false,
      reason: 'COMPANY_NOT_RESOLVED',
      normalized,
    };
  }

  normalized.company_id = resolvedCompanyId;
  const nowIso = new Date().toISOString();

  try {
    const conversation = await upsertConversationInbound({
      companyId: resolvedCompanyId,
      from: normalized.from,
      nowIso,
    });

    const conversationId = conversation?.id || null;
    const inboundCandidates = buildInboundMessageCandidates({
      companyId: resolvedCompanyId,
      conversationId,
      from: normalized.from,
      messageObj: normalized.message,
      nowIso,
      rawPayload,
    });

    await insertMessageWithFallback(inboundCandidates);

    return {
      processed: true,
      normalized,
      conversation,
    };
  } catch (error) {
    console.error('[Inbox] inbound persist failed', error?.message || error);
    return {
      processed: false,
      reason: 'PERSISTENCE_ERROR',
      normalized,
      error,
    };
  }
}

async function listConversations(companyId, search = '') {
  let query = supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false })
    .limit(200);

  const normalizedSearch = String(search || '').trim().replace(/[,%]/g, '');
  if (normalizedSearch) {
    query = query.or(
      `contact_name.ilike.%${normalizedSearch}%,contact_number.ilike.%${normalizedSearch}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const conversations = data || [];
  const contacts = conversations
    .map((item) => item.contact_number)
    .filter(Boolean);

  let stateByContact = {};

  if (contacts.length > 0) {
    const { data: states } = await supabase
      .from('conversation_states')
      .select('contact, mode, assigned_agent_id')
      .eq('company_id', companyId)
      .in('contact', contacts);

    stateByContact = (states || []).reduce((acc, state) => {
      acc[state.contact] = state;
      return acc;
    }, {});
  }

  return conversations.map((conversation) => {
    const state = stateByContact[conversation.contact_number] || {};
    return {
      ...conversation,
      mode: conversation.mode || state.mode || 'bot',
      assigned_agent_id:
        conversation.assigned_agent_id || state.assigned_agent_id || null,
    };
  });
}

async function getConversationById(companyId, conversationId) {
  const { data, error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function listMessages(companyId, conversationId) {
  const { data, error } = await supabase
    .from(INBOX_MESSAGES_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(300);

  if (error) throw error;
  return data || [];
}

async function sendManualMessage({ companyId, clientId, conversationId, text, actorUserId }) {
  const conversation = await getConversationById(companyId, conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const contact = conversation.contact_number;
  if (!contact) {
    const err = new Error('Conversation missing contact_number');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const outboundCandidates = buildOutboundMessageCandidates({
    companyId,
    conversationId,
    to: contact,
    text,
    nowIso,
    metadata: actorUserId ? { actor_user_id: actorUserId } : null,
  });

  const savedMessage = await insertMessageWithFallback(outboundCandidates);

  await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .update({
      status: 'open',
      last_message_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', conversationId);

  let cloudApiDispatched = false;
  let dispatchError = null;

  if (clientId) {
    try {
      await whatsappService.sendMessage(clientId, contact, text);
      cloudApiDispatched = true;

      if (savedMessage?.id) {
        await supabase
          .from(INBOX_MESSAGES_TABLE)
          .update({ status: 'sent' })
          .eq('id', savedMessage.id);
      }
    } catch (error) {
      dispatchError = error?.message || 'Cloud API dispatch failed';
      console.warn('[Inbox] outbound dispatch failed', dispatchError);

      if (savedMessage?.id) {
        await supabase
          .from(INBOX_MESSAGES_TABLE)
          .update({ status: 'failed' })
          .eq('id', savedMessage.id);
      }
    }
  }

  return {
    message: savedMessage,
    cloud_api_dispatched: cloudApiDispatched,
    cloud_api_error: dispatchError,
  };
}

async function assignConversation({ companyId, conversationId, agentId }) {
  const conversation = await getConversationById(companyId, conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const contact = conversation.contact_number;
  return attendanceService.transferToAgent(companyId, contact, agentId);
}

async function changeConversationMode({ companyId, conversationId, mode, agentId }) {
  const conversation = await getConversationById(companyId, conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const contact = conversation.contact_number;

  if (mode === 'human') {
    return attendanceService.transferToHuman(companyId, contact, agentId || null);
  }

  if (mode === 'bot') {
    return attendanceService.returnToBot(companyId, contact);
  }

  const err = new Error('Invalid mode. Use bot or human');
  err.statusCode = 400;
  throw err;
}

module.exports = {
  processInboundWebhook,
  listConversations,
  listMessages,
  sendManualMessage,
  assignConversation,
  changeConversationMode,
};
