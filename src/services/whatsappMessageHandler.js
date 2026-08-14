// __AUTOATENDE_V4_R24B_D_R3_FIX_BOT_OUTBOUND_PERSISTENCE_AFTER_RICH_CONTRACT__
const fs = require("fs");
const supabase = require("../config/supabase");
const {
  safeErrorFields,
  safeLogFields,
  sanitizeTechnicalMessage,
} = require('../security/telemetrySanitizer');
const { handleInboundMessage } = require("./conversationWindow.service");
const { getCompany, getActivePlan } = require("./company.service");
const attendanceService = require("./attendance.service");
const audioService = require("./audio.service");
const aiService = require("./ai.service");
const whatsappService = require("./whatsapp.service");
const onboardingService = require("./onboarding.service");
const safeLogger = require("../security/safeLogger");
const logger = Object.freeze({
  info: (message, fields) => safeLogger.info(message, safeLogFields(fields)),
  warn: (message, fields) => safeLogger.warn(message, safeLogFields(fields)),
  error: (message, fields) => safeLogger.error(message, safeLogFields(fields)),
});

const assistantCentralAuthorityService = require('./assistantCentral.service');
const assistantCentralPreviewAuthorityService = require('./assistantCentralPreview.service');


// __AUTOATENDE_BOT_QUALITY_UNSUPPORTED_FIX_V1_BACKEND__
function aaBotQualitySafeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || String(fallback || "").trim();
}

function aaBotQualityPickFirst(...values) {
  for (const value of values) {
    const text = aaBotQualitySafeText(value);
    if (text && text !== '[unsupported]') return text;
  }
  return "";
}

function aaR31InboxSafeDisplayContent(message = {}, fallbackContent = "Mensagem recebida") {
  const type = aaBotQualitySafeText(message?.type || message?.message_type || message?.content_type || "").toLowerCase();
  const fallback = aaBotQualitySafeText(fallbackContent, "Mensagem recebida");

  if (type === "text") {
    return aaBotQualityPickFirst(message?.text?.body, message?.body, message?.content, fallback);
  }

  if (type === "button") {
    return aaBotQualityPickFirst(
      message?.button?.text,
      message?.button?.payload,
      "Resposta de botão recebida"
    );
  }

  if (type === "interactive") {
    return aaBotQualityPickFirst(
      message?.interactive?.button_reply?.title,
      message?.interactive?.button_reply?.id,
      message?.interactive?.list_reply?.title,
      message?.interactive?.list_reply?.description,
      message?.interactive?.list_reply?.id,
      "Resposta interativa recebida"
    );
  }

  if (type === "image") {
    return aaBotQualityPickFirst(message?.image?.caption, "Imagem recebida");
  }

  if (type === "audio") {
    return aaBotQualityPickFirst(message?.audio?.caption, fallback !== '[unsupported]' ? fallback : "", "Áudio recebido");
  }

  if (type === "video") {
    return aaBotQualityPickFirst(message?.video?.caption, "Vídeo recebido");
  }

  if (type === "document") {
    return aaBotQualityPickFirst(
      message?.document?.caption,
      message?.document?.filename,
      "Documento recebido"
    );
  }

  if (type === "sticker") {
    return "Figurinha recebida";
  }

  if (type === "reaction") {
    return aaBotQualityPickFirst(
      message?.reaction?.emoji ? `Reação recebida: ${message.reaction.emoji}` : "",
      "Reação recebida"
    );
  }

  if (type === "location") {
    return aaBotQualityPickFirst(
      message?.location?.name,
      message?.location?.address,
      "Localização recebida"
    );
  }

  if (type === "contacts") {
    const first = Array.isArray(message?.contacts) ? message.contacts[0] : null;
    return aaBotQualityPickFirst(
      first?.name?.formatted_name,
      first?.name?.first_name,
      "Contato recebido"
    );
  }

  if (type) {
    return `Mensagem recebida (${type})`;
  }

  return fallback && fallback !== '[unsupported]' ? fallback : "Mensagem recebida";
}

// __AUTOATENDE_V4_R24B_B_BACKEND_RICH_INBOUND_MESSAGE_CONTRACT__
function aaR24bSafeString(value, limit = 2000) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, limit);
}

function aaR24bNormalizeInboundType(message) {
  return aaR24bSafeString(message?.type || 'unknown', 64).toLowerCase() || 'unknown';
}

function aaR24bGetTypedPayload(message, type) {
  const payload = message?.[type];
  return payload && typeof payload === 'object' ? payload : null;
}

function aaR24bNormalizeInboundContent(message, fallbackContent) {
  const type = aaR24bNormalizeInboundType(message);

  if (type === 'text') {
    return aaR24bSafeString(message?.text?.body || fallbackContent || '');
  }

  if (type === 'image') {
    return aaR24bSafeString(message?.image?.caption || 'Imagem recebida');
  }

  if (type === 'audio') {
    return aaR24bSafeString(fallbackContent && fallbackContent !== '[unsupported]' ? fallbackContent : 'Áudio recebido');
  }

  if (type === 'document') {
    return aaR24bSafeString(message?.document?.caption || message?.document?.filename || 'Documento recebido');
  }

  if (type === 'video') {
    return aaR24bSafeString(message?.video?.caption || 'Vídeo recebido');
  }

  if (type === 'sticker') {
    return 'Sticker recebido';
  }

  if (type === 'reaction') {
    return aaR24bSafeString(`Reação: ${message?.reaction?.emoji || ''}`.trim() || 'Reação recebida');
  }

  if (type === 'location') {
    return aaR24bSafeString(message?.location?.name || message?.location?.address || 'Localização recebida');
  }

  if (type === 'contacts') {
    const first = Array.isArray(message?.contacts) ? message.contacts[0] : null;
    return aaR24bSafeString(first?.name?.formatted_name || 'Contato recebido');
  }

  if (type === 'interactive') {
    return aaR24bSafeString(
      message?.interactive?.button_reply?.title ||
      message?.interactive?.list_reply?.title ||
      'Interação recebida'
    );
  }

  if (type === 'button') {
    return aaR24bSafeString(message?.button?.text || 'Botão recebido');
  }

  if (type === 'order') {
    return 'Pedido recebido';
  }

  return aaR24bSafeString(fallbackContent && fallbackContent !== '[unsupported]' ? fallbackContent : 'Mensagem recebida');
}

function aaR24bBuildInboundMessageContract(message, fallbackContent) {
  const type = aaR24bNormalizeInboundType(message);
  const payload = aaR24bGetTypedPayload(message, type);
  const content = aaR24bNormalizeInboundContent(message, fallbackContent);

  return {
    message_type: type,
    content,
    raw: message && typeof message === 'object' ? message : null,
    meta: {
      type,
      provider_message_id: message?.id || null,
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
    },
  };
}

function aaR24bMergeInboundMessageInsert(insertPayload, contract) {
  const normalizedContract = contract || {};

  const mergeRow = (row) => {
    const base = row && typeof row === 'object' ? row : {};

    return {
      ...base,
      content: normalizedContract.content || base.content || '',
      message_type: normalizedContract.message_type || base.message_type || 'unknown',
      raw: normalizedContract.raw || base.raw || null,
      meta: {
        ...(base.meta && typeof base.meta === 'object' ? base.meta : {}),
        ...(normalizedContract.meta && typeof normalizedContract.meta === 'object' ? normalizedContract.meta : {}),
      },
    };
  };

  return Array.isArray(insertPayload)
    ? insertPayload.map(mergeRow)
    : mergeRow(insertPayload);
}


