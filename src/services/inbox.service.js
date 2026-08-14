const supabase = require('../config/supabase');
const { safeErrorFields, safeLogFields } = require('../security/telemetrySanitizer');
const safeLogger = require('../security/safeLogger');
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
  if (!payload || typeof payload !== "object") return null;

  if (payload.company_id && payload.from && payload.message) {
    const messageObj = toMessageObjectFromLegacy(payload.message);
    if (!messageObj) return null;

    return {
      company_id: payload.company_id,
      from: String(payload.from),
      phone_number_id: payload.phone_number_id || payload.whatsapp_account_id || null,
      message: messageObj,
      raw: payload
    };
  }

  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  if (!value) return null;

  const message = Array.isArray(value.messages) ? value.messages[0] : null;
  if (!message || !message.from) {
    if (Array.isArray(value.statuses) && value.statuses.length) {
      return {
        kind: "status",
        status: value.statuses[0],
        raw: payload
      };
    }
    return null;
  }

  const normalized = {
    company_id: null,
    from: String(message.from),
    phone_number_id: value?.metadata?.phone_number_id || payload.phone_number_id || null,
    message: {
      type: message.type || "text"
    },
    raw: payload
  };

  if (message.type === "text") {
    normalized.message.text = { body: message.text?.body || "" };
  } else if (message.type === "audio") {
    normalized.message.audio = {
      id: message.audio?.id || null,
      file_size: message.audio?.file_size || null
    };
  } else if (message.type === "button") {
    normalized.message.type = "text";
    normalized.message.text = { body: message.button?.text || "" };
  } else if (message.type === "interactive") {
    normalized.message.type = "text";
    normalized.message.text = {
      body:
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        ""
    };
  }

  return normalized;
}

async function resolveCompanyIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const isMetaWebhook = Array.isArray(payload.entry);
  if (!isMetaWebhook) {
    if (payload.company_id) return payload.company_id;
    if (payload.companyId) return payload.companyId;

    const legacyWaAccountId = payload.whatsapp_account_id;
    if (legacyWaAccountId) {
      const { data: waRows, error: waError } = await supabase
        .from('whatsapp_accounts')
        .select('company_id, client_id')
        .eq('id', legacyWaAccountId)
        .limit(2);
      const rows = Array.isArray(waRows) ? waRows : [];
      if (waError || rows.length !== 1) return null;
      if (rows[0].company_id) return rows[0].company_id;
    }
  }

  const phoneNumberId =
    payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ||
    payload.phone_number_id ||
    null;
  if (!phoneNumberId) return null;

  const { data: waRows, error: waError } = await supabase
    .from('whatsapp_accounts')
    .select('company_id, client_id')
    .eq('phone_number_id', phoneNumberId)
    .limit(2);

  const matches = Array.isArray(waRows) ? waRows : [];
  if (waError || matches.length !== 1) return null;

  const account = matches[0];
  if (account.company_id) return account.company_id;
  if (!account.client_id) return null;

  const { data: companyRows, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('client_id', account.client_id)
    .limit(2);

  const companies = Array.isArray(companyRows) ? companyRows : [];
  if (companyError || companies.length !== 1) return null;
  return companies[0].id || null;
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

  for (let idx = 0; idx < payloadCandidates.length; idx++) {
    const candidate = payloadCandidates[idx];
    const { data, error } = await supabase
      .from(INBOX_MESSAGES_TABLE)
      .insert(aaR24fR3hgPreserveLocalCandidate(candidate))
      .select('*')
      .maybeSingle();

    if (!error) {
      safeLogger.log(`[Inbox Persist] candidate=${idx + 1} saved successfully`);
      return data || null;
    }

    lastError = error;
    safeLogger.warn(`[Inbox Persist] candidate=${idx + 1} failed: ${error.message || error}`);
  }

  if (lastError) throw lastError;
  return null;
}

function buildInboundMessageCandidates({ companyId, conversationId, from, messageObj, nowIso, rawPayload, providerMessageId }) {
  const body = extractMessageBody(messageObj);
  const safeMetadata = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};

  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'inbound',
      type: messageObj.type || 'text',
      content: body,
      from: from,
      metadata: safeMetadata,
      status: 'received',
      provider_message_id: providerMessageId,
      sender_type: 'customer',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'inbound',
      type: messageObj.type || 'text',
      content: body,
      from: from,
      metadata: safeMetadata,
      status: 'received',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      from_me: false,
      content: body,
      message: body,
      metadata: safeMetadata,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      content: body,
      created_at: nowIso,
    }
  ];
}

function buildOutboundMessageCandidates({
  companyId,
  conversationId,
  to,
  body,
  nowIso,
  senderType = 'human',
  providerMessageId = null,
  metadata = {}
}) {
  const content = normalizeTextContent(body);
  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content,
      metadata: safeMetadata,
      status: 'sent',
      provider_message_id: providerMessageId,
      sender_type: senderType,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content,
      metadata: safeMetadata,
      status: 'sent',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      from_me: true,
      content,
      message: content,
      metadata: safeMetadata,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      content,
      created_at: nowIso,
    }
  ];
}

async function processInboundWebhook(rawPayload) {
  const normalized = normalizeInboundPayload(rawPayload);

  if (!normalized) {
    return {
      processed: false,
      reason: "UNSUPPORTED_PAYLOAD",
      normalized: null
    };
  }

  if (normalized.kind === "status") {
    return {
      processed: false,
      reason: "STATUS_EVENT",
      normalized
    };
  }

  const resolvedCompanyId =
    normalized.company_id || (await resolveCompanyIdFromPayload(rawPayload));

  if (!resolvedCompanyId) {
    return {
      processed: false,
      reason: "COMPANY_NOT_RESOLVED",
      normalized: {
        ...normalized,
        company_id: null
      }
    };
  }

  normalized.company_id = resolvedCompanyId;

  const nowIso = new Date().toISOString();

  const conversation = await upsertConversationInbound({
    companyId: resolvedCompanyId,
    from: normalized.from,
    nowIso
  });

  const messageRecord = await insertMessageWithFallback(
    buildInboundMessageCandidates({
      companyId: resolvedCompanyId,
      conversationId: conversation?.id || null,
      from: normalized.from,
      messageObj: normalized.message,
      nowIso,
      rawPayload
    })
  );

  return {
    processed: true,
    reason: "INBOUND_MESSAGE",
    company_id: resolvedCompanyId,
    conversation,
    messageRecord,
    normalized
  };
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
      safeLogger.warn('[Inbox] outbound dispatch failed', dispatchError);

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



async function persistOutboundBotMessage({ companyId, to, content, providerMessageId = null, senderType = 'bot', metadata = null }) {
  const nowIso = new Date().toISOString();
  const body = String(content || '').trim();

  if (!companyId || !to || !body) {
    return { skipped: true, reason: 'INVALID_OUTBOUND_PAYLOAD' };
  }

  const conversation = await upsertConversationInbound({
    companyId,
    from: String(to),
    nowIso
  });

  const payloadCandidates = [
    {
      company_id: companyId,
      conversation_id: conversation.id,
      direction: 'outbound',
      sender_type: senderType,
      message_type: 'text',
      content: body,
      provider_message_id: providerMessageId,
      metadata: metadata || null,
      status: 'sent',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversation.id,
      direction: 'outbound',
      sender_type: senderType,
      type: 'text',
      content: body,
      provider_message_id: providerMessageId,
      metadata: metadata || null,
      status: 'sent',
      from_me: true,
      to: String(to),
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversation.id,
      direction: 'outbound',
      sender_type: senderType,
      content: body,
      provider_message_id: providerMessageId,
      created_at: nowIso,
    }
  ];

  const inserted = await insertMessageWithFallback(payloadCandidates);

  await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .update({
      last_message_at: nowIso,
      updated_at: nowIso,
      status: 'open'
    })
    .eq('id', conversation.id);

  return {
    success: true,
    conversation_id: conversation?.id || null,
    message_id: inserted?.id || null
  };
}

module.exports = {
  persistOutboundBotMessage,
  processInboundWebhook,
  listConversations,
  listMessages,
  sendManualMessage,
  assignConversation,
  changeConversationMode,
};

/* __AUTOATENDE_BLOCO_A_PATCH_V1__ */

function normalizeTextContent(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function getMetaMessageId(rawPayload) {
  return rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || null;
}

async function messageExistsByProviderId(companyId, providerMessageId) {
  if (!providerMessageId) return false;

  const { data, error } = await supabase
    .from(INBOX_MESSAGES_TABLE)
    .select('id')
    .eq('company_id', companyId)
    .eq('provider_message_id', providerMessageId)
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('provider_message_id')) {
      return false;
    }
    throw error;
  }

  return !!data;
}

