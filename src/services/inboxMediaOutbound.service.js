'use strict';

/* __AUTOATENDE_AUDIO_ATTACHMENT_PHASE4A__ */
/* __AUTOATENDE_VOICE_BACKEND_PHASE4B1__ */

/* __AUTOATENDE_OUTBOUND_MEDIA_PHASE2D_R2__ */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const supabase = require('../config/supabase');
const whatsappService = require('./whatsapp.service');
const inboxService = require('./inbox.service');

const GRAPH_VERSION = String(
  process.env.WHATSAPP_API_VERSION || 'v24.0'
).trim();

const GRAPH_TIMEOUT_MS = Number(
  process.env.WHATSAPP_SEND_TIMEOUT_MS || 30000
);

const MB = 1024 * 1024;

const MEDIA_RULES = {
  image: {
    maxBytes: 5 * MB,
    mimeTypes: new Set([
      'image/jpeg',
      'image/png'
    ])
  },

  video: {
    maxBytes: 16 * MB,
    mimeTypes: new Set([
      'video/mp4',
      'video/3gpp'
    ])
  },

  audio: {
    maxBytes: 16 * MB,
    mimeTypes: new Set([
      'audio/aac',
      'audio/amr',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg'
    ])
  },

  document: {
    maxBytes: 95 * MB,
    mimeTypes: new Set([
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/csv',
      'application/json',
      'application/rtf',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',

      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ])
  }
};

function createError(
  message,
  statusCode,
  code,
  details = null
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;

  if (details) {
    error.details = details;
  }

  return error;
}

function normalizeText(value, maxLength = 4096) {
  return String(value || '')
    .trim()
    .replace(/\r\n/g, '\n')
    .slice(0, maxLength);
}

function normalizeFilename(value) {
  const source = path.basename(
    String(value || 'arquivo')
  );

  const normalized = source
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.slice(0, 180) || 'arquivo';
}

function normalizePhone(value) {
  const digits = String(value || '')
    .replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return digits;
}

function resolveMediaType(mimeType) {
  const normalizedMime = String(
    mimeType || ''
  ).toLowerCase();

  for (const [type, rule] of Object.entries(MEDIA_RULES)) {
    if (rule.mimeTypes.has(normalizedMime)) {
      return type;
    }
  }

  return null;
}

function validateFile(file) {
  if (
    !file ||
    !file.path ||
    !file.mimetype ||
    !Number.isFinite(Number(file.size))
  ) {
    throw createError(
      'Arquivo de mídia ausente ou inválido.',
      400,
      'MEDIA_FILE_REQUIRED'
    );
  }

  const type = resolveMediaType(file.mimetype);

  if (!type) {
    throw createError(
      'Formato de arquivo não permitido.',
      415,
      'MEDIA_TYPE_NOT_ALLOWED',
      {
        mime_type: file.mimetype
      }
    );
  }

  const rule = MEDIA_RULES[type];

  if (Number(file.size) > rule.maxBytes) {
    throw createError(
      'O arquivo excede o limite permitido.',
      413,
      'MEDIA_FILE_TOO_LARGE',
      {
        media_type: type,
        file_size: Number(file.size),
        max_size: rule.maxBytes
      }
    );
  }

  return {
    type,
    rule,
    filename: normalizeFilename(
      file.originalname
    )
  };
}

async function loadConversation(
  companyId,
  conversationId
) {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('company_id', companyId)
    .limit(1);

  if (error) {
    throw createError(
      'Não foi possível localizar a conversa.',
      500,
      'MEDIA_CONVERSATION_LOOKUP_FAILED',
      {
        database_message: error.message
      }
    );
  }

  const conversation =
    Array.isArray(data) ? data[0] : null;

  if (!conversation) {
    throw createError(
      'Conversa não encontrada.',
      404,
      'MEDIA_CONVERSATION_NOT_FOUND'
    );
  }

  return conversation;
}