// Rate Limiter (In-Memory)
const rateLimiter = new Map();

function checkRateLimit(key, type) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limits = { text: 20, audio: 5 };

  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { start: now, text: 0, audio: 0 });
  }

  const usage = rateLimiter.get(key);

  if (now - usage.start > windowMs) {
    usage.start = now;
    usage.text = 0;
    usage.audio = 0;
  }

  usage[type]++;
  return usage[type] <= limits[type];
}

function normalizeUserText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* __AUTOATENDE_B641_RECENT_HISTORY_AI_CONTEXT__ */
function normalizeContactForHistory(value) {
  return String(value || "").replace(/\D/g, "").trim();
}

function normalizeHistoryContent(row) {
/* __AUTOATENDE_B642_SANITIZE_AI_HISTORY__ */
function b642LegacyShouldIgnoreHistoryRow(row) {
  const content = normalizeHistoryContent(row);
  if (!content) return true;

  const senderType = String(row?.sender_type || "").toLowerCase().trim();

  if (senderType === "system") {
    return true;
  }

  const syntheticPatterns = [
    /^\[b\d+/i,
    /sem dispatch externo/i,
    /smoke local[_ -]?only/i,
    /teste local[_ -]?only/i,
    /runtime validation/i,
    /b60 smoke/i
  ];

  if (syntheticPatterns.some((pattern) => pattern.test(content))) {
    return true;
  }

  return false;
}

  return normalizeUserText(
    row?.content ||
    row?.body ||
    row?.message ||
    ""
  );
}

function mapInboxMessageToAiMessage(row) {
  const content = normalizeHistoryContent(row);
  if (!content) return null;

  const direction = String(row?.direction || "").toLowerCase();
  const role = direction === "outbound" ? "assistant" : "user";

  return { role, content };
}

async function resolveConversationIdForHistory(companyId, contact) {
  const normalizedContact = normalizeContactForHistory(contact);

  if (!companyId || !normalizedContact) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("inbox_conversations")
      .select("id, updated_at, contact_number, contact_phone")
      .eq("company_id", companyId)
      .or(`contact_number.eq.${normalizedContact},contact_phone.eq.${normalizedContact}`)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    return Array.isArray(data) && data[0]?.id ? data[0].id : null;
  } catch (error) {
    logger.warn("[B641] resolveConversationIdForHistory failed", {
      ...safeLogFields({ company_id: companyId, contact: normalizedContact }),
      ...safeErrorFields(error),
    });
    return null;
  }
}