async function findConversationById(companyId, conversationId) {
  if (!companyId || !conversationId) return null;

  const { data, error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findConversationByContact(companyId, contactNumber) {
  if (!companyId || !contactNumber) return null;

  const { data, error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('contact_number', contactNumber)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getOrCreateConversationByContact({ companyId, contactNumber, nowIso }) {
  const existing = await findConversationByContact(companyId, contactNumber);
  if (existing) return existing;

  const insertPayload = {
    company_id: companyId,
    contact_number: contactNumber,
    status: 'open',
    mode: 'bot',
    last_message_at: nowIso,
    updated_at: nowIso
  };

  const { data, error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .insert(insertPayload)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
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

async function upsertConversationOutbound({ companyId, conversationId, to, nowIso }) {
  let conversation = null;

  if (conversationId) {
    conversation = await findConversationById(companyId, conversationId);
  }

  if (!conversation) {
    conversation = await getOrCreateConversationByContact({
      companyId,
      contactNumber: to,
      nowIso
    });
  }

  const { data: updated, error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .update({
      status: 'open',
      last_message_at: nowIso,
      updated_at: nowIso
    })
    .eq('id', conversation.id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return updated || conversation;
}

function buildInboundMessageCandidates({ companyId, conversationId, from, messageObj, nowIso, rawPayload, providerMessageId }) {
  const body = extractMessageBody(messageObj);
  const safeMetadata = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};

  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'inbound',
      type: messageObj.type || 'text',
      content: body,
      from: from,
      metadata: safeMetadata,
      status: 'received',
      provider_message_id: providerMessageId,
      sender_type: 'customer',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'inbound',
      type: messageObj.type || 'text',
      content: body,
      from: from,
      metadata: safeMetadata,
      status: 'received',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      from_me: false,
      content: body,
      message: body,
      metadata: safeMetadata,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      content: body,
      created_at: nowIso,
    }
  ];
}

function buildOutboundMessageCandidates({
  companyId,
  conversationId,
  to,
  body,
  nowIso,
  senderType = 'human',
  providerMessageId = null,
  metadata = {}
}) {
  const content = normalizeTextContent(body);
  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content,
      metadata: safeMetadata,
      status: 'sent',
      provider_message_id: providerMessageId,
      sender_type: senderType,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content,
      metadata: safeMetadata,
      status: 'sent',
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      from_me: true,
      content,
      message: content,
      metadata: safeMetadata,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      content,
      created_at: nowIso,
    }
  ];
}

async function processInboundWebhook(payload) {
  const normalized = normalizeInboundPayload(payload);

  if (!normalized) {
    return { processed: false, reason: 'INVALID_PAYLOAD' };
  }

  if (normalized.kind === 'status') {
    return { processed: false, reason: 'STATUS_EVENT', status: normalized.status || null };
  }

  const companyId = normalized.company_id || await resolveCompanyIdFromPayload(payload);
  if (!companyId) {
    return { processed: false, reason: 'COMPANY_NOT_RESOLVED' };
  }

  normalized.company_id = companyId;

  const nowIso = new Date().toISOString();
  const providerMessageId = getMetaMessageId(payload);

  if (providerMessageId) {
    const alreadyExists = await messageExistsByProviderId(companyId, providerMessageId);
    if (alreadyExists) {
      return {
        processed: false,
        reason: 'DUPLICATE_MESSAGE',
        normalized: {
          ...normalized,
          company_id: companyId
        }
      };
    }
  }

  const conversation = await upsertConversationInbound({
    companyId,
    from: normalized.from,
    nowIso
  });

  const savedMessage = await insertMessageWithFallback(
    buildInboundMessageCandidates({
      companyId,
      conversationId: conversation.id,
      from: normalized.from,
      messageObj: normalized.message,
      nowIso,
      rawPayload: payload,
      providerMessageId
    })
  );

  return {
    processed: true,
    conversation,
    message: savedMessage || null,
    normalized: {
      ...normalized,
      company_id: companyId,
      conversation_id: conversation.id
    }
  };
}

async function sendTextMessageAndPersist({
  companyId,
  conversationId = null,
  to = null,
  body,
  senderType = 'human',
  metadata = {}
}) {
  const content = normalizeTextContent(body);
  if (!companyId) throw new Error('companyId is required');
  if (!content) throw new Error('body is required');

  let conversation = null;

  if (conversationId) {
    conversation = await findConversationById(companyId, conversationId);
  }

  const destination = to || conversation?.contact_number || null;
  if (!destination) {
    throw new Error('Destination contact not resolved');
  }

  const nowIso = new Date().toISOString();

  if (!conversation) {
    conversation = await getOrCreateConversationByContact({
      companyId,
      contactNumber: destination,
      nowIso
    });
  }

  const sendResult = await whatsappService.sendMessage(companyId, destination, content);

  const updatedConversation = await upsertConversationOutbound({
    companyId,
    conversationId: conversation.id,
    to: destination,
    nowIso
  });

  const savedMessage = await insertMessageWithFallback(
    buildOutboundMessageCandidates({
      companyId,
      conversationId: updatedConversation.id,
      to: destination,
      body: content,
      nowIso,
      senderType,
      providerMessageId: sendResult?.provider_message_id || null,
      metadata: {
        ...metadata,
        provider_response: sendResult?.provider_response || null
      }
    })
  );

  return {
    success: true,
    responseSent: true,
    conversation: updatedConversation,
    message: savedMessage || null,
    provider_message_id: sendResult?.provider_message_id || null,
    to: destination
  };
}

module.exports.processInboundWebhook = processInboundWebhook;
module.exports.sendTextMessageAndPersist = sendTextMessageAndPersist;



/* __AUTOATENDE_B48_OUTBOUND_HARDEN__ */
function buildOutboundMessageCandidates({
  companyId,
  conversationId,
  to,
  text,
  body,
  content,
  nowIso,
  senderType = 'human',
  providerMessageId = null,
  metadata = {}
}) {
  const normalizedContent = normalizeTextContent(
    content ?? body ?? text
  );

  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content: normalizedContent,
      metadata: safeMetadata,
      status: 'sent',
      provider_message_id: providerMessageId,
      sender_type: senderType,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content: normalizedContent,
      status: 'sent',
      provider_message_id: providerMessageId,
      sender_type: senderType,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      content: normalizedContent,
      status: 'sent',
      provider_message_id: providerMessageId,
      sender_type: senderType,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      content: normalizedContent,
      sender_type: senderType,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      content: normalizedContent,
      created_at: nowIso,
    }
  ];
}



/* __AUTOATENDE_B49_REAL_SCHEMA_MESSAGE_PATHS__ */

function __b49NowIso() {
  return new Date().toISOString();
}

function __b49NormalizeText(value) {
  return String(value ?? '').replace(/\r/g, '').trim();
}

function __b49NormalizeContact(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function __b49ExtractInboundText(messageObj) {
  if (!messageObj || typeof messageObj !== 'object') return '';

  const type = String(messageObj.type || 'text').toLowerCase();

  if (type === 'text') {
    return __b49NormalizeText(messageObj.text?.body || '');
  }

  if (type === 'button') {
    return __b49NormalizeText(messageObj.button?.text || '');
  }

  if (type === 'interactive') {
    return __b49NormalizeText(
      messageObj.interactive?.button_reply?.title ||
      messageObj.interactive?.list_reply?.title ||
      ''
    );
  }

  if (type === 'image') {
    return __b49NormalizeText(messageObj.image?.caption || '[imagem]');
  }

  if (type === 'video') {
    return __b49NormalizeText(messageObj.video?.caption || '[vídeo]');
  }

  if (type === 'document') {
    return __b49NormalizeText(
      messageObj.document?.caption ||
      messageObj.document?.filename ||
      '[documento]'
    );
  }

  if (type === 'audio') {
    return '[áudio]';
  }

  return __b49NormalizeText(messageObj.text?.body || `[${type}]`);
}

async function __b49InsertMessageReal({
  companyId,
  conversationId,
  direction,
  senderType = null,
  content,
  providerMessageId = null,
  createdAt = null,
  messageType = null,
  raw = null,
  meta = null,
}) {
  const payload = {
    company_id: companyId,
    conversation_id: conversationId,
    direction: direction === 'outbound' ? 'outbound' : 'inbound',
    sender_type: senderType || null,
    content: __b49NormalizeText(content),
    provider_message_id: providerMessageId || null,
      message_type: messageType || null,
      raw: raw || null,
      meta: meta || null,
    created_at: createdAt || __b49NowIso()
  };

  const { data, error } = await supabase
    .from(INBOX_MESSAGES_TABLE)
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function __b49TouchConversation({
  conversationId,
  nowIso,
  inbound = false
}) {
  if (!conversationId) return;

  const updates = {
    last_message_at: nowIso,
    updated_at: nowIso,
    status: 'open'
  };

  if (inbound) {
    updates.last_inbound_at = nowIso;
  }

  const { error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .update(updates)
    .eq('id', conversationId);

  if (error) {
    safeLogger.warn('[B49] conversation touch warning:', error.message || error);
  }
}


function __b49BuildContactCandidates(contactNumber) {
  const normalized = __b49NormalizeContact(contactNumber);
  if (!normalized) return [];

  const candidates = [
    normalized,
    normalized.length >= 11 ? normalized.slice(-11) : '',
    normalized.length >= 10 ? normalized.slice(-10) : '',
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

function __b49ConversationMatchesCandidate(conversation, candidate) {
  if (!conversation || !candidate) return false;
  return String(conversation.contact_number || '') === candidate ||
    String(conversation.contact_phone || '') === candidate;
}

async function __b49LoadConversationMessageCounts(companyId, conversationIds = []) {
  const ids = Array.from(new Set((conversationIds || []).filter(Boolean)));
  if (!ids.length) return {};

  const counts = {};
  const { data, error } = await supabase
    .from(INBOX_MESSAGES_TABLE)
    .select('conversation_id')
    .eq('company_id', companyId)
    .in('conversation_id', ids)
    .limit(4000);

  if (error) {
    safeLogger.warn('[C16N_C6B_R1] message_count_load_warning', error.message || error);
    return counts;
  }

  for (const row of data || []) {
    const id = row?.conversation_id;
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }

  return counts;
}

async function __b49FindExistingConversationLoose({
  companyId,
  contactNumber
}) {
  const candidates = __b49BuildContactCandidates(contactNumber);
  if (!companyId || !candidates.length) return null;

  const orExpr = candidates
    .flatMap((value) => [
      `contact_number.eq.${value}`,
      `contact_phone.eq.${value}`
    ])
    .join(',');

  const { data, error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('id, company_id, contact_number, contact_phone, updated_at, created_at, last_message_at, last_inbound_at')
    .eq('company_id', companyId)
    .or(orExpr)
    .limit(20);

  if (error) {
    safeLogger.warn('[C16N_C6B_R1] existing_conversation_lookup_warning', error.message || error);
    return null;
  }

  const rows = Array.isArray(data) ? data.filter(Boolean) : [];
  if (!rows.length) return null;

  const counts = await __b49LoadConversationMessageCounts(
    companyId,
    rows.map((row) => row.id).filter(Boolean)
  );

  const primaryCandidate = candidates[0] || '';

  rows.sort((left, right) => {
    const leftCount = Number(counts[left.id] || 0);
    const rightCount = Number(counts[right.id] || 0);
    if (rightCount !== leftCount) return rightCount - leftCount;

    const leftExact = __b49ConversationMatchesCandidate(left, primaryCandidate) ? 1 : 0;
    const rightExact = __b49ConversationMatchesCandidate(right, primaryCandidate) ? 1 : 0;
    if (rightExact !== leftExact) return rightExact - leftExact;

    const leftInbound = new Date(left.last_inbound_at || left.last_message_at || left.updated_at || left.created_at || 0).getTime();
    const rightInbound = new Date(right.last_inbound_at || right.last_message_at || right.updated_at || right.created_at || 0).getTime();
    if (rightInbound !== leftInbound) return rightInbound - leftInbound;

    const leftUpdated = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightUpdated = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightUpdated - leftUpdated;
  });

  return rows[0] || null;
}

async function __b49FindOrCreateConversation({
  companyId,
  conversationId = null,
  contactNumber = null,
  nowIso
}) {
  if (conversationId) {
    const existingById = await getConversationById(companyId, conversationId);
    if (existingById?.id) return existingById;
  }

  const normalizedContact = __b49NormalizeContact(contactNumber);
  if (!normalizedContact) return null;

  const existingLoose = await __b49FindExistingConversationLoose({
    companyId,
    contactNumber: normalizedContact
  });

  if (existingLoose?.id) {
    return existingLoose;
  }

  if (typeof getOrCreateConversationByContact === 'function') {
    return getOrCreateConversationByContact({
      companyId,
      contactNumber: normalizedContact,
      nowIso
    });
  }

  return upsertConversationInbound({
    companyId,
    from: normalizedContact,
    nowIso
  });
}


// __AUTOATENDE_V4_R24D_B_CAPTURE_MEDIA_ID_FROM_WEBHOOK_PAYLOAD__
const aaR24dBMediaTypes = ['image', 'audio', 'video', 'document', 'sticker'];

function aaR24dBObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function aaR24dBArray(value) {
  return Array.isArray(value) ? value : [];
}

function aaR24dBAllWebhookMessages(payload) {
  // __AUTOATENDE_V4_R24D_B2_R2_REAPPLY_ROOT_MESSAGES_FIX_APP_PATH_SMOKE__
  const root = aaR24dBObject(payload);
  if (!root) return [];

  const messages = [];

  for (const entry of aaR24dBArray(root.entry)) {
    for (const change of aaR24dBArray(entry?.changes)) {
      const value = aaR24dBObject(change?.value);
      for (const message of aaR24dBArray(value?.messages)) {
        if (aaR24dBObject(message)) messages.push(message);
      }
    }
  }

  const directRootMessage = aaR24dBObject(root.message);
  if (directRootMessage) messages.push(directRootMessage);

  const directRootMessages = root.messages;
  if (Array.isArray(directRootMessages)) {
    for (const message of directRootMessages) {
      if (aaR24dBObject(message)) messages.push(message);
    }
  } else if (aaR24dBObject(directRootMessages)) {
    messages.push(directRootMessages);
  }

  return messages;
}

function aaR24dBPickWebhookMessage(rawPayload, providerMessageId) {
  const messages = aaR24dBAllWebhookMessages(rawPayload);
  if (!messages.length) return null;

  if (providerMessageId) {
    const exact = messages.find((message) => String(message?.id || '') === String(providerMessageId));
    if (exact) return exact;
  }

  return messages[0] || null;
}

function aaR24dBExtractMediaInfo(normalizedMessage, rawPayload, providerMessageId) {
  const normalized = aaR24dBObject(normalizedMessage) || {};
  const webhookMessage = aaR24dBPickWebhookMessage(rawPayload, providerMessageId) || {};
  const type = String(normalized.type || webhookMessage.type || '').toLowerCase();

  if (!aaR24dBMediaTypes.includes(type)) {
    return {
      type: type || String(normalized.type || webhookMessage.type || '').toLowerCase() || null,
      webhookMessage,
      mediaPayload: null,
      media_id: null,
    };
  }

  const mediaPayload =
    aaR24dBObject(webhookMessage[type]) ||
    aaR24dBObject(normalized[type]) ||
    null;

  return {
    type,
    webhookMessage,
    mediaPayload,
    media_id: mediaPayload?.id || normalized?.media_id || webhookMessage?.media_id || null,
    mime_type: mediaPayload?.mime_type || normalized?.mime_type || webhookMessage?.mime_type || null,
    sha256: mediaPayload?.sha256 || normalized?.sha256 || webhookMessage?.sha256 || null,
    caption: mediaPayload?.caption || normalized?.caption || webhookMessage?.caption || null,
    filename: mediaPayload?.filename || normalized?.filename || webhookMessage?.filename || null,
    file_size: mediaPayload?.file_size || normalized?.file_size || webhookMessage?.file_size || null,
    voice: mediaPayload?.voice ?? normalized?.voice ?? webhookMessage?.voice ?? null,
    animated: mediaPayload?.animated ?? normalized?.animated ?? webhookMessage?.animated ?? null,
  };
}

function aaR24dBMergeRawMessage(normalizedMessage, rawPayload, providerMessageId) {
  const normalized = aaR24dBObject(normalizedMessage) || {};
  const info = aaR24dBExtractMediaInfo(normalized, rawPayload, providerMessageId);

  if (!info.type || !aaR24dBMediaTypes.includes(info.type)) {
    return Object.keys(normalized).length ? normalized : null;
  }

  if (aaR24dBObject(info.webhookMessage) && aaR24dBObject(info.webhookMessage[info.type])) {
    return info.webhookMessage;
  }

  if (info.mediaPayload) {
    return {
      ...normalized,
      type: info.type,
      [info.type]: info.mediaPayload,
    };
  }

  return Object.keys(normalized).length ? normalized : null;
}

function aaR24dBMergeMeta(existingMeta, normalizedMessage, rawPayload, providerMessageId) {
  const base = aaR24dBObject(existingMeta) || {};
  const info = aaR24dBExtractMediaInfo(normalizedMessage, rawPayload, providerMessageId);

  if (!info.type || !aaR24dBMediaTypes.includes(info.type)) {
    return base;
  }

  return {
    ...base,
    type: base.type || info.type,
    media_id: base.media_id || info.media_id || null,
    mime_type: base.mime_type || info.mime_type || null,
    sha256: base.sha256 || info.sha256 || null,
    caption: base.caption || info.caption || null,
    filename: base.filename || info.filename || null,
    file_size: base.file_size || info.file_size || null,
    voice: base.voice ?? info.voice ?? null,
    animated: base.animated ?? info.animated ?? null,
    provider_message_id: base.provider_message_id || providerMessageId || info.webhookMessage?.id || null,
    source: info.media_id ? 'r24d_b_media_id_from_webhook_payload' : (base.source || 'r24d_b_no_media_id_found'),
  };
}


async function __b49ProcessInboundWebhook(rawPayload) {
  const normalized = normalizeInboundPayload(rawPayload);

  if (!normalized) {
    return {
      processed: false,
      reason: 'UNSUPPORTED_PAYLOAD',
      normalized: null
    };
  }

  if (normalized.kind === 'status') {
    return {
      processed: false,
      reason: 'STATUS_EVENT',
      normalized
    };
  }

  const resolvedCompanyId =
    normalized.company_id || (await resolveCompanyIdFromPayload(rawPayload));

  if (!resolvedCompanyId) {
    return {
      processed: false,
      reason: 'COMPANY_NOT_RESOLVED',
      normalized: {
        ...normalized,
        company_id: null
      }
    };
  }

  normalized.company_id = resolvedCompanyId;

  const providerMessageId =
    rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || null;

  if (providerMessageId && typeof messageExistsByProviderId === 'function') {
    try {
      const alreadyExists = await messageExistsByProviderId(
        resolvedCompanyId,
        providerMessageId
      );

      if (alreadyExists) {
        return {
          processed: true,
          reason: 'DUPLICATE_PROVIDER_MESSAGE',
          company_id: resolvedCompanyId,
          normalized
        };
      }
    } catch (err) {
      safeLogger.warn('[B49] duplicate check warning:', err?.message || err);
    }
  }

  const nowIso = __b49NowIso();

  const conversation = await upsertConversationInbound({
    companyId: resolvedCompanyId,
    from: normalized.from,
    nowIso
  });

  const body = __b49ExtractInboundText(normalized.message);

  const messageRecord = await __b49InsertMessageReal({
    companyId: resolvedCompanyId,
    conversationId: conversation?.id || null,
    direction: 'inbound',
    senderType: 'customer',
    content: body,
    providerMessageId,
    createdAt: nowIso,
      messageType: aaR24fR3hgNormalizeType(normalized.message, body),
      raw: aaR24dBMergeRawMessage(normalized.message, rawPayload, providerMessageId),
      meta: aaR24dBMergeMeta(aaR24fR3hgBuildMeta(normalized.message, rawPayload, providerMessageId, body), normalized.message, rawPayload, providerMessageId),});

  await __b49TouchConversation({
    conversationId: conversation?.id || null,
    nowIso,
    inbound: true
  });

  safeLogger.log(
    `[B49] inbound_saved conversation_id=${conversation?.id || '-'} message_id=${messageRecord?.id || '-'} provider_message_id=${providerMessageId || '-'}`
  );

  return {
    processed: true,
    reason: 'INBOUND_MESSAGE',
    company_id: resolvedCompanyId,
    conversation,
    messageRecord,
    normalized
  };
}

async function __b49SendTextMessageAndPersist({
  companyId,
  conversationId = null,
  destination = null,
  to = null,
  content = null,
  text = null,
  senderType = 'human',
  metadata = null
}) {
  if (!companyId) {
    const err = new Error('Missing companyId');
    err.statusCode = 400;
    throw err;
  }

  const body = __b49NormalizeText(content || text);
  if (!body) {
    const err = new Error('Missing content');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = __b49NowIso();

  const conversation = await __b49FindOrCreateConversation({
    companyId,
    conversationId,
    contactNumber: destination || to,
    nowIso
  });

  if (!conversation?.id) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const finalDestination = __b49NormalizeContact(
    destination ||
    to ||
    conversation.contact_number ||
    conversation.contact_phone
  );

  if (!finalDestination) {
    const err = new Error('Conversation missing destination contact');
    err.statusCode = 400;
    throw err;
  }

  const sendResult = await whatsappService.sendMessage(
    companyId,
    finalDestination,
    body
  );

  const savedMessage = await __b49InsertMessageReal({
    companyId,
    conversationId: conversation.id,
    direction: 'outbound',
    senderType: senderType || 'human',
    content: body,
    providerMessageId: sendResult?.provider_message_id || null,
    createdAt: nowIso
  });

  await __b49TouchConversation({
    conversationId: conversation.id,
    nowIso,
    inbound: false
  });

  safeLogger.log(
    `[B49] outbound_saved conversation_id=${conversation.id} message_id=${savedMessage?.id || '-'} sender_type=${senderType || 'human'} provider_message_id=${sendResult?.provider_message_id || '-'}`
  );

  return {
    success: true,
    conversation_id: conversation.id,
    message: savedMessage,
    message_id: savedMessage?.id || null,
    provider_message_id: sendResult?.provider_message_id || null,
    provider_response: sendResult?.provider_response || null,
    metadata: metadata || null
  };
}

async function __b49SendManualMessage({
  companyId,
  clientId,
  conversationId,
  text,
  actorUserId
}) {
  return __b49SendTextMessageAndPersist({
    companyId,
    conversationId,
    content: text,
    senderType: 'human',
    metadata: actorUserId ? { actor_user_id: actorUserId } : null
  });
}

async function __b49PersistOutboundBotMessage({
  companyId,
  to,
  content,
  providerMessageId = null,
  senderType = 'bot',
  metadata = null
}) {
  const body = __b49NormalizeText(content);
  const destination = __b49NormalizeContact(to);

  if (!companyId || !destination || !body) {
    return { skipped: true, reason: 'INVALID_OUTBOUND_PAYLOAD' };
  }

  const nowIso = __b49NowIso();

  const conversation = await __b49FindOrCreateConversation({
    companyId,
    contactNumber: destination,
    nowIso
  });

  if (!conversation?.id) {
    throw new Error('Unable to resolve conversation for outbound bot message');
  }

  const inserted = await __b49InsertMessageReal({
    companyId,
    conversationId: conversation.id,
    direction: 'outbound',
    senderType: senderType || 'bot',
    content: body,
    providerMessageId: providerMessageId || null,
    createdAt: nowIso
  });

  await __b49TouchConversation({
    conversationId: conversation.id,
    nowIso,
    inbound: false
  });

  safeLogger.log(
    `[B49] bot_outbound_persisted conversation_id=${conversation.id} message_id=${inserted?.id || '-'} provider_message_id=${providerMessageId || '-'}`
  );

  return {
    success: true,
    conversation_id: conversation.id,
    message_id: inserted?.id || null,
    provider_message_id: providerMessageId || null,
    metadata: metadata || null
  };
}

module.exports.processInboundWebhook = __b49ProcessInboundWebhook;
module.exports.sendTextMessageAndPersist = __b49SendTextMessageAndPersist;
module.exports.sendManualMessage = __b49SendManualMessage;
module.exports.persistOutboundBotMessage = __b49PersistOutboundBotMessage;


/* __AUTOATENDE_B52_INBOX_PREVIEW_ENRICH__ */

function b52NormalizeConversationContact(conversation) {
  const value =
    conversation?.contact_number ||
    conversation?.contact_phone ||
    null;

  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function b52BuildPreviewFromMessage(message) {
  if (!message || typeof message !== 'object') return null;

  const content = String(message.content || '').trim();
  if (content) {
    return content.length > 120 ? `${content.slice(0, 117)}...` : content;
  }

  const senderType = String(message.sender_type || '').trim().toLowerCase();
  const direction = String(message.direction || '').trim().toLowerCase();

  if (direction === 'outbound' && senderType === 'bot') return '[Mensagem do bot]';
  if (direction === 'outbound' && (senderType === 'human' || senderType === 'agent')) return '[Mensagem da equipe]';
  if (direction === 'inbound' && senderType === 'customer') return '[Mensagem do cliente]';
  if (direction === 'outbound') return '[Mensagem enviada]';
  if (direction === 'inbound') return '[Mensagem recebida]';

  return null;
}

async function b52LoadLatestMessagesByConversation(companyId, conversationIds) {
  const ids = Array.from(new Set((conversationIds || []).filter(Boolean)));
  if (!ids.length) return {};

  const latestByConversation = {};

  const { data, error } = await supabase
    .from(INBOX_MESSAGES_TABLE)
    .select('conversation_id, direction, sender_type, content, created_at')
    .eq('company_id', companyId)
    .in('conversation_id', ids)
    .order('created_at', { ascending: false })
    .limit(4000);

  if (error) {
    safeLogger.warn('[B52] latest messages load warning:', error.message || error);
    return latestByConversation;
  }

  for (const row of (data || [])) {
    if (!row?.conversation_id) continue;
    if (!latestByConversation[row.conversation_id]) {
      latestByConversation[row.conversation_id] = row;
    }
  }

  return latestByConversation;
}

async function listConversationsB52(companyId, search = '') {
  let query = supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false })
    .limit(200);

  const normalizedSearch = String(search || '').trim().replace(/[,%]/g, '');
  if (normalizedSearch) {
    query = query.or(
      `contact_name.ilike.%${normalizedSearch}%,contact_number.ilike.%${normalizedSearch}%,contact_phone.ilike.%${normalizedSearch}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const conversations = data || [];
  const contacts = Array.from(
    new Set(
      conversations
        .map((item) => b52NormalizeConversationContact(item))
        .filter(Boolean)
    )
  );

  let stateByContact = {};

  if (contacts.length > 0) {
    const { data: states, error: statesError } = await supabase
      .from('conversation_states')
      .select('contact, mode, assigned_agent_id')
      .eq('company_id', companyId)
      .in('contact', contacts);

    if (statesError) {
      safeLogger.warn('[B52] conversation_states warning:', statesError.message || statesError);
    } else {
      stateByContact = (states || []).reduce((acc, state) => {
        if (state?.contact) acc[state.contact] = state;
        return acc;
      }, {});
    }
  }

  const latestByConversation = await b52LoadLatestMessagesByConversation(
    companyId,
    conversations.map((item) => item.id).filter(Boolean)
  );

  return conversations.map((conversation) => {
    const contact = b52NormalizeConversationContact(conversation);
    const state = contact ? (stateByContact[contact] || {}) : {};
    const latestMessage = latestByConversation[conversation.id] || null;

    const derivedPreview =
      b52BuildPreviewFromMessage(latestMessage) ||
      String(
        conversation?.last_message_preview ||
        conversation?.last_message ||
        conversation?.preview ||
        conversation?.content ||
        ''
      ).trim() ||
      null;

    const derivedLastMessageAt =
      latestMessage?.created_at ||
      conversation?.last_message_at ||
      conversation?.updated_at ||
      conversation?.created_at ||
      null;

    return {
      ...conversation,
      contact_number: conversation?.contact_number || conversation?.contact_phone || null,
      last_message_preview: derivedPreview,
      last_message: derivedPreview,
      preview: derivedPreview,
      last_message_direction: latestMessage?.direction || null,
      last_message_sender_type: latestMessage?.sender_type || null,
      last_message_at: derivedLastMessageAt,
      mode: conversation?.mode || state?.mode || 'bot',
      assigned_agent_id:
        conversation?.assigned_agent_id ||
        conversation?.assigned_user_id ||
        state?.assigned_agent_id ||
        null
    };
  });
}

module.exports.listConversations = listConversationsB52;

/* __AUTOATENDE_B53_INBOX_ASSIGNMENT_SANITIZE__ */

const __b53_prevListConversations = module.exports.listConversations;

function b53InboxIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function b53NormalizeConversationAssignment(mode, assignedValue) {
  const normalizedMode = String(mode || '').trim().toLowerCase() === 'human' ? 'human' : 'bot';
  if (normalizedMode !== 'human') return null;

  const raw = String(assignedValue || '').trim();
  if (!raw) return null;
  if (raw.toLowerCase() === 'agent_default') return null;

  return b53InboxIsUuid(raw) ? raw : null;
}

module.exports.listConversations = async function b53ListConversations(companyId, search = '') {
  const rows = await __b53_prevListConversations(companyId, search);

  return (rows || []).map((row) => {
    const normalizedMode = String(row?.mode || '').trim().toLowerCase() === 'human' ? 'human' : 'bot';

    return {
      ...row,
      mode: normalizedMode,
      assigned_agent_id: b53NormalizeConversationAssignment(
        normalizedMode,
        row?.assigned_agent_id || row?.assigned_user_id || null
      )
    };
  });
};

/* __AUTOATENDE_B54_LIST_STATE_AUTHORITY__ */

function b54InboxNormalizeMode(value) {
  return String(value || '').trim().toLowerCase() === 'human' ? 'human' : 'bot';
}

function b54InboxIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function b54InboxNormalizeAssigned(value) {
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

  return b54InboxIsUuid(raw) ? raw : null;
}

const __b54PrevListConversations = module.exports.listConversations;

module.exports.listConversations = async function b54ListConversations(companyId, search = '') {
  if (typeof __b54PrevListConversations !== 'function') {
    throw new Error('Previous listConversations export not found');
  }

  const baseList = await __b54PrevListConversations(companyId, search);
  const contacts = (baseList || [])
    .map(item => String(item.contact_number || item.contact_phone || '').trim())
    .filter(Boolean);

  if (contacts.length === 0) {
    return baseList || [];
  }

  let stateRows = [];
  try {
    const { data, error } = await supabase
      .from('conversation_states')
      .select('contact, mode, assigned_agent_id, updated_at')
      .eq('company_id', companyId)
      .in('contact', contacts);

    if (error) {
      safeLogger.warn('[B54] listConversations state overlay warning:', error.message || error);
    } else {
      stateRows = data || [];
    }
  } catch (err) {
    safeLogger.warn('[B54] listConversations state overlay exception:', err?.message || err);
  }

  const stateByContact = stateRows.reduce((acc, row) => {
    acc[String(row.contact || '').trim()] = row;
    return acc;
  }, {});

  return (baseList || []).map(item => {
    const contact = String(item.contact_number || item.contact_phone || '').trim();
    const state = stateByContact[contact] || null;

    if (!state) {
      return {
        ...item,
        mode: b54InboxNormalizeMode(item.mode),
        assigned_agent_id: b54InboxNormalizeAssigned(item.assigned_agent_id || item.assigned_user_id)
      };
    }

    return {
      ...item,
      mode: b54InboxNormalizeMode(state.mode),
      assigned_agent_id: b54InboxNormalizeAssigned(state.assigned_agent_id)
    };
  });
};

/* __AUTOATENDE_B58_AUTO_HANDOVER_ON_HUMAN_OUTBOUND__ */

const __b58OriginalSendManualMessage = module.exports.sendManualMessage;
const __b58OriginalSendTextMessageAndPersist = module.exports.sendTextMessageAndPersist || null;

function __b58NormalizeUuid(value) {
  const str = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
    ? str
    : null;
}

async function __b58GetConversationMeta(companyId, conversationId) {
  if (!companyId || !conversationId) return null;

  const { data, error } = await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('*')
    .eq('company_id', companyId)
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function __b58AutoPauseBotAfterHumanOutbound({
  companyId,
  conversationId = null,
  explicitContact = null,
  actorUserId = null
}) {
  if (!companyId) return { skipped: true, reason: 'MISSING_COMPANY_ID' };

  let contact = explicitContact ? String(explicitContact) : null;

  if (!contact && conversationId) {
    const conversation = await __b58GetConversationMeta(companyId, conversationId);
    contact = String(
      conversation?.contact_number ||
      conversation?.contact_phone ||
      ''
    ).trim();
  }

  if (!contact) {
    return { skipped: true, reason: 'CONTACT_NOT_RESOLVED' };
  }

  const normalizedActor = __b58NormalizeUuid(actorUserId);

  const result = await attendanceService.transferToHuman(
    companyId,
    contact,
    normalizedActor
  );

  safeLogger.log('[B58] auto_handover_to_human', safeLogFields({
    company_id: companyId,
    contact,
    status: normalizedActor ? 'actor_present' : 'actor_absent',
  }));

  return {
    success: true,
    contact,
    actor_user_id: normalizedActor,
    attendance_result: result
  };
}

module.exports.sendManualMessage = async function b58SendManualMessageWrapped(args = {}) {
  const result = await __b58OriginalSendManualMessage(args);

  try {
    await __b58AutoPauseBotAfterHumanOutbound({
      companyId: args.companyId,
      conversationId: args.conversationId,
      actorUserId: args.actorUserId || null
    });
  } catch (err) {
    safeLogger.warn('[B58] sendManualMessage auto handover warning:', err?.message || err);
  }

  return result;
};

if (__b58OriginalSendTextMessageAndPersist) {
  module.exports.sendTextMessageAndPersist = async function b58SendTextMessageAndPersistWrapped(args = {}) {
    const result = await __b58OriginalSendTextMessageAndPersist(args);

    try {
      const actorFromMetadata =
        args?.actorUserId ||
        args?.metadata?.actor_user_id ||
        args?.metadata?.actorUserId ||
        null;

      await __b58AutoPauseBotAfterHumanOutbound({
        companyId: args.companyId,
        conversationId: args.conversationId,
        explicitContact: args.destination || args.to || null,
        actorUserId: actorFromMetadata
      });
    } catch (err) {
      safeLogger.warn('[B58] sendTextMessageAndPersist auto handover warning:', err?.message || err);
    }

    return result;
  };
}

/* __AUTOATENDE_B59_TRUE_LOCAL_ONLY_MANUAL_SEND__ */

const __b59PrevSendManualMessage = module.exports.sendManualMessage;

function __b59IsLocalOnlyMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return metadata.local_only === true || metadata.debug_local_only === true;
}

function __b59BuildSafeLocalOnlyOutboundCandidates({
  companyId,
  conversationId,
  body,
  nowIso
}) {
  const content = normalizeTextContent(body);

  return [
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      sender_type: 'human',
      content,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      direction: 'outbound',
      content,
      created_at: nowIso,
    },
    {
      company_id: companyId,
      conversation_id: conversationId,
      content,
      created_at: nowIso,
    }
  ];
}

module.exports.sendManualMessage = async function b59SendManualMessageWrapped(args = {}) {
  const localOnly = __b59IsLocalOnlyMetadata(args.metadata);

  if (!localOnly) {
    return __b59PrevSendManualMessage(args);
  }

  const companyId = args.companyId;
  const conversationId = args.conversationId;
  const text = normalizeTextContent(args.text);
  const actorUserId = args.actorUserId || null;

  if (!companyId) {
    const err = new Error('Missing companyId');
    err.statusCode = 400;
    throw err;
  }

  if (!conversationId) {
    const err = new Error('Missing conversationId');
    err.statusCode = 400;
    throw err;
  }

  if (!text) {
    const err = new Error('Missing text');
    err.statusCode = 400;
    throw err;
  }

  const conversation = await getConversationById(companyId, conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  const contact = String(
    conversation.contact_number ||
    conversation.contact_phone ||
    ''
  ).trim();

  if (!contact) {
    const err = new Error('Conversation missing contact');
    err.statusCode = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();

  const savedMessage = await insertMessageWithFallback(
    __b59BuildSafeLocalOnlyOutboundCandidates({
      companyId,
      conversationId,
      body: text,
      nowIso
    })
  );

  await supabase
    .from(INBOX_CONVERSATIONS_TABLE)
    .update({
      status: 'open',
      last_message_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', conversationId);

  try {
    await attendanceService.transferToHuman(companyId, contact, actorUserId || null);
  } catch (err) {
    safeLogger.warn('[B59] local_only handover warning:', err?.message || err);
  }

  safeLogger.log('[B59] local_only_manual_send', safeLogFields({
    contact,
    status: savedMessage?.id ? 'saved' : 'unknown',
  }));

  return {
    success: true,
    conversation_id: conversationId,
    message: savedMessage || null,
    message_id: savedMessage?.id || null,
    provider_message_id: null,
    provider_response: null,
    metadata: args.metadata || null,
    cloud_api_dispatched: false,
    local_only: true
  };
};

const { normalizeOperationalAuthorityResult } = require('./operationalAuthorityProjection.service');



// __AUTOATENDE_V4_R24B_F_R3H_G_FIX_SYNTAX_AND_APPLY_B49_RICH_FIELDS__
function aaR24fR3hgSafeString(value, limit = 3000) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, limit);
}

function aaR24fR3hgNormalizeType(message, fallbackContent) {
  const explicit = aaR24fR3hgSafeString(message?.type || message?.message_type || '', 80).toLowerCase();
  if (explicit) return explicit;

  const content = aaR24fR3hgSafeString(fallbackContent || message?.content || '').toLowerCase();

  if (content === '[imagem]' || content.includes('[imagem]')) return 'image';
  if (content === '[audio]' || content === '[áudio]' || content.includes('[audio]') || content.includes('[áudio]')) return 'audio';
  if (content === '[video]' || content === '[vídeo]' || content.includes('[video]') || content.includes('[vídeo]')) return 'video';
  if (content === '[documento]' || content.includes('[documento]')) return 'document';
  if (content === '[system]' || content.includes('[system]')) return 'system';
  if (content === '[unsupported]' || content.includes('[unsupported]')) return 'unsupported';

  return 'text';
}

function aaR24fR3hgMediaPayload(message, type) {
  const payload = message?.[type];
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
}

function aaR24fR3hgBuildMeta(message, rawPayload, providerMessageId, fallbackContent) {
  const type = aaR24fR3hgNormalizeType(message, fallbackContent);
  const payload = aaR24fR3hgMediaPayload(message, type);

  return {
    type,
    provider_message_id: providerMessageId || message?.id || null,
    media_id: payload?.id || null,
    mime_type: payload?.mime_type || null,
    caption: payload?.caption || null,
    filename: payload?.filename || null,
    sha256: payload?.sha256 || null,
    file_size: payload?.file_size || null,
    voice: payload?.voice ?? null,
    animated: payload?.animated ?? null,
    reaction: message?.reaction || null,
    location: message?.location || null,
    contacts: message?.contacts || null,
    interactive: message?.interactive || null,
    button: message?.button || null,
    order: message?.order || null,
    source: 'b49_exact_destructuring_r3h_g',
  };
}

function aaR24fR3hgIsInboundCandidate(candidate) {
  const direction = aaR24fR3hgSafeString(candidate?.direction, 40).toLowerCase();
  const senderType = aaR24fR3hgSafeString(candidate?.sender_type || candidate?.senderType, 40).toLowerCase();
  return direction === 'inbound' || senderType === 'customer';
}

function aaR24fR3hgPreserveLocalCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
  if (!aaR24fR3hgIsInboundCandidate(candidate)) return candidate;

  const inferredType = aaR24fR3hgNormalizeType(candidate.raw || candidate.message || null, candidate.content || candidate.body || '');

  return {
    ...candidate,
    message_type: candidate.message_type || candidate.messageType || inferredType || null,
    raw: candidate.raw || null,
    meta: candidate.meta || {
      type: inferredType || null,
      provider_message_id: candidate.provider_message_id || candidate.providerMessageId || null,
      source: 'local_insertMessageWithFallback',
    },
  };
}


/* __AUTOATENDE_C16N_C16F_PHASE1_OPERATIONAL_AUTHORITY_NORMALIZATION__ */
for (const __aaExportName of ['persistOutboundBotMessage', 'processInboundWebhook', 'listConversations', 'listMessages', 'sendManualMessage', 'assignConversation', 'changeConversationMode', 'sendTextMessageAndPersist']) {
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


/* __AUTOATENDE_V4_R16G_D2_PREVENT_BRAZIL_PHONE_ALIAS_RECURRENCE__ */
const __aaR16gD2SupabaseClient = supabase;

function __aaR16gD2Digits(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function __aaR16gD2BrazilAliasForms(value) {
  const digits = __aaR16gD2Digits(value);
  const forms = new Set();

  if (digits) forms.add(digits);

  if (digits.startsWith('55') && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const subscriber = digits.slice(4);

    if (subscriber.length === 8 && subscriber.startsWith('9')) {
      forms.add(`55${ddd}9${subscriber}`);
    }
  }

  if (digits.startsWith('55') && digits.length === 13) {
    const ddd = digits.slice(2, 4);
    const subscriber = digits.slice(4);

    if (subscriber.length === 9 && subscriber.startsWith('9')) {
      forms.add(`55${ddd}${subscriber.slice(1)}`);
    }
  }

  return Array.from(forms).filter(Boolean);
}

function __aaR16gD2PreferredContactFromConversation(row, fallback) {
  return String(
    row?.contact_number ||
    row?.contact_phone ||
    fallback ||
    ''
  ).replace(/\D/g, '').trim();
}

function __aaR16gD2CloneJson(value) {
  if (!value || typeof value !== 'object') return value;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return value;
  }
}

function __aaR16gD2SetInboundFrom(rawPayload, canonicalContact) {
  if (!rawPayload || typeof rawPayload !== 'object') return rawPayload;

  const cloned = __aaR16gD2CloneJson(rawPayload);

  try {
    const entries = Array.isArray(cloned.entry) ? cloned.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value;

        if (!value || typeof value !== 'object') continue;

        const messages = Array.isArray(value.messages) ? value.messages : [];

        for (const message of messages) {
          if (message && typeof message === 'object' && message.from) {
            message.from = canonicalContact;
          }
        }
      }
    }
  } catch (err) {
    safeLogger.warn('[R16G_D2] inbound payload alias mutation warning:', err?.message || err);
  }

  return cloned;
}

function __aaR16gD2BuildAliasOrExpr(forms) {
  const safeForms = Array.from(new Set(
    (forms || [])
      .map((item) => __aaR16gD2Digits(item))
      .filter(Boolean)
  ));

  if (!safeForms.length) return null;

  return safeForms
    .flatMap((value) => [
      `contact_number.eq.${value}`,
      `contact_phone.eq.${value}`
    ])
    .join(',');
}

async function __aaR16gD2FindConversationByBrazilAlias(companyId, contact) {
  const normalizedCompanyId = String(companyId || '').trim();
  const forms = __aaR16gD2BrazilAliasForms(contact);

  if (!normalizedCompanyId || !forms.length) return null;

  const orExpr = __aaR16gD2BuildAliasOrExpr(forms);

  if (!orExpr) return null;

  const { data, error } = await __aaR16gD2SupabaseClient
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('id, company_id, contact_number, contact_phone, updated_at, created_at, last_message_at, last_inbound_at')
    .eq('company_id', normalizedCompanyId)
    .or(orExpr)
    .limit(5);

  if (error) {
    const err = new Error(`BR_ALIAS_LOOKUP_FAILED: ${error.message || 'unknown error'}`);
    err.code = 'BR_ALIAS_LOOKUP_FAILED';
    err.statusCode = 500;
    err.cause = error;
    throw err;
  }

  const rows = Array.isArray(data) ? data.filter(Boolean) : [];
  const byId = new Map();

  for (const row of rows) {
    if (row?.id) byId.set(String(row.id), row);
  }

  const uniqueRows = Array.from(byId.values());

  if (uniqueRows.length > 1) {
    const err = new Error('BR_ALIAS_AMBIGUOUS_CONVERSATION');
    err.code = 'BR_ALIAS_AMBIGUOUS_CONVERSATION';
    err.statusCode = 409;
    err.details = {
      company_id: normalizedCompanyId,
      contact: __aaR16gD2Digits(contact),
      forms,
      conversation_ids: uniqueRows.map((row) => row.id)
    };
    throw err;
  }

  return uniqueRows[0] || null;
}

async function __aaR16gD2ResolveCanonicalContact(companyId, contact) {
  const original = __aaR16gD2Digits(contact);

  if (!original) return original;

  const row = await __aaR16gD2FindConversationByBrazilAlias(companyId, original);
  const canonical = __aaR16gD2PreferredContactFromConversation(row, original);

  return canonical || original;
}

async function __aaR16gD2ResolveCompanyIdForInbound(rawPayload, normalized) {
  if (normalized?.company_id) return normalized.company_id;

  if (typeof resolveCompanyIdFromPayload === 'function') {
    return resolveCompanyIdFromPayload(rawPayload);
  }

  return null;
}

const __aaR16gD2OriginalProcessInboundWebhook = module.exports.processInboundWebhook;

if (typeof __aaR16gD2OriginalProcessInboundWebhook === 'function') {
  module.exports.processInboundWebhook = async function r16gD2ProcessInboundWebhookWithBrazilAliasGuard(rawPayload) {
    try {
      const normalized = typeof normalizeInboundPayload === 'function'
        ? normalizeInboundPayload(rawPayload)
        : null;

      if (
        normalized &&
        normalized.kind !== 'status' &&
        normalized.from
      ) {
        const companyId = await __aaR16gD2ResolveCompanyIdForInbound(rawPayload, normalized);
        const canonicalContact = await __aaR16gD2ResolveCanonicalContact(companyId, normalized.from);

        if (canonicalContact && canonicalContact !== __aaR16gD2Digits(normalized.from)) {
          safeLogger.log('[R16G_D2] inbound_alias_resolved', safeLogFields({
            company_id: companyId,
            from: canonicalContact,
            status: 'alias_resolved',
          }));

          const aliasedPayload = __aaR16gD2SetInboundFrom(rawPayload, canonicalContact);
          return __aaR16gD2OriginalProcessInboundWebhook(aliasedPayload);
        }
      }
    } catch (err) {
      if (err?.code === 'BR_ALIAS_AMBIGUOUS_CONVERSATION') {
        safeLogger.error('[R16G_D2] inbound_alias_ambiguous', safeErrorFields(err));
        throw err;
      }

      safeLogger.warn('[R16G_D2] inbound_alias_guard_warning:', err?.message || err);
    }

    return __aaR16gD2OriginalProcessInboundWebhook(rawPayload);
  };
}

const __aaR16gD2OriginalPersistOutboundBotMessage = module.exports.persistOutboundBotMessage;

if (typeof __aaR16gD2OriginalPersistOutboundBotMessage === 'function') {
  module.exports.persistOutboundBotMessage = async function r16gD2PersistOutboundBotMessageWithBrazilAliasGuard(args = {}) {
    const nextArgs = { ...args };

    try {
      const companyId = nextArgs.companyId || nextArgs.company_id;
      const to = nextArgs.to || nextArgs.contact || nextArgs.contact_number || nextArgs.contact_phone;
      const canonicalContact = await __aaR16gD2ResolveCanonicalContact(companyId, to);

      if (canonicalContact && to && canonicalContact !== __aaR16gD2Digits(to)) {
        safeLogger.log('[R16G_D2] outbound_persist_alias_resolved', safeLogFields({
          company_id: companyId,
          to: canonicalContact,
          status: 'alias_resolved',
        }));

        nextArgs.to = canonicalContact;
        nextArgs.contact = canonicalContact;
        nextArgs.contact_number = canonicalContact;
        nextArgs.contact_phone = canonicalContact;
      }
    } catch (err) {
      if (err?.code === 'BR_ALIAS_AMBIGUOUS_CONVERSATION') {
        safeLogger.error('[R16G_D2] outbound_persist_alias_ambiguous', safeErrorFields(err));
        throw err;
      }

      safeLogger.warn('[R16G_D2] outbound_persist_alias_guard_warning:', err?.message || err);
    }

    return __aaR16gD2OriginalPersistOutboundBotMessage(nextArgs);
  };
}

const __aaR16gD2OriginalSendTextMessageAndPersist = module.exports.sendTextMessageAndPersist;

if (typeof __aaR16gD2OriginalSendTextMessageAndPersist === 'function') {
  module.exports.sendTextMessageAndPersist = async function r16gD2SendTextMessageAndPersistWithBrazilAliasGuard(args = {}) {
    const nextArgs = { ...args };

    try {
      const companyId = nextArgs.companyId || nextArgs.company_id;
      const to = nextArgs.to || nextArgs.contact || nextArgs.contact_number || nextArgs.contact_phone;

      if (companyId && to) {
        const canonicalContact = await __aaR16gD2ResolveCanonicalContact(companyId, to);

        if (canonicalContact && canonicalContact !== __aaR16gD2Digits(to)) {
          safeLogger.log('[R16G_D2] manual_send_alias_resolved', safeLogFields({
            company_id: companyId,
            to: canonicalContact,
            status: 'alias_resolved',
          }));

          nextArgs.to = canonicalContact;
          nextArgs.contact = canonicalContact;
          nextArgs.contact_number = canonicalContact;
          nextArgs.contact_phone = canonicalContact;
        }
      }
    } catch (err) {
      if (err?.code === 'BR_ALIAS_AMBIGUOUS_CONVERSATION') {
        safeLogger.error('[R16G_D2] manual_send_alias_ambiguous', safeErrorFields(err));
        throw err;
      }

      safeLogger.warn('[R16G_D2] manual_send_alias_guard_warning:', err?.message || err);
    }

    return __aaR16gD2OriginalSendTextMessageAndPersist(nextArgs);
  };
}

module.exports.__aaR16gD2BrazilAliasForms = __aaR16gD2BrazilAliasForms;
module.exports.__aaR16gD2ResolveCanonicalContact = __aaR16gD2ResolveCanonicalContact;
/* END $__AUTOATENDE_V4_R16G_D2_PREVENT_BRAZIL_PHONE_ALIAS_RECURRENCE__ */


/* __AUTOATENDE_V4_R17A_A2_BACKEND_MANUAL_SEND_24H_WINDOW_GUARD__ */
const __aaR17aA2SupabaseClient = (typeof __aaR16gD2SupabaseClient !== 'undefined' ? __aaR16gD2SupabaseClient : supabase);
const __aaR17aA2ManualSendWindowMs = 24 * 60 * 60 * 1000;

function __aaR17aA2NormalizeUuid(value) {
  const str = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
    ? str
    : null;
}

function __aaR17aA2NormalizeCompanyId(value) {
  return __aaR17aA2NormalizeUuid(value);
}

function __aaR17aA2ParseDateMs(value) {
  if (!value) return null;

  const ms = new Date(value).getTime();

  return Number.isFinite(ms) ? ms : null;
}

function __aaR17aA2RoundHours(ms) {
  if (!Number.isFinite(ms)) return null;

  return Math.round((ms / (60 * 60 * 1000)) * 100) / 100;
}

function __aaR17aA2BuildWindowClosedError(windowInfo) {
  const err = new Error('A janela de atendimento de 24h está fechada. Use um template aprovado para retomar a conversa com este cliente.');
  err.name = 'WhatsApp24hWindowClosedError';
  err.code = 'WHATSAPP_24H_WINDOW_CLOSED';
  err.statusCode = 409;
  err.details = {
    code: 'WHATSAPP_24H_WINDOW_CLOSED',
    template_required: true,
    reason: windowInfo?.reason || 'window_closed',
    conversation_id: windowInfo?.conversation_id || null,
    company_id: windowInfo?.company_id || null,
    contact: windowInfo?.contact || null,
    last_inbound_at: windowInfo?.last_inbound_at || null,
    hours_since_last_inbound: windowInfo?.hours_since_last_inbound ?? null,
    window_expires_at: windowInfo?.window_expires_at || null
  };
  return err;
}

async function __aaR17aA2GetManualSendWindow(companyId, conversationId) {
  const normalizedCompanyId = __aaR17aA2NormalizeCompanyId(companyId);
  const normalizedConversationId = __aaR17aA2NormalizeUuid(conversationId);

  if (!normalizedCompanyId) {
    const err = new Error('COMPANY_ID_NOT_RESOLVED');
    err.code = 'COMPANY_ID_NOT_RESOLVED';
    err.statusCode = 400;
    throw err;
  }

  if (!normalizedConversationId) {
    const err = new Error('CONVERSATION_ID_INVALID');
    err.code = 'CONVERSATION_ID_INVALID';
    err.statusCode = 400;
    throw err;
  }

  const { data, error } = await __aaR17aA2SupabaseClient
    .from(INBOX_CONVERSATIONS_TABLE)
    .select('id, company_id, contact_phone, contact_number, contact_name, last_inbound_at, last_message_at, updated_at, created_at')
    .eq('company_id', normalizedCompanyId)
    .eq('id', normalizedConversationId)
    .maybeSingle();

  if (error) {
    const err = new Error(`MANUAL_SEND_WINDOW_LOOKUP_FAILED: ${error.message || 'unknown error'}`);
    err.code = 'MANUAL_SEND_WINDOW_LOOKUP_FAILED';
    err.statusCode = 500;
    err.cause = error;
    throw err;
  }

  if (!data) {
    const err = new Error('CONVERSATION_NOT_FOUND');
    err.code = 'CONVERSATION_NOT_FOUND';
    err.statusCode = 404;
    throw err;
  }

  const lastInboundAt = data.last_inbound_at || null;
  const lastInboundMs = __aaR17aA2ParseDateMs(lastInboundAt);
  const nowMs = Date.now();

  if (!lastInboundMs) {
    return {
      open: false,
      reason: 'missing_last_inbound_at',
      conversation_id: data.id,
      company_id: data.company_id,
      contact: data.contact_number || data.contact_phone || null,
      last_inbound_at: lastInboundAt,
      hours_since_last_inbound: null,
      window_expires_at: null
    };
  }

  const ageMs = nowMs - lastInboundMs;
  const expiresMs = lastInboundMs + __aaR17aA2ManualSendWindowMs;
  const open = ageMs >= 0 && ageMs <= __aaR17aA2ManualSendWindowMs;

  return {
    open,
    reason: open ? 'window_open' : 'window_closed',
    conversation_id: data.id,
    company_id: data.company_id,
    contact: data.contact_number || data.contact_phone || null,
    last_inbound_at: lastInboundAt,
    hours_since_last_inbound: __aaR17aA2RoundHours(ageMs),
    window_expires_at: new Date(expiresMs).toISOString()
  };
}

function __aaR17aA2ShouldGuardManualSend(args = {}) {
  const senderType = String(args.senderType || args.sender_type || '').toLowerCase();
  const metadata = args.metadata && typeof args.metadata === 'object' ? args.metadata : {};
  const source = String(metadata.source || '').toLowerCase();

  if (senderType && senderType !== 'human') return false;
  if (source && source !== 'inbox_manual_send') return false;

  return Boolean(args.conversationId || args.conversation_id);
}

async function __aaR17aA2AssertManualSendWindowOpen(args = {}) {
  if (!__aaR17aA2ShouldGuardManualSend(args)) {
    return {
      skipped: true,
      reason: 'not_manual_send'
    };
  }

  const companyId = args.companyId || args.company_id;
  const conversationId = args.conversationId || args.conversation_id;
  const windowInfo = await __aaR17aA2GetManualSendWindow(companyId, conversationId);

  if (!windowInfo.open) {
    safeLogger.warn('[R17A_A2] manual_send_24h_window_closed', safeLogFields({
      company_id: windowInfo.company_id,
      contact: windowInfo.contact,
      reason: windowInfo.reason,
      status: 'template_required',
    }));

    throw __aaR17aA2BuildWindowClosedError(windowInfo);
  }

  return windowInfo;
}

const __aaR17aA2OriginalSendTextMessageAndPersist = module.exports.sendTextMessageAndPersist;

if (typeof __aaR17aA2OriginalSendTextMessageAndPersist === 'function') {
  module.exports.sendTextMessageAndPersist = async function r17aA2SendTextMessageAndPersistWithManual24hGuard(args = {}) {
    await __aaR17aA2AssertManualSendWindowOpen(args);

    return __aaR17aA2OriginalSendTextMessageAndPersist(args);
  };
}

module.exports.__aaR17aA2GetManualSendWindow = __aaR17aA2GetManualSendWindow;
module.exports.__aaR17aA2AssertManualSendWindowOpen = __aaR17aA2AssertManualSendWindowOpen;
module.exports.__aaR17aA2BuildWindowClosedError = __aaR17aA2BuildWindowClosedError;
/* END __AUTOATENDE_V4_R17A_A2_BACKEND_MANUAL_SEND_24H_WINDOW_GUARD__ */