function buildContactAliases(contact) {
  const values = new Set();

  const raw = String(contact || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (raw) {
    values.add(raw);
  }

  if (digits) {
    values.add(digits);
    values.add(`+${digits}`);
  }

  if (
    typeof inboxService.__aaR16gD2BrazilAliasForms
      === 'function'
  ) {
    try {
      const aliases =
        inboxService.__aaR16gD2BrazilAliasForms(raw);

      if (Array.isArray(aliases)) {
        aliases.forEach((alias) => {
          const normalized = String(
            alias || ''
          ).trim();

          if (normalized) {
            values.add(normalized);
          }
        });
      }
    } catch (_) {
      // Fallback local acima continua válido.
    }
  }

  return Array.from(values);
}

async function loadConversationState(
  companyId,
  contact
) {
  const aliases = buildContactAliases(contact);

  for (const alias of aliases) {
    const { data, error } = await supabase
      .from('conversation_states')
      .select('*')
      .eq('company_id', companyId)
      .eq('contact', alias)
      .limit(1);

    if (error) {
      throw createError(
        'Não foi possível validar o modo da conversa.',
        500,
        'MEDIA_CONVERSATION_STATE_LOOKUP_FAILED',
        {
          database_message: error.message
        }
      );
    }

    if (Array.isArray(data) && data[0]) {
      return data[0];
    }
  }

  return null;
}

async function assertHumanMode(
  companyId,
  conversation
) {
  const contact =
    conversation.contact_number ||
    conversation.contact_phone ||
    '';

  const state = await loadConversationState(
    companyId,
    contact
  );

  const rawMode =
    state?.mode ||
    state?.current_mode ||
    conversation?.mode ||
    'bot';

  const mode = String(rawMode)
    .trim()
    .toLowerCase();

  if (mode !== 'human') {
    throw createError(
      'Assuma a conversa no modo Humano antes de enviar anexos.',
      409,
      'MEDIA_REQUIRES_HUMAN_MODE',
      {
        current_mode: mode || 'bot',
        contact
      }
    );
  }

  return state;
}

async function assertWindowOpen(
  companyId,
  conversationId
) {
  const guard =
    inboxService
      .__aaR17aA2AssertManualSendWindowOpen;

  if (typeof guard !== 'function') {
    throw createError(
      'A proteção da janela de 24 horas não está disponível.',
      503,
      'MEDIA_WINDOW_GUARD_UNAVAILABLE'
    );
  }

  return guard({
    companyId,
    conversationId,
    senderType: 'human',
    metadata: {
      source: 'inbox_manual_send',
      media: true
    }
  });
}

async function loadWhatsAppAccount(companyId) {
  const fields = [
    'id',
    'company_id',
    'client_id',
    'waba_id',
    'phone_number_id',
    'phone_number',
    'access_token'
  ].join(',');

  let result = await supabase
    .from('whatsapp_accounts')
    .select(fields)
    .eq('company_id', companyId)
    .limit(1);

  if (result.error) {
    throw createError(
      'Não foi possível carregar a conta do WhatsApp.',
      500,
      'MEDIA_WHATSAPP_ACCOUNT_LOOKUP_FAILED',
      {
        database_message:
          result.error.message
      }
    );
  }

  let account =
    Array.isArray(result.data)
      ? result.data[0]
      : null;

  if (!account) {
    result = await supabase
      .from('whatsapp_accounts')
      .select(fields)
      .eq('client_id', companyId)
      .limit(1);

    if (result.error) {
      throw createError(
        'Não foi possível carregar a conta do WhatsApp.',
        500,
        'MEDIA_WHATSAPP_ACCOUNT_LOOKUP_FAILED',
        {
          database_message:
            result.error.message
        }
      );
    }

    account =
      Array.isArray(result.data)
        ? result.data[0]
        : null;
  }

  if (!account) {
    throw createError(
      'Conta do WhatsApp não conectada.',
      400,
      'WHATSAPP_NOT_CONNECTED'
    );
  }

  const accessToken =
    account.access_token ||
    await whatsappService.getAccessToken(
      companyId
    );

  if (!accessToken) {
    throw createError(
      'Token do WhatsApp não disponível.',
      400,
      'WHATSAPP_TOKEN_MISSING'
    );
  }

  const phoneNumberIdCandidates = [
    account.phone_number_id,
    account.phone_number,
    account.waba_id
  ];

  const phoneNumberId =
    phoneNumberIdCandidates
      .map((value) =>
        String(value || '').trim()
      )
      .find((value) =>
        /^[0-9]{12,}$/.test(value)
      );

  if (!phoneNumberId) {
    throw createError(
      'Identificador do número do WhatsApp não disponível.',
      400,
      'WHATSAPP_PHONE_NUMBER_ID_MISSING'
    );
  }

  return {
    ...account,
    accessToken,
    phoneNumberId
  };
}

function graphErrorDetails(error) {
  return (
    error?.response?.data ||
    error?.details ||
    {
      message: error?.message || 'unknown'
    }
  );
}

async function uploadMediaToMeta({
  account,
  file,
  type
}) {
  const form = new FormData();

  form.append(
    'messaging_product',
    'whatsapp'
  );

  form.append('type', file.mimetype);

  form.append(
    'file',
    fs.createReadStream(file.path),
    {
      filename: normalizeFilename(
        file.originalname
      ),
      contentType: file.mimetype,
      knownLength: Number(file.size)
    }
  );

  const url =
    `https://graph.facebook.com/` +
    `${GRAPH_VERSION}/` +
    `${encodeURIComponent(account.phoneNumberId)}/media`;

  try {
    const response = await axios.post(
      url,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization:
            `Bearer ${account.accessToken}`
        },

        timeout: Math.max(
          GRAPH_TIMEOUT_MS,
          60000
        ),

        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const mediaId = String(
      response?.data?.id || ''
    ).trim();

    if (!mediaId) {
      throw createError(
        'A Meta não retornou o identificador da mídia.',
        502,
        'META_MEDIA_ID_MISSING',
        {
          provider_response:
            response?.data || null
        }
      );
    }

    return {
      mediaId,
      providerResponse:
        response?.data || null
    };
  } catch (error) {
    if (error?.code === 'META_MEDIA_ID_MISSING') {
      throw error;
    }

    const providerStatus =
      Number(error?.response?.status) ||
      502;

    throw createError(
      'Não foi possível carregar o arquivo no WhatsApp.',
      providerStatus >= 400 &&
      providerStatus < 600
        ? providerStatus
        : 502,
      'META_MEDIA_UPLOAD_FAILED',
      graphErrorDetails(error)
    );
  }
}

async function sendMediaMessage({
  account,
  destination,
  type,
  mediaId,
  caption,
  filename
}) {
  const mediaPayload = {
    id: mediaId
  };

  if (
    caption &&
    type !== 'audio'
  ) {
    mediaPayload.caption = caption;
  }

  if (type === 'document') {
    mediaPayload.filename = filename;
  }

  const url =
    `https://graph.facebook.com/` +
    `${GRAPH_VERSION}/` +
    `${encodeURIComponent(account.phoneNumberId)}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: destination,
        type,
        [type]: mediaPayload
      },
      {
        headers: {
          Authorization:
            `Bearer ${account.accessToken}`,
          'Content-Type':
            'application/json'
        },

        timeout: Math.max(
          GRAPH_TIMEOUT_MS,
          30000
        )
      }
    );

    const providerMessageId = String(
      response?.data?.messages?.[0]?.id ||
      ''
    ).trim();

    if (!providerMessageId) {
      throw createError(
        'A Meta não confirmou o envio da mídia.',
        502,
        'META_MEDIA_MESSAGE_ID_MISSING',
        {
          provider_response:
            response?.data || null
        }
      );
    }

    return {
      providerMessageId,
      providerResponse:
        response?.data || null
    };
  } catch (error) {
    if (
      error?.code ===
      'META_MEDIA_MESSAGE_ID_MISSING'
    ) {
      throw error;
    }

    const providerStatus =
      Number(error?.response?.status) ||
      502;

    throw createError(
      'Não foi possível enviar o arquivo pelo WhatsApp.',
      providerStatus >= 400 &&
      providerStatus < 600
        ? providerStatus
        : 502,
      'META_MEDIA_SEND_FAILED',
      graphErrorDetails(error)
    );
  }
}

function buildContent({
  type,
  caption,
  filename
}) {
  if (caption) {
    return caption;
  }

  if (type === 'image') {
    return '[imagem]';
  }

  if (type === 'video') {
    return '[vídeo]';
  }

  if (type === 'audio') {
    return '[áudio]';
  }

  return `[documento] ${filename}`;
}

async function persistOutboundMedia({
  companyId,
  conversationId,
  type,
  file,
  filename,
  caption,
  mediaId,
  providerMessageId,
  providerResponse,
  actorUserId,
  voiceRecording = false,
  voiceDurationSeconds = null
}) {
  const nowIso =
    new Date().toISOString();

  const content = buildContent({
    type,
    caption,
    filename
  });

  const typedPayload = {
    id: mediaId,
    mime_type: file.mimetype,
    file_size: Number(file.size),
    filename,
    caption: caption || null,
    voice_recording:
      Boolean(voiceRecording),
    duration_seconds:
      voiceDurationSeconds
  };

  const raw = {
    type,
    [type]: typedPayload
  };

  const meta = {
    type,
    media_id: mediaId,
    mime_type: file.mimetype,
    file_size: Number(file.size),
    filename,
    file_name: filename,
    caption: caption || null,
    source: 'inbox_manual_send',
    channel: 'media',
    agent_id: actorUserId || null,
    provider_response:
      providerResponse || null,
    voice_recording:
      Boolean(voiceRecording),
    duration_seconds:
      voiceDurationSeconds
  };

  const base = {
    company_id: companyId,
    conversation_id: conversationId,
    direction: 'outbound',
    sender_type: 'human',
    message_type: type,
    content,
    raw,
    meta,
    provider_message_id:
      providerMessageId,
    wa_message_id:
      providerMessageId,
    status: 'sent',
    created_at: nowIso
  };

  const candidates = [
    base,

    (() => {
      const candidate = { ...base };
      delete candidate.status;
      return candidate;
    })(),

    (() => {
      const candidate = { ...base };
      delete candidate.wa_message_id;
      return candidate;
    })(),

    (() => {
      const candidate = { ...base };
      delete candidate.status;
      delete candidate.wa_message_id;
      return candidate;
    })()
  ];

  let lastError = null;

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from('inbox_messages')
      .insert(candidate)
      .select('*')
      .single();

    if (!error && data) {
      return data;
    }

    lastError = error;
  }

  throw createError(
    'A mídia foi enviada, mas não pôde ser gravada no histórico.',
    502,
    'MEDIA_SENT_PERSIST_FAILED',
    {
      delivered_to_whatsapp: true,
      provider_message_id:
        providerMessageId,
      database_message:
        lastError?.message || null
    }
  );
}

async function touchConversation(
  conversationId
) {
  const nowIso =
    new Date().toISOString();

  let result = await supabase
    .from('inbox_conversations')
    .update({
      last_message_at: nowIso,
      updated_at: nowIso
    })
    .eq('id', conversationId);

  if (result.error) {
    result = await supabase
      .from('inbox_conversations')
      .update({
        updated_at: nowIso
      })
      .eq('id', conversationId);
  }

  if (result.error) {
    console.warn(
      '[OUTBOUND_MEDIA_R2] conversation touch warning:',
      result.error.message
    );
  }
}

async function sendOutboundMedia({
  companyId,
  conversationId,
  file,
  caption = '',
  actorUserId = null,
  voiceRecording = false,
  voiceDurationSeconds = null
}) {
  if (!companyId) {
    throw createError(
      'Empresa não identificada.',
      400,
      'COMPANY_ID_NOT_RESOLVED'
    );
  }

  if (!conversationId) {
    throw createError(
      'Conversa não identificada.',
      400,
      'CONVERSATION_ID_REQUIRED'
    );
  }

  const validated = validateFile(file);

  const conversation =
    await loadConversation(
      companyId,
      conversationId
    );

  await assertHumanMode(
    companyId,
    conversation
  );

  await assertWindowOpen(
    companyId,
    conversationId
  );

  const destination = normalizePhone(
    conversation.contact_number ||
    conversation.contact_phone
  );

  if (!destination) {
    throw createError(
      'O telefone da conversa é inválido.',
      400,
      'MEDIA_DESTINATION_INVALID'
    );
  }

  const account =
    await loadWhatsAppAccount(companyId);

  const safeCaption =
    normalizeText(caption, 1024);

  const uploadResult =
    await uploadMediaToMeta({
      account,
      file,
      type: validated.type
    });

  const sendResult =
    await sendMediaMessage({
      account,
      destination,
      type: validated.type,
      mediaId: uploadResult.mediaId,
      caption: safeCaption,
      filename: validated.filename
    });

  const message =
    await persistOutboundMedia({
      companyId,
      conversationId,
      type: validated.type,
      file,
      filename: validated.filename,
      caption: safeCaption,
      mediaId: uploadResult.mediaId,
      providerMessageId:
        sendResult.providerMessageId,
      providerResponse:
        sendResult.providerResponse,
      actorUserId,
      voiceRecording,
      voiceDurationSeconds
    });

  await touchConversation(
    conversationId
  );

  console.log(
    '[OUTBOUND_MEDIA_R2] sent',
    JSON.stringify({
      company_id: companyId,
      conversation_id: conversationId,
      message_id: message?.id || null,
      provider_message_id:
        sendResult.providerMessageId,
      media_id:
        uploadResult.mediaId,
      media_type:
        validated.type,
      mime_type:
        file.mimetype,
      file_size:
        Number(file.size)
    })
  );

  return {
    success: true,
    conversation_id: conversationId,
    message,
    message_id:
      message?.id || null,
    provider_message_id:
      sendResult.providerMessageId,
    media_id:
      uploadResult.mediaId,
    media_type:
      validated.type,
    mime_type:
      file.mimetype,
    filename:
      validated.filename,
    file_size:
      Number(file.size)
  };
}

module.exports = {
  MEDIA_RULES,
  resolveMediaType,
  sendOutboundMedia
};