async function fetchRecentConversationHistoryMessages(companyId, contact, limit = 8) {
  const conversationId = await resolveConversationIdForHistory(companyId, contact);

  if (!conversationId) {
    return [];
  }

  try {
    const fetchLimit = Math.max(4, Math.min(Number(limit) || 8, 12));

    const { data, error } = await supabase
      .from("inbox_messages")
      .select("id, conversation_id, direction, sender_type, content, created_at")
      .eq("company_id", companyId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (error) throw error;

    const mapped = (Array.isArray(data) ? data : [])
      .filter((row) => !aaGlobalShouldIgnoreHistoryRow(row))
      .slice()
      .reverse()
      .map(mapInboxMessageToAiMessage)
      .filter(Boolean);

    return mapped.slice(-8);
  } catch (error) {
    logger.warn("[B641] fetchRecentConversationHistoryMessages failed", {
      ...safeLogFields({ company_id: companyId, contact }),
      ...safeErrorFields(error),
    });
    return [];
  }
}

async function buildAiMessagesFromRecentHistory({ companyId, contact, fallbackUserText }) {
  const historyMessages = await fetchRecentConversationHistoryMessages(companyId, contact, 8);
  const fallbackText = normalizeUserText(fallbackUserText);

  if (!historyMessages.length) {
    return fallbackText ? [{ role: "user", content: fallbackText }] : [];
  }

  const lastMessage = historyMessages[historyMessages.length - 1];

  if (
    fallbackText &&
    (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.content !== fallbackText
    )
  ) {
    return [
      ...historyMessages.slice(-7),
      { role: "user", content: fallbackText }
    ];
  }

  return historyMessages.slice(-8);
}

/* __AUTOATENDE_B643_HISTORY_SANITIZER_SCOPE_FIX__ */
function aaGlobalShouldIgnoreHistoryRow(row) {
  const content = String(
    row?.content ||
    row?.body ||
    row?.message ||
    ''
  ).replace(/\r/g, '').trim();

  if (!content) return true;

  const senderType = String(row?.sender_type || '').toLowerCase().trim();
  if (senderType === 'system') return true;

  const syntheticPatterns = [
    /^\[b\d+/i,
    /sem dispatch externo/i,
    /smoke local[_ -]?only/i,
    /teste local[_ -]?only/i,
    /runtime validation/i,
    /b60 smoke/i
  ];

  return syntheticPatterns.some((pattern) => pattern.test(content));
}

async function safeSendMessage(companyId, to, text) {
  try {
    const body = normalizeUserText(text);
    if (!body) return null;
    return await whatsappService.sendMessage(companyId, to, body);
  } catch (error) {
    logger.error("[WhatsApp Handler] Failed to send fallback/system message", {
      ...safeErrorFields(error),
      status: error?.status || error?.response?.status || null
    });
    return null;
  }
}

async function upsertConversationOutbound(companyId, to, nowIso) {
  const payload = {
    company_id: companyId,
    contact_number: String(to),
    status: "open",
    last_message_at: nowIso,
    updated_at: nowIso
  };

  const { data: upserted, error: upsertErr } = await supabase
    .from("inbox_conversations")
    .upsert(payload, { onConflict: "company_id,contact_number" })
    .select("*")
    .maybeSingle();

  if (!upsertErr && upserted) return upserted;

  const { data: existing } = await supabase
    .from("inbox_conversations")
    .select("*")
    .eq("company_id", companyId)
    .eq("contact_number", String(to))
    .maybeSingle();

  if (existing?.id) {
    const { data: updated, error: updateErr } = await supabase
      .from("inbox_conversations")
      .update({
        status: "open",
        last_message_at: nowIso,
        updated_at: nowIso
      })
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();

    if (updateErr) throw updateErr;
    return updated || existing;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("inbox_conversations")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (insertErr) throw insertErr;
  return inserted;
}

async function persistOutboundBotMessageDirect({ companyId, to, content, providerMessageId, rawMeta }) {
  const nowIso = new Date().toISOString();
  const body = normalizeUserText(content);
  if (!body) return null;

  const conversation = await upsertConversationOutbound(companyId, to, nowIso);

  if (providerMessageId) {
    try {
      const { data: existingByProvider } = await supabase
        .from("inbox_messages")
        .select("id, conversation_id")
        .eq("company_id", companyId)
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();

      if (existingByProvider?.id) {
        logger.info("[Outbound Persist Direct] duplicate ignored", {
          company_id: companyId,
          to,
          provider_message_id: providerMessageId,
          conversation_id: existingByProvider.conversation_id,
          message_id: existingByProvider.id
        });
        return existingByProvider;
      }
    } catch (_) {}
  }

  const candidates = [
    {
      company_id: companyId,
      conversation_id: conversation.id,
      direction: "outbound",
      sender_type: "bot",
      message_type: "text",
      content: body,
      to_number: String(to),
      provider_message_id: providerMessageId || null,
      metadata: { source: "bot_auto_reply", meta: rawMeta || null },
      status: "sent",
      created_at: nowIso
    },
    {
      company_id: companyId,
      conversation_id: conversation.id,
      direction: "outbound",
      sender_type: "bot",
      content: body,
      provider_message_id: providerMessageId || null,
      created_at: nowIso
    },
    {
      conversation_id: conversation.id,
      direction: "outbound",
      sender_type: "bot",
      content: body,
      provider_message_id: providerMessageId || null,
      created_at: nowIso
    },
    {
      conversation_id: conversation.id,
      content: body,
      from_me: true,
      created_at: nowIso
    }
  ];

  let lastError = null;

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from("inbox_messages")
      .insert(candidate)
      .select("id, conversation_id")
      .maybeSingle();

    if (!error) {
      logger.info("[Outbound Persist Direct] saved", {
        company_id: companyId,
        to,
        provider_message_id: providerMessageId || null,
        conversation_id: data?.conversation_id || conversation.id,
        message_id: data?.id || null
      });
      return data || null;
    }

    lastError = error;
  }

  throw lastError || new Error("Failed to persist outbound bot message");
}

function buildOperationalSystemPrompt(basePrompt) {
  return `
${basePrompt || "Você é um assistente virtual útil."}

REGRAS OPERACIONAIS DO CANAL WHATSAPP:
1. Responda sempre em português do Brasil.
2. Seja objetivo, claro e útil.
3. Não invente preço, prazo, política ou funcionalidade.
4. Quando faltar contexto, faça uma pergunta curta para avançar.
5. Se o cliente pedir humano, explique que pode solicitar atendimento humano.
6. Nunca diga que executou algo que você não executou.
7. Prefira respostas curtas, com no máximo alguns parágrafos.
8. Em caso de dúvida relevante, admita a limitação.
  `.trim();
}


/* __AUTOATENDE_LIVE_PUBLISHED_HANDOFF_TRIGGER_EXECUTION_V20_E1_B9_R1__ */

function aaNormalizePublishedHandoffText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aaNormalizePublishedHandoffTriggers(value) {
  const rawItems = Array.isArray(value) ? value : [];
  const normalized = [];

  for (const item of rawItems.slice(0, 100)) {
    const trigger = aaNormalizePublishedHandoffText(item);

    if (trigger.length < 4 || trigger.length > 160) {
      continue;
    }

    if (!normalized.includes(trigger)) {
      normalized.push(trigger);
    }
  }

  return normalized;
}

function aaMatchPublishedHandoffTrigger(userText, triggers) {
  const normalizedMessage =
    aaNormalizePublishedHandoffText(userText);

  if (!normalizedMessage) {
    return null;
  }

  const normalizedTriggers =
    aaNormalizePublishedHandoffTriggers(triggers);

  const paddedMessage = ` ${normalizedMessage} `;

  for (
    let triggerIndex = 0;
    triggerIndex < normalizedTriggers.length;
    triggerIndex += 1
  ) {
    const trigger = normalizedTriggers[triggerIndex];

    if (
      normalizedMessage === trigger ||
      paddedMessage.includes(` ${trigger} `)
    ) {
      return {
        matched: true,
        triggerIndex,
        normalizedTriggerLength: trigger.length,
      };
    }
  }

  return null;
}

async function aaLoadPublishedHandoffTriggers(companyId) {
  if (
    !companyId ||
    !assistantCentralAuthorityService ||
    typeof assistantCentralAuthorityService.getCompanyState !== 'function' ||
    typeof assistantCentralAuthorityService.normalizeProfile !== 'function'
  ) {
    return [];
  }

  try {
    const state =
      await assistantCentralAuthorityService.getCompanyState(companyId);

    const published =
      assistantCentralAuthorityService.normalizeProfile(
        (state && state.published) || {},
      );

    return aaNormalizePublishedHandoffTriggers(
      published?.handoffTriggers ||
      published?.handoff_triggers ||
      [],
    );
  } catch (error) {
    logger.warn(
      '[LIVE_HANDOFF_TRIGGER] published_config_read_failed',
      {
        company_id: companyId,
        error_code:
          error?.code ||
          error?.name ||
          'PUBLISHED_CONFIG_READ_FAILED',
      },
    );

    return [];
  }
}

function aaBuildAutomaticHandoffAcknowledgement() {
  return (
    'Claro. Sua solicitação foi direcionada para a equipe de ' +
    'atendimento. Para agilizar, envie brevemente o assunto que ' +
    'deseja tratar.'
  );
}

async function aaTryAutomaticPublishedHandoff({
  companyId,
  contact,
  userText,
}) {
  const triggers =
    await aaLoadPublishedHandoffTriggers(companyId);

  const match =
    aaMatchPublishedHandoffTrigger(userText, triggers);

  if (!match) {
    return {
      matched: false,
      triggerCount: triggers.length,
    };
  }

  try {
    const attendanceResult =
      await attendanceService.transferToHuman(
        companyId,
        contact,
        null,
      );

    const acknowledgement =
      aaBuildAutomaticHandoffAcknowledgement();

    let sendResult = null;
    let acknowledgementSent = false;
    let acknowledgementPersisted = false;

    try {
      sendResult =
        await safeSendMessage(
          companyId,
          contact,
          acknowledgement,
        );

      acknowledgementSent = Boolean(sendResult);

      if (sendResult) {
        try {
          await persistOutboundBotMessageDirect({
            companyId,
            to: contact,
            content: acknowledgement,
            providerMessageId:
              sendResult?.provider_message_id ||
              null,
            rawMeta: {
              source: 'automatic_published_handoff_ack',
              trigger_index: match.triggerIndex,
              provider: sendResult?.raw || null,
            },
          });

          acknowledgementPersisted = true;
        } catch (persistError) {
          logger.warn(
            '[LIVE_HANDOFF_TRIGGER] acknowledgement_persist_failed',
            {
              company_id: companyId,
              trigger_index: match.triggerIndex,
              error_code:
                persistError?.code ||
                persistError?.name ||
                'ACK_PERSIST_FAILED',
            },
          );
        }
      }
    } catch (sendError) {
      logger.warn(
        '[LIVE_HANDOFF_TRIGGER] acknowledgement_send_failed',
        {
          company_id: companyId,
          trigger_index: match.triggerIndex,
          error_code:
            sendError?.code ||
            sendError?.name ||
            'ACK_SEND_FAILED',
        },
      );
    }

    logger.info(
      '[LIVE_HANDOFF_TRIGGER] transfer_completed',
      {
        company_id: companyId,
        contact_suffix:
          String(contact || '').replace(/\D/g, '').slice(-4) ||
          null,
        trigger_index: match.triggerIndex,
        trigger_length: match.normalizedTriggerLength,
        mode: attendanceResult?.mode || 'human',
        acknowledgement_sent: acknowledgementSent,
        acknowledgement_persisted: acknowledgementPersisted,
      },
    );

    return {
      matched: true,
      transferred: true,
      triggerCount: triggers.length,
      triggerIndex: match.triggerIndex,
      acknowledgementSent,
      acknowledgementPersisted,
      attendanceResult,
    };
  } catch (transferError) {
    logger.error(
      '[LIVE_HANDOFF_TRIGGER] transfer_failed',
      {
        company_id: companyId,
        contact_suffix:
          String(contact || '').replace(/\D/g, '').slice(-4) ||
          null,
        trigger_index: match.triggerIndex,
        error_code:
          transferError?.code ||
          transferError?.name ||
          'TRANSFER_TO_HUMAN_FAILED',
      },
    );

    let failureNoticeSent = false;

    try {
      const failureNotice =
        'Não consegui direcionar sua conversa agora. ' +
        'Tente novamente em instantes ou envie o assunto ' +
        'que deseja tratar.';

      const failureSendResult =
        await safeSendMessage(
          companyId,
          contact,
          failureNotice,
        );

      failureNoticeSent = Boolean(failureSendResult);
    } catch (_) {}

    return {
      matched: true,
      transferred: false,
      transferFailed: true,
      failureNoticeSent,
      triggerCount: triggers.length,
      triggerIndex: match.triggerIndex,
    };
  }
}

async function handleIncomingWhatsAppMessage(payload) {
  const { company_id, from, message } = payload || {};

  if (!company_id || !from || !message?.type) {
    return {
      blocked: true,
      reason: "INVALID_PAYLOAD"
    };
  }

  try {
    const company = await getCompany(company_id);
    if (!company) {
      return {
        blocked: true,
        reason: "COMPANY_NOT_FOUND"
      };
    }

    const planData = await getActivePlan(company.client_id);
    if (!planData) {
      return {
        blocked: true,
        reason: "NO_ACTIVE_SUBSCRIPTION"
      };
    }

    const window = await handleInboundMessage(company_id, from);

    /* __AUTOATENDE_ASSISTANT_ACTIVATION_RUNTIME_CONTRACT_V20_B2_R4__ */
    const globalAssistantAuthorityEnabled =
      typeof process.env
        .ASSISTANT_CENTRAL_AUTHORITY_ENABLED ===
      'undefined'
        ? true
        : ![
            'false',
            '0',
            'off',
            'no'
          ].includes(
            String(
              process.env
                .ASSISTANT_CENTRAL_AUTHORITY_ENABLED
            )
              .trim()
              .toLowerCase()
          );

    if (!globalAssistantAuthorityEnabled) {
      logger.info(
        '[Bot Skipped] Global assistant authority disabled',
        {
          company_id,
          contact: from
        }
      );

      return {
        success: true,
        conversationOpened:
          window?.opened || false,
        botSkipped: true,
        reason:
          'ASSISTANT_AUTHORITY_DISABLED'
      };
    }

    let assistantCentralState = null;

    try {
      assistantCentralState =
        assistantCentralAuthorityService
          .getCompanyState(company_id);
    } catch (activationError) {
      logger.error(
        '[Bot Skipped] Assistant activation state unavailable',
        {
          company_id,
          contact: from,
          message:
            activationError?.message ||
            String(activationError)
        }
      );

      return {
        blocked: true,
        conversationOpened:
          window?.opened || false,
        botSkipped: true,
        reason:
          'ASSISTANT_STATE_UNAVAILABLE'
      };
    }

    if (
      !assistantCentralState?.assistantEnabled
    ) {
      logger.info(
        '[Bot Skipped] Assistant disabled for company',
        {
          company_id,
          contact: from
        }
      );

      return {
        success: true,
        conversationOpened:
          window?.opened || false,
        botSkipped: true,
        reason: 'ASSISTANT_DISABLED'
      };
    }

    const state = await attendanceService.getConversationState(company_id, from);
    if (state?.mode === "human") {
      logger.info('[Bot Skipped] Conversation in human mode', safeLogFields({
        company_id,
        from,
        status: 'human_mode',
      }));
      return {
        success: true,
        conversationOpened: window?.opened || false,
        botSkipped: true,
        assignedAgent: state?.assigned_agent_id || null
      };
    }

    let userText = "";
    const rateLimitKey = `${company_id}:${from}`;

    if (message.type === "text") {
      if (!checkRateLimit(rateLimitKey, "text")) {
        logger.warn('[Rate Limit] Text limit exceeded', safeLogFields({
          company_id,
          from,
          type: 'text',
        }));
        await safeSendMessage(
          company_id,
          from,
          "⏳ Você enviou muitas mensagens em pouco tempo. Aguarde um instante e tente novamente."
        );
        return { blocked: true, reason: "RATE_LIMIT_EXCEEDED" };
      }

      userText = normalizeUserText(message?.text?.body || "");
      if (!userText) {
        return { success: true, ignored: true, reason: "EMPTY_TEXT" };
      }
    } else if (message.type === "audio") {
      if (!checkRateLimit(rateLimitKey, "audio")) {
        logger.warn('[Rate Limit] Audio limit exceeded', safeLogFields({
          company_id,
          from,
          type: 'audio',
        }));
        await safeSendMessage(company_id, from, "⏳ Você está enviando muitos áudios. Aguarde um pouco.");
        return { blocked: true, reason: "RATE_LIMIT_EXCEEDED" };
      }

      const MAX_SIZE = 5 * 1024 * 1024;
      if (message?.audio?.file_size && Number(message.audio.file_size) > MAX_SIZE) {
        logger.warn(`[Audio] File too large: ${message.audio.file_size}`);
        await safeSendMessage(company_id, from, "⚠️ Áudio muito grande. Tente enviar um menor, com no máximo 5MB.");
        return { blocked: true, reason: "AUDIO_TOO_LARGE" };
      }

      let filePath = null;

      try {
        logger.info('[Audio] Processing audio message', safeLogFields({
          company_id,
          from,
          status: 'processing',
        }));
        filePath = await audioService.downloadMedia(message.audio.id, company.client_id);

        const stats = fs.statSync(filePath);
        if (stats.size > MAX_SIZE) {
          fs.unlinkSync(filePath);
          throw new Error("Downloaded file too large");
        }

        userText = normalizeUserText(await aiService.transcribeAudio(filePath));

        if (!userText) {
          await safeSendMessage(company_id, from, "😕 Não consegui entender o áudio. Pode me escrever?");
          return { blocked: true, reason: "EMPTY_TRANSCRIPTION" };
        }

        logger.info('[Audio] Transcribed successfully', safeLogFields({
          company_id,
          from,
          status: 'transcribed',
        }));
      } catch (err) {
        logger.error("[Audio] Failed to process", {
          ...safeErrorFields(err)
        });
        await safeSendMessage(company_id, from, "😕 Não consegui ouvir seu áudio. Pode escrever?");
        return { success: false, error: "AUDIO_PROCESS_FAILED" };
      } finally {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) logger.warn("[Audio] Failed to delete temp file", safeErrorFields(err));
          });
        }
      }
    } else {
      return {
        success: true,
        ignored: true,
        reason: "UNSUPPORTED_MESSAGE_TYPE"
      };
    }


    const automaticHandoff =
      await aaTryAutomaticPublishedHandoff({
        companyId: company_id,
        contact: from,
        userText,
      });

    if (automaticHandoff?.matched) {
      if (automaticHandoff?.transferred) {
        return {
          success: true,
          humanHandoff: true,
          botSkipped: true,
          reason: 'PUBLISHED_HANDOFF_TRIGGER',
          acknowledgementSent: Boolean(
            automaticHandoff.acknowledgementSent,
          ),
          acknowledgementPersisted: Boolean(
            automaticHandoff.acknowledgementPersisted,
          ),
        };
      }

      return {
        success: false,
        humanHandoff: false,
        botSkipped: true,
        reason: 'PUBLISHED_HANDOFF_TRANSFER_FAILED',
        failureNoticeSent: Boolean(
          automaticHandoff.failureNoticeSent,
        ),
      };
    }

    const isOnboarding = await onboardingService.isOnboardingActive(company_id, from);

    if (userText.toLowerCase() === "#setup" || isOnboarding) {
      const nextStep = await onboardingService.processOnboardingStep(company_id, from, userText);
      if (nextStep?.message) {
        await safeSendMessage(company_id, from, nextStep.message);
      }
      return { success: true, onboarding: true };
    }

    const onboardingData = await onboardingService.getOnboardingData(company_id);
    const 
// B69 extra style guidance wired separately
systemPrompt = buildOperationalSystemPrompt(
      await __buildCentralAwareSystemPromptForCompany(typeof companyId !== 'undefined' ? companyId : (typeof company !== 'undefined' ? company?.id : null), onboardingData)
    );

    const messages = await buildAiMessagesFromRecentHistory({
        companyId: company_id,
        contact: from,
        fallbackUserText: userText
      });

      logger.info('[B641] ai_context_messages', safeLogFields({
        company_id,
        from,
        count: Array.isArray(messages) ? messages.length : 0,
      }));


    let aiResponse = "";
    try {
      aiResponse = await aiService.generateResponse(messages, systemPrompt);
    } catch (error) {
      logger.error("[WhatsApp Handler] AI response generation failed", {
        ...safeLogFields({ company_id, from }),
        ...safeErrorFields(error),
      });

      await safeSendMessage(
        company_id,
        from,
        "No momento estou com instabilidade para responder automaticamente. Tente novamente em instantes ou solicite atendimento humano."
      );

      return {
        success: false,
        error: "AI_RESPONSE_FAILED"
      };
    }

    const sendResult = await whatsappService.sendMessage(company_id, from, aiResponse);

    logger.info('[OUTBOUND_TRACE] send_ok', safeLogFields({
      company_id,
      to: from,
      status: 'sent',
    }));

    try {
      const persistResult = await persistOutboundBotMessageDirect({
        companyId: company_id,
        to: from,
        content: aiResponse,
        providerMessageId: sendResult?.provider_message_id || null,
        rawMeta: sendResult?.raw || null
      });

      logger.info('[OUTBOUND_TRACE] persist_ok', safeLogFields({
        company_id,
        to: from,
        status: persistResult ? 'persisted' : 'unknown',
      }));
    } catch (persistError) {
      logger.error('[OUTBOUND_TRACE] persist_fail', {
        ...safeLogFields({ company_id, to: from }),
        ...safeErrorFields(persistError),
      });
    }

    return {
      success: true,
      conversationOpened: window?.opened || false,
      responseSent: true,
      provider_message_id: sendResult?.provider_message_id || null
    };
  } catch (error) {
    logger.error("[WhatsApp Handler] Critical error", {
      ...safeLogFields({ company_id, from }),
      ...safeErrorFields(error),
    });

    await safeSendMessage(
      company_id,
      from,
      "Tive uma instabilidade momentânea no atendimento automático. Pode tentar novamente em instantes."
    );

    return {
      blocked: true,
      reason: "INTERNAL_ERROR"
    };
  }
}

/* __AUTOATENDE_C16N_C12F_B1_WIRING_STRUCTURED_BEHAVIOR_PREVIEW_RUNTIME__ RUNTIME_BRIDGE */
async function __buildCentralAwareSystemPromptForCompany(maybeCompanyId, onboardingData = null) {
  const safeCompanyId =
    maybeCompanyId ||
    onboardingData?.companyId ||
    onboardingData?.company_id ||
    onboardingData?.client_id ||
    null;

  try {
    if (
      safeCompanyId &&
      assistantCentralAuthorityService &&
      typeof assistantCentralAuthorityService.getCompanyState === 'function' &&
      typeof assistantCentralAuthorityService.normalizeProfile === 'function' &&
      assistantCentralPreviewAuthorityService &&
      typeof assistantCentralPreviewAuthorityService.buildCommercialSnapshotWithStructuredBehavior === 'function' &&
      typeof assistantCentralPreviewAuthorityService.buildSystemPromptWithStructuredBehavior === 'function'
    ) {
      const state = await assistantCentralAuthorityService.getCompanyState(safeCompanyId);
      const published = assistantCentralAuthorityService.normalizeProfile((state && state.published) || {});
      const hasCentralProfile = Boolean(
        published &&
        (
          published.companyName ||
          published.targetAudience ||
          published.companyContext ||
          published.guidance ||
          (Array.isArray(published.services) && published.services.length) ||
          (Array.isArray(published.qualificationFields) && published.qualificationFields.length) ||
          (Array.isArray(published.handoffTriggers) && published.handoffTriggers.length)
        )
      );

      if (hasCentralProfile) {
        const snapshot =
          assistantCentralPreviewAuthorityService.buildCommercialSnapshotWithStructuredBehavior(published);
        const prompt =
          assistantCentralPreviewAuthorityService.buildSystemPromptWithStructuredBehavior(
            snapshot,
            'published',
            ''
          );
        if (prompt) return prompt;
      }
    }
  } catch (err) {
    try {
      logger.warn('[AUTOATENDE C12F-B1] Central-aware prompt bridge fallback', safeErrorFields(err));
    } catch (_) {}
  }

  return onboardingService.buildSystemPrompt(onboardingData || {});
}

module.exports = {
  handleIncomingWhatsAppMessage,
  __fetchRecentConversationHistoryMessages: fetchRecentConversationHistoryMessages,
  __buildAiMessagesFromRecentHistory: buildAiMessagesFromRecentHistory
};

/* __AUTOATENDE_B644_AI_HISTORY_ROLE_SEMANTICS__ */

function aaB644NormalizeHistoryContent(row) {
  return String(
    row?.content ||
    row?.body ||
    row?.message ||
    ''
  )
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function aaB644ShouldIgnoreHistoryRow(row) {
  try {
    if (typeof aaGlobalShouldIgnoreHistoryRow === 'function' && aaGlobalShouldIgnoreHistoryRow(row)) {
      return true;
    }
  } catch (_) {}

  const content = aaB644NormalizeHistoryContent(row);
  if (!content) return true;

  const senderType = String(row?.sender_type || '').toLowerCase().trim();
  if (senderType === 'system') return true;

  return false;
}

function aaB644MapRowToAiMessage(row) {
  if (!row || aaB644ShouldIgnoreHistoryRow(row)) return null;

  const content = aaB644NormalizeHistoryContent(row);
  const direction = String(row?.direction || '').toLowerCase().trim();
  const senderType = String(row?.sender_type || '').toLowerCase().trim();
  const hasProviderId = !!String(row?.provider_message_id || '').trim();

  if (direction === 'inbound' || senderType === 'customer') {
    return { role: 'user', content };
  }

  if (direction === 'outbound' && (senderType === 'bot' || (!senderType && hasProviderId))) {
    return { role: 'assistant', content };
  }

  if (direction === 'outbound' && (senderType === 'human' || senderType === 'agent')) {
    return {
      role: 'system',
      content: `Contexto interno: um atendente humano respondeu anteriormente ao cliente com a seguinte mensagem: "${content}"`
    };
  }

  if (direction === 'outbound') {
    return {
      role: 'system',
      content: `Contexto interno: houve uma resposta anterior da equipe para o cliente: "${content}"`
    };
  }

  return { role: 'user', content };
}

function aaB644CompactAiHistory(messages) {
  const result = [];
  for (const msg of Array.isArray(messages) ? messages : []) {
    if (!msg || !msg.role || !String(msg.content || '').trim()) continue;

    const last = result[result.length - 1];
    if (
      last &&
      last.role === msg.role &&
      String(last.content || '').trim() === String(msg.content || '').trim()
    ) {
      continue;
    }

    result.push({
      role: msg.role,
      content: String(msg.content || '').trim()
    });
  }

  return result;
}

async function fetchRecentConversationHistoryMessages(companyId, contact) {
  const normalizedContact = String(contact || '').trim();
  if (!companyId || !normalizedContact) return [];

  try {
    const { data: convs, error: convErr } = await supabase
      .from('inbox_conversations')
      .select('id, contact_number, contact_phone, updated_at')
      .eq('company_id', companyId)
      .or(`contact_number.eq.${normalizedContact},contact_phone.eq.${normalizedContact}`)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (convErr) throw convErr;

    const conversation = Array.isArray(convs) ? convs[0] : null;
    if (!conversation?.id) return [];

    const { data: rows, error: rowsErr } = await supabase
      .from('inbox_messages')
      .select('id, direction, sender_type, content, body, message, created_at, provider_message_id')
      .eq('company_id', companyId)
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(24);

    if (rowsErr) throw rowsErr;

    const mapped = (Array.isArray(rows) ? rows : [])
      .slice()
      .reverse()
      .map(aaB644MapRowToAiMessage)
      .filter(Boolean);

    return aaB644CompactAiHistory(mapped).slice(-8);
  } catch (err) {
    logger.warn('[B644] fetchRecentConversationHistoryMessages failed', {
      company_id: companyId,
      contact: normalizedContact,
      ...safeErrorFields(err)
    });
    return [];
  }
}

async function buildAiMessagesFromRecentHistory({ companyId, contact, fallbackUserText }) {
  const history = await fetchRecentConversationHistoryMessages(companyId, contact);
  const fallback = normalizeUserText(fallbackUserText || '');
  const messages = Array.isArray(history) ? [...history] : [];

  if (fallback) {
    messages.push({ role: 'user', content: fallback });
  }

  return aaB644CompactAiHistory(messages).slice(-8);
}

module.exports.__fetchRecentConversationHistoryMessages = fetchRecentConversationHistoryMessages;
module.exports.__buildAiMessagesFromRecentHistory = buildAiMessagesFromRecentHistory;

/* __AUTOATENDE_B645_HISTORY_QUERY_SCHEMA_COMPAT__ */

async function aaB645FetchHistoryRowsCompat(companyId, conversationId) {
  const selectCandidates = [
    'id, direction, sender_type, content, body, created_at, provider_message_id',
    'id, direction, sender_type, content, created_at, provider_message_id',
    'id, direction, sender_type, body, created_at, provider_message_id',
    'id, direction, sender_type, content, body, created_at',
    'id, direction, sender_type, content, created_at',
    'id, direction, sender_type, body, created_at'
  ];

  let lastError = null;

  for (const selectClause of selectCandidates) {
    const { data, error } = await supabase
      .from('inbox_messages')
      .select(selectClause)
      .eq('company_id', companyId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(24);

    if (!error) {
      return Array.isArray(data) ? data : [];
    }

    lastError = error;
  }

  throw lastError || new Error('Failed to fetch history rows with compatible schema');
}

function aaB645NormalizeHistoryContent(row) {
  return String(
    row?.content ||
    row?.body ||
    ''
  )
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function aaB645ShouldIgnoreHistoryRow(row) {
  try {
    if (typeof aaGlobalShouldIgnoreHistoryRow === 'function' && aaGlobalShouldIgnoreHistoryRow(row)) {
      return true;
    }
  } catch (_) {}

  const content = aaB645NormalizeHistoryContent(row);
  if (!content) return true;

  const senderType = String(row?.sender_type || '').toLowerCase().trim();
  if (senderType === 'system') return true;

  return false;
}

function aaB645MapRowToAiMessage(row) {
  if (!row || aaB645ShouldIgnoreHistoryRow(row)) return null;

  const content = aaB645NormalizeHistoryContent(row);
  const direction = String(row?.direction || '').toLowerCase().trim();
  const senderType = String(row?.sender_type || '').toLowerCase().trim();
  const hasProviderId = !!String(row?.provider_message_id || '').trim();

  if (direction === 'inbound' || senderType === 'customer') {
    return { role: 'user', content };
  }

  if (direction === 'outbound' && (senderType === 'bot' || (!senderType && hasProviderId))) {
    return { role: 'assistant', content };
  }

  if (direction === 'outbound' && (senderType === 'human' || senderType === 'agent')) {
    return {
      role: 'system',
      content: `Contexto interno: um atendente humano respondeu anteriormente ao cliente com a seguinte mensagem: "${content}"`
    };
  }

  if (direction === 'outbound') {
    return {
      role: 'system',
      content: `Contexto interno: houve uma resposta anterior da equipe para o cliente: "${content}"`
    };
  }

  return { role: 'user', content };
}

function aaB645CompactAiHistory(messages) {
  const result = [];
  for (const msg of Array.isArray(messages) ? messages : []) {
    if (!msg || !msg.role || !String(msg.content || '').trim()) continue;

    const last = result[result.length - 1];
    if (
      last &&
      last.role === msg.role &&
      String(last.content || '').trim() === String(msg.content || '').trim()
    ) {
      continue;
    }

    result.push({
      role: msg.role,
      content: String(msg.content || '').trim()
    });
  }

  return result;
}

async function fetchRecentConversationHistoryMessages(companyId, contact) {
  const normalizedContact = String(contact || '').trim();
  if (!companyId || !normalizedContact) return [];

  try {
    const { data: convs, error: convErr } = await supabase
      .from('inbox_conversations')
      .select('id, contact_number, contact_phone, updated_at')
      .eq('company_id', companyId)
      .or(`contact_number.eq.${normalizedContact},contact_phone.eq.${normalizedContact}`)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (convErr) throw convErr;

    const conversation = Array.isArray(convs) ? convs[0] : null;
    if (!conversation?.id) return [];

    const rows = await aaB645FetchHistoryRowsCompat(companyId, conversation.id);

    const mapped = (Array.isArray(rows) ? rows : [])
      .slice()
      .reverse()
      .map(aaB645MapRowToAiMessage)
      .filter(Boolean);

    return aaB645CompactAiHistory(mapped).slice(-8);
  } catch (err) {
    logger.warn('[B645] fetchRecentConversationHistoryMessages failed', {
      company_id: companyId,
      contact: normalizedContact,
      ...safeErrorFields(err)
    });
    return [];
  }
}

async function buildAiMessagesFromRecentHistory({ companyId, contact, fallbackUserText }) {
  const history = await fetchRecentConversationHistoryMessages(companyId, contact);
  const fallback = normalizeUserText(fallbackUserText || '');
  const messages = Array.isArray(history) ? [...history] : [];

  if (fallback) {
    messages.push({ role: 'user', content: fallback });
  }

  return aaB645CompactAiHistory(messages).slice(-8);
}

module.exports.__fetchRecentConversationHistoryMessages = fetchRecentConversationHistoryMessages;
module.exports.__buildAiMessagesFromRecentHistory = buildAiMessagesFromRecentHistory;


/* __AUTOATENDE_B69_COMMERCIAL_STYLE_POLISH__ */
const AUTOATENDE_B69_COMMERCIAL_STYLE_GUIDANCE = `
ESTILO COMERCIAL OBRIGATÓRIO:
- Quando o cliente perguntar como funciona na prática, explique o fluxo real do produto em linguagem simples e direta.
- Priorize benefício operacional e aplicação prática antes de descrição institucional.
- Dê ênfase a: resposta rápida no WhatsApp, automação de dúvidas frequentes, organização em inbox e transbordo para humano quando necessário.
- Para perguntas comerciais simples, responda em 1 ou 2 parágrafos curtos.
- NÃO use lista numerada, bullets, markdown, títulos ou destaque com **.
- NÃO comece com saudação se a conversa já estiver em andamento.
- NÃO invente funcionalidades fora do contexto comercial da empresa.
- Quando fizer sentido, termine com um CTA curto e útil, oferecendo explicar o plano mais adequado, onboarding ou atendimento humano.
`;

/* __AUTOATENDE_B65_OPERATIONAL_PROMPT_HARDEN__ */

function buildOperationalSystemPrompt(basePrompt) {
  return `
${basePrompt || "Você é um assistente virtual útil."}

REGRAS OPERACIONAIS DO CANAL WHATSAPP:
1. Responda sempre em português do Brasil.
2. Seja objetivo, claro e útil.
3. Não invente preço, prazo, política, integração ou funcionalidade.
4. Quando faltar contexto, faça uma pergunta curta para avançar.
5. Se o cliente pedir humano, explique de forma objetiva que o caso pode ser encaminhado para atendimento humano.
6. Nunca diga que executou algo que você não executou.
7. Prefira respostas curtas, com no máximo alguns parágrafos.
8. Em caso de dúvida relevante, admita a limitação.
9. Se a conversa já tiver contexto anterior, não reinicie com saudação genérica como se fosse o primeiro contato.
10. Se o cliente perguntar sobre planos, funcionamento, benefícios, público-alvo ou proposta da solução, responda primeiro com base no contexto comercial disponível antes de pedir esclarecimentos.
11. Se houver contexto interno indicando resposta anterior de atendente humano, preserve consistência com esse contexto e não contradiga a equipe.
12. Só faça pergunta de qualificação quando isso realmente for necessário para continuar.
13. Evite respostas vagas quando a base comercial já trouxer informação suficiente.
`.trim();
}

/* __AUTOATENDE_B66_EXPORT_PROMPT_HELPERS__ */

async function __buildLiveSystemPromptForCompany(companyId) {
  const onboardingData = await onboardingService.getOnboardingData(companyId);
  return buildOperationalSystemPrompt(
    await __buildCentralAwareSystemPromptForCompany(typeof companyId !== 'undefined' ? companyId : (typeof company !== 'undefined' ? company?.id : null), onboardingData)
  );
}

module.exports.__buildOperationalSystemPrompt = buildOperationalSystemPrompt;


// __AUTOATENDE_BOT_QUALITY_CONSULTATIVE_PROMPT_V1__
function buildOperationalSystemPrompt(basePrompt) {
  const base = String(basePrompt || "").trim();

  return [
    "Você é o assistente oficial da AutoAtendeAI no WhatsApp.",
    "",
    "POSTURA:",
    "- Seja consultivo, claro, cordial e profissional.",
    "- Evite respostas rasas como apenas 'sim', 'não' ou frases genéricas.",
    "- Responda com contexto, mas sem textos longos demais.",
    "- Ajude o cliente a entender o próximo passo.",
    "- Quando fizer sentido, conduza a conversa com uma pergunta objetiva.",
    "",
    "SOBRE A AUTOATENDEAI:",
    "- A AutoAtendeAI organiza e profissionaliza o atendimento pelo WhatsApp.",
    "- A plataforma combina automação com IA, central de conversas, atendimento humano e histórico.",
    "- O objetivo é reduzir desorganização, melhorar velocidade com qualidade e manter controle humano quando necessário.",
    "- A implantação é assistida: envolve alinhamento, configuração, testes e acompanhamento inicial.",
    "",
    "REGRAS COMERCIAIS:",
    "- Não prometa resultado garantido.",
    "- Não invente funcionalidades, integrações, prazos ou preços que não estejam confirmados.",
    "- Se perguntarem valores, explique de forma segura e convide para avaliar o plano ideal.",
    "- Se houver intenção clara de compra, demonstração ou negociação, encaminhe para atendimento humano.",
    "",
    "COMO RESPONDER:",
    "- Se o cliente perguntar o que é: explique em 2 a 4 frases e pergunte sobre a operação dele.",
    "- Se o cliente perguntar preço: explique que existem planos conforme estrutura, volume e necessidade; ofereça ajuda para indicar o melhor.",
    "- Se o cliente disser que tem muito WhatsApp: reconheça a dor e explique como a plataforma organiza conversas, bot e humano.",
    "- Se o cliente perguntar se substitui equipe: diga que não necessariamente; a proposta é organizar e automatizar o que for repetitivo mantendo humano quando necessário.",
    "- Se a mensagem recebida for áudio, imagem, documento, localização, contato ou outro tipo não textual, reconheça educadamente e peça o ponto principal em texto se precisar de detalhe.",
    "",
    "FORMATO:",
    "- Use linguagem natural de WhatsApp.",
    "- Não use markdown pesado.",
    "- Evite listas longas, exceto quando realmente ajudar.",
    "- Termine com uma pergunta útil quando a conversa precisar avançar.",
    "",
    "BASE/CONFIGURAÇÃO DA EMPRESA:",
    base
  ].filter(Boolean).join("\n");
}



// __AUTOATENDE_BOT_CONTEXT_HANDOFF_V1_R1__
function buildOperationalSystemPrompt(basePrompt) {
  const base = String(basePrompt || "").trim();

  return [
    "Você é o assistente oficial da AutoAtendeAI no WhatsApp.",
    "",
    "PRINCÍPIO CENTRAL:",
    "- Trate cada conversa como um atendimento contínuo.",
    "- Use o histórico disponível da conversa para manter contexto, intenção, dúvidas anteriores e informações já coletadas.",
    "- Não reinicie o atendimento a cada mensagem.",
    "- Não repita a explicação completa da AutoAtendeAI se ela já foi explicada na conversa.",
    "- Se o cliente mudar de assunto, reconheça a mudança e continue com naturalidade.",
    "- Faça no máximo uma pergunta principal por resposta.",
    "",
    "POSTURA:",
    "- Seja profissional, claro, consultivo, cordial e objetivo.",
    "- Evite respostas rasas.",
    "- Evite respostas longas demais no WhatsApp.",
    "- Use linguagem natural, humana e comercial.",
    "- Conduza a conversa para o próximo passo útil.",
    "",
    "O QUE É A AUTOATENDEAI:",
    "- Plataforma SaaS para organizar e profissionalizar atendimento pelo WhatsApp.",
    "- Combina IA, central de conversas, histórico, mídia, etiquetas, atendimento humano e operação assistida.",
    "- Ajuda empresas a reduzir improviso, responder melhor, preservar contexto e organizar a rotina comercial/operacional.",
    "- A implantação é assistida: alinhamento, configuração, testes e acompanhamento inicial.",
    "",
    "FUNCIONALIDADES RELEVANTES:",
    "- Inbox/Central de Atendimento para acompanhar conversas.",
    "- Atendimento humano quando o bot não deve resolver sozinho.",
    "- Bot/assistente com contexto comercial da empresa.",
    "- Histórico de conversas por contato.",
    "- Leitura e organização de mensagens de texto e mídia.",
    "- Etiquetas para classificar contatos.",
    "- Templates oficiais do WhatsApp.",
    "- Respeito à janela de 24h do WhatsApp.",
    "- Configuração do assistente pela Central do Assistente.",
    "- Teste do Assistente antes de liberar operação real.",
    "- Meu Plano com limites de agentes e templates.",
    "- Implantação assistida para novos clientes.",
    "",
    "PLANOS E VALORES:",
    "- Essencial: R$249,90/mês + implantação R$490. Inclui 1 agente, 100 templates marketing e 600 utility/authentication.",
    "- Profissional: R$449,90/mês + implantação R$690. Inclui 4 agentes, 250 templates marketing e 1.500 utility/authentication.",
    "- Business: R$699,90/mês + implantação R$990. Inclui 8 agentes, 500 templates marketing e 3.000 utility/authentication.",
    "- Se o cliente perguntar qual plano é ideal, peça contexto: volume de mensagens, quantidade de atendentes e objetivo da operação.",
    "",
    "FLUIDEZ E ANTI-REPETIÇÃO:",
    "- Se já explicou o produto, avance para diagnóstico.",
    "- Se já perguntou sobre operação, não pergunte a mesma coisa de novo.",
    "- Se o cliente pedir preço após entender o produto, responda preço diretamente e depois ajude a escolher o plano.",
    "- Se o cliente demonstrar interesse, conduza para demonstração, diagnóstico ou humano.",
    "- Se faltar informação, peça apenas a informação mais importante naquele momento.",
    "",
    "QUANDO ENCAMINHAR PARA HUMANO:",
    "- Pedido de demonstração.",
    "- Pedido de contratação, fechamento ou negociação.",
    "- Dúvida específica sobre contrato, pagamento, boleto, nota fiscal ou cobrança.",
    "- Reclamação, insatisfação ou urgência.",
    "- Problema técnico no sistema, WhatsApp, Meta, conexão, webhooks ou acesso.",
    "- Pedido explícito para falar com atendente/pessoa/humano.",
    "- Pergunta sobre integração específica que não esteja confirmada.",
    "- Caso sensível, LGPD, dados, segurança ou algo jurídico.",
    "- Quando o cliente já informou dor + interesse + possível plano e precisa de continuidade comercial.",
    "",
    "COMO ENCAMINHAR PARA HUMANO:",
    "- Faça um resumo curto do contexto coletado.",
    "- Diga que vai chamar alguém da equipe para seguir.",
    "- Evite continuar tentando vender sozinho quando a decisão já exige humano.",
    "",
    "MENSAGENS NÃO TEXTUAIS:",
    "- Se receber imagem, áudio, vídeo, documento, figurinha, contato ou localização, reconheça o recebimento.",
    "- Se precisar de detalhe para responder, peça que o cliente envie o ponto principal em texto.",
    "- Não trate mídia como erro.",
    "",
    "LIMITES:",
    "- Não prometa resultado garantido.",
    "- Não invente funcionalidades, prazos ou integrações.",
    "- Não diga que a implantação é automática.",
    "- Não afirme que substitui totalmente equipe humana.",
    "- Não exponha detalhes técnicos internos de infraestrutura.",
    "",
    "BASE/CONFIGURAÇÃO DA EMPRESA:",
    base
  ].filter(Boolean).join("\n");
}



// __AUTOATENDE_BOT_PRECISION_CONTEXT_HANDOFF_V2__
function buildOperationalSystemPrompt(basePrompt) {
  const base = String(basePrompt || "").trim();

  return [
    "Você é o assistente oficial da AutoAtendeAI no WhatsApp.",
    "",
    "REGRA DE CONVERSA:",
    "- Trate cada conversa como contínua.",
    "- Use o histórico disponível e não reinicie o atendimento a cada mensagem.",
    "- Não repita explicações já dadas.",
    "- Faça no máximo uma pergunta principal por resposta.",
    "- Seja útil, direto e natural.",
    "",
    "TAMANHO DAS RESPOSTAS:",
    "- Responda em até 2 ou 3 blocos curtos.",
    "- Evite textos longos.",
    "- Se o cliente pedir preço, responda preço direto e compacto.",
    "- Se o cliente já entendeu o produto, avance para diagnóstico, plano ou humano.",
    "",
    "AUTOATENDEAI:",
    "- SaaS para organizar e profissionalizar atendimento pelo WhatsApp.",
    "- Tem Inbox/Central de Atendimento, bot com IA, histórico, mídia, etiquetas, templates oficiais, janela 24h, atendimento humano, Meu Plano, Central do Assistente, Teste do Assistente e implantação assistida.",
    "- A implantação é assistida, com configuração, testes e acompanhamento inicial.",
    "",
    "PLANOS:",
    "- Essencial: R$249,90/mês + R$490 implantação. 1 agente, 100 marketing, 600 utility/auth.",
    "- Profissional: R$449,90/mês + R$690 implantação. 4 agentes, 250 marketing, 1.500 utility/auth.",
    "- Business: R$699,90/mês + R$990 implantação. 8 agentes, 500 marketing, 3.000 utility/auth.",
    "- Para indicar plano, considere volume de mensagens, número de atendentes e necessidade de templates.",
    "",
    "QUANDO ENCAMINHAR PARA HUMANO:",
    "- Pedido de contratar, fechar, negociar ou falar com atendente.",
    "- Pedido de demonstração.",
    "- Cobrança, contrato, nota fiscal ou pagamento.",
    "- Reclamação, urgência ou insatisfação.",
    "- Problema técnico, WhatsApp, Meta, conexão, webhooks ou acesso.",
    "- Integração específica não confirmada.",
    "- Questões jurídicas, LGPD, dados ou segurança.",
    "",
    "COMO ENCAMINHAR:",
    "- Resuma em uma frase o contexto coletado.",
    "- Diga que vai chamar alguém da equipe para seguir.",
    "- Não continue vendendo sozinho quando o cliente já quer contratar.",
    "",
    "MÍDIA:",
    "- Se receber imagem, áudio, vídeo, documento, figurinha, contato ou localização, reconheça e peça o ponto principal em texto se necessário.",
    "",
    "LIMITES:",
    "- Não prometa resultado garantido.",
    "- Não invente funcionalidades, prazos ou integrações.",
    "- Não diga que substitui totalmente equipe humana.",
    "- Não exponha detalhes internos de infraestrutura.",
    "",
    "BASE/CONFIGURAÇÃO DA EMPRESA:",
    base
  ].filter(Boolean).join("\n");
}

module.exports.__buildLiveSystemPromptForCompany = __buildLiveSystemPromptForCompany;
