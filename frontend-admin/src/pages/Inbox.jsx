import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  createPortal } from 'react-dom';

import {
  AlertCircle,
  Bot,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  Send,
  Smile,
  Tag,
  User,
  Video as VideoIcon,
  Volume2,
  Paperclip,
  X,
  Mic,
  Square,
  Trash2,
  Copy,
  ExternalLink,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

import styles from '../styles/InboxV2Integrated.module.css';

const AA_REAL_INBOX_MARKER =
  '__AUTOATENDE_INBOX_PREMIUM_REAL_DATA_V1__';

const AA_LABEL_MODAL_VERSION =
  '__AUTOATENDE_INBOX_LABEL_MODAL_V3__';

const EMOJIS = [
  '😀', '😃', '😊', '😉', '😍', '🥰', '😂', '🙏',
  '👍', '👏', '🤝', '💪', '✅', '⭐', '🔥', '🚀',
  '💚', '❤️', '🎉', '💡', '📌', '📞', '📅', '📦',
  '💬', '👀', '✨', '🤗', '😎', '🙌', '👌', '👋',
];

const LABEL_SUGGESTIONS = [
  'Novo contato',
  'Lead quente',
  'Em atendimento',
  'Aguardando retorno',
  'Cliente',
  'Finalizado',
];

const MEDIA_TYPES = new Set([
  'image',
  'video',
  'audio',
  'document',
  'sticker',
]);

function cx(...classNames) {
  return classNames.filter(Boolean).join(' ');
}

function parseMaybe(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function toText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return '';
}

function firstText(...values) {
  for (const value of values) {
    const text = toText(value);

    if (text) {
      return text;
    }
  }

  return '';
}

function extractArray(payload, possibleKeys = []) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of possibleKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (
    payload.data &&
    typeof payload.data === 'object'
  ) {
    const nested = extractArray(
      payload.data,
      possibleKeys
    );

    if (nested.length) {
      return nested;
    }
  }

  if (
    payload.result &&
    typeof payload.result === 'object'
  ) {
    const nested = extractArray(
      payload.result,
      possibleKeys
    );

    if (nested.length) {
      return nested;
    }
  }

  return [];
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function findErrorCode(payload) {
  return firstText(
    payload?.code,
    payload?.error,
    payload?.details?.code,
    payload?.data?.code,
    payload?.data?.error,
    payload?.meta?.code
  );
}

function findErrorMessage(payload) {
  return firstText(
    payload?.message,
    payload?.details?.message,
    payload?.data?.message,
    payload?.error_description
  );
}

function getInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return 'CT';
  }

  return parts
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}


/* __AUTOATENDE_MEDIA_LABELS_AVATAR_READY_V1__ */
const AA_MEDIA_LABELS_AVATAR_READY_MARKER =
  '__AUTOATENDE_MEDIA_LABELS_AVATAR_READY_V1__';

function aaResolveConversationAvatarUrl(raw = {}) {
  const nestedRaw =
    parseMaybe(raw?.raw) || {};

  const candidates = [
    raw?.avatar_url,
    raw?.avatarUrl,

    raw?.contact_avatar_url,
    raw?.contactAvatarUrl,

    raw?.profile_photo_url,
    raw?.profilePhotoUrl,

    raw?.profile_picture_url,
    raw?.profilePictureUrl,

    raw?.picture_url,
    raw?.pictureUrl,

    raw?.photo_url,
    raw?.photoUrl,

    raw?.image_url,
    raw?.imageUrl,

    raw?.profile?.avatar_url,
    raw?.profile?.avatarUrl,
    raw?.profile?.photo_url,
    raw?.profile?.photoUrl,
    raw?.profile?.picture_url,
    raw?.profile?.pictureUrl,

    raw?.contact?.avatar_url,
    raw?.contact?.avatarUrl,
    raw?.contact?.photo_url,
    raw?.contact?.photoUrl,
    raw?.contact?.picture_url,
    raw?.contact?.pictureUrl,

    nestedRaw?.avatar_url,
    nestedRaw?.avatarUrl,

    nestedRaw?.contact_avatar_url,
    nestedRaw?.contactAvatarUrl,

    nestedRaw?.profile_photo_url,
    nestedRaw?.profilePhotoUrl,

    nestedRaw?.profile_picture_url,
    nestedRaw?.profilePictureUrl,

    nestedRaw?.photo_url,
    nestedRaw?.photoUrl,
  ];

  for (const candidate of candidates) {
    const value =
      String(candidate || '').trim();

    if (
      /^(?:https?:\/\/|blob:|data:image\/|\/)/i
        .test(value)
    ) {
      return value;
    }
  }

  return '';
}

function aaInboxMediaLabel(type = '') {
  const labels = {
    image: 'Foto',
    audio: 'Áudio',
    video: 'Vídeo',
    document: 'Documento',
    sticker: 'Figurinha',
  };

  return labels[
    String(type || '')
      .trim()
      .toLowerCase()
  ] || 'Mídia';
}

/* __AUTOATENDE_CONTACT_AVATAR_FRONTEND_V1__ */
function AvatarContent({
  conversation,
  accessToken = '',
  version = 0,
  onPresenceChange,
}) {
  const fallbackAvatarUrl =
    firstText(conversation?.avatarUrl);

  const conversationId =
    firstText(conversation?.id);

  const [resolvedAvatarUrl, setResolvedAvatarUrl] =
    useState(fallbackAvatarUrl);

  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    setFailed(false);
    setResolvedAvatarUrl(fallbackAvatarUrl);

    if (!conversationId || !accessToken) {
      onPresenceChange?.(
        Boolean(fallbackAvatarUrl)
      );

      return () => {
        active = false;
      };
    }

    const endpoint =
      `/api/inbox/conversations/` +
      `${encodeURIComponent(conversationId)}` +
      `/avatar?v=${encodeURIComponent(version)}`;

    fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (response.status === 404) {
          if (active) {
            setResolvedAvatarUrl(
              fallbackAvatarUrl
            );

            onPresenceChange?.(
              Boolean(fallbackAvatarUrl)
            );
          }

          return;
        }

        if (!response.ok) {
          throw new Error(
            `CONTACT_AVATAR_HTTP_${response.status}`
          );
        }

        const blob = await response.blob();

        objectUrl = URL.createObjectURL(blob);

        if (active) {
          setResolvedAvatarUrl(objectUrl);
          onPresenceChange?.(true);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedAvatarUrl(
            fallbackAvatarUrl
          );

          onPresenceChange?.(
            Boolean(fallbackAvatarUrl)
          );
        }
      });

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    accessToken,
    conversationId,
    fallbackAvatarUrl,
    onPresenceChange,
    version,
  ]);

  if (resolvedAvatarUrl && !failed) {
    return (
      <img
        className={styles.avatarImage}
        src={resolvedAvatarUrl}
        alt=""
        loading="lazy"
        data-aa-avatar-ready={
          AA_MEDIA_LABELS_AVATAR_READY_MARKER
        }
        data-aa-contact-avatar={
          '__AUTOATENDE_CONTACT_AVATAR_FRONTEND_V1__'
        }
        onError={() => setFailed(true)}
      />
    );
  }

  return getInitials(
    conversation?.name ||
    conversation?.phone ||
    'Contato'
  );
}
/* END __AUTOATENDE_CONTACT_AVATAR_FRONTEND_V1__ */

/* END __AUTOATENDE_MEDIA_LABELS_AVATAR_READY_V1__ */

function getTone(seed = '') {
  const tones = [
    'green',
    'blue',
    'purple',
    'amber',
  ];

  const value = String(seed);

  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (
      (hash * 31) +
      value.charCodeAt(index)
    ) >>> 0;
  }

  return tones[hash % tones.length];
}

function formatTime(value) {
  if (!value) {
    return '';
  }

  const stringValue = String(value);

  if (/^\d{1,2}:\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function normalizeLabels(raw) {
  const candidates = [
    raw?.labels,
    raw?.tags,
    raw?.conversation_labels,
    raw?.inbox_labels,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => {
          if (typeof item === 'string') {
            return item.trim();
          }

          return firstText(
            item?.name,
            item?.label,
            item?.title
          );
        })
        .filter(Boolean);
    }

    if (typeof candidate === 'string') {
      return candidate
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  const single = firstText(
    raw?.label_name,
    raw?.label,
    raw?.tag_name,
    raw?.tag
  );

  return single ? [single] : [];
}

/* __AUTOATENDE_CONVERSATION_LIST_TIMESTAMP_V18_B_R3__ */
function aaFormatConversationListTimestamp(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return formatTime(value);
  }

  let normalizedValue = value;

  if (
    typeof normalizedValue === 'number' &&
    Number.isFinite(normalizedValue) &&
    normalizedValue > 0 &&
    normalizedValue < 100000000000
  ) {
    normalizedValue *= 1000;
  }

  if (
    typeof normalizedValue === 'string' &&
    /^\d{10}$/.test(normalizedValue.trim())
  ) {
    normalizedValue =
      Number(normalizedValue.trim()) * 1000;
  }

  const date =
    normalizedValue instanceof Date
      ? new Date(normalizedValue.getTime())
      : new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return formatTime(value);
  }

  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
  );

  if (isToday) {
    return time;
  }

  const sameYear =
    date.getFullYear() === now.getFullYear();

  const formattedDate = date.toLocaleDateString(
    'pt-BR',
    sameYear
      ? {
          day: '2-digit',
          month: '2-digit'
        }
      : {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        }
  );

  return `${formattedDate} ${time}`;
}

function normalizeConversation(raw, currentUserId) {
  const id = firstText(
    raw?.id,
    raw?.conversation_id,
    raw?.conversationId
  );

  const phone = firstText(
    raw?.contact_number,
    raw?.contact_phone,
    raw?.contact,
    raw?.phone,
    raw?.wa_id
  );

  const name = firstText(
    raw?.contact_name,
    raw?.name,
    raw?.customer_name,
    raw?.profile_name,
    phone,
    'Contato sem identificação'
  );

  const avatarUrl =
    aaResolveConversationAvatarUrl(raw);

  const labels = normalizeLabels(raw);

  const lastMessageObject =
    raw?.last_message &&
    typeof raw.last_message === 'object'
      ? raw.last_message
      : null;

  const preview = firstText(
    raw?.last_message_content,
    raw?.last_message_text,
    lastMessageObject?.content,
    lastMessageObject?.text,
    raw?.preview,
    raw?.message_preview,
    'Sem mensagens'
  );

  const lastMessageAt = firstText(
    raw?.last_message_at,
    lastMessageObject?.created_at,
    raw?.updated_at,
    raw?.created_at
  );

  const mode =
    String(raw?.mode || '')
      .trim()
      .toLowerCase() === 'human'
      ? 'human'
      : 'bot';

  const assignedId = firstText(
    raw?.assigned_agent_id,
    raw?.assigned_user_id,
    raw?.owner_id
  );

  const isMine = Boolean(
    raw?.is_mine === true ||
    raw?.assigned_to_me === true ||
    raw?.owner_is_current_user === true ||
    (
      currentUserId &&
      assignedId &&
      String(currentUserId) === String(assignedId)
    )
  );

  const unread = Math.max(
    0,
    Number(
      raw?.unread_count ??
      raw?.unread ??
      raw?.pending_count ??
      0
    ) || 0
  );

  const responsible = firstText(
    raw?.assigned_agent_name,
    raw?.assigned_user_name,
    raw?.owner_name,
    raw?.responsible_name,
    isMine ? 'Você' : ''
  );

  return {
    id,
    name,
    phone,
    avatarUrl,
    preview,
    timestamp: lastMessageAt,
    time: aaFormatConversationListTimestamp(lastMessageAt),
    unread,
    mode,
    label: labels[0] || '',
    labels,
    tone: getTone(phone || id),
    isMine,
    responsible,
    createdAt: firstText(raw?.created_at),
    lastMessageAt,
    lastInboundAt: firstText(
      raw?.last_inbound_at
    ),
    messageCount:
      Number(
        raw?.message_count ??
        raw?.messages_count ??
        raw?.total_messages ??
        0
      ) || 0,
    raw,
  };
}

function normalizeMessage(raw, index = 0) {
  const rawObject = parseMaybe(raw?.raw) || {};
  const metaObject = parseMaybe(raw?.meta) || {};

  const type = String(
    raw?.message_type ||
    raw?.type ||
    metaObject?.type ||
    rawObject?.type ||
    'text'
  )
    .trim()
    .toLowerCase();

  const direction = String(
    raw?.direction ||
    raw?.message_direction ||
    ''
  )
    .trim()
    .toLowerCase();

  const outbound =
    direction === 'outbound' ||
    direction === 'sent' ||
    raw?.from_me === true ||
    raw?.is_from_me === true;

  const senderType = firstText(
    raw?.sender_type,
    outbound ? 'human' : 'customer'
  );

  const mediaObject =
    type &&
    rawObject?.[type] &&
    typeof rawObject[type] === 'object'
      ? rawObject[type]
      : {};

  const content = firstText(
    raw?.content,
    raw?.text,
    raw?.body,
    raw?.message,
    mediaObject?.caption,
    mediaObject?.filename,
    metaObject?.caption,
    metaObject?.filename
  );

  return {
    id: firstText(
      raw?.id,
      raw?.message_id,
      raw?.provider_message_id,
      raw?.wa_message_id,
      `message-${index}`
    ),
    direction: outbound ? 'outbound' : 'inbound',
    senderType,
    sender:
      outbound
        ? senderType === 'bot'
          ? 'AutoAtendeAI'
          : 'Você'
        : 'Cliente',
    type,
    text: content,
    createdAt: firstText(
      raw?.created_at,
      raw?.timestamp,
      raw?.sent_at
    ),
    time: formatTime(
      firstText(
        raw?.created_at,
        raw?.timestamp,
        raw?.sent_at
      )
    ),
    raw: rawObject,
    meta: metaObject,
    optimistic: Boolean(raw?.optimistic),
    original: raw,
  };
}

/* BEGIN __AUTOATENDE_INBOX_WHATSAPP_CLEAN_V11_B_MEDIA_STYLE__ */
function aaInboxMediaInlineStyle(type = '') {
  const kind = String(type || '').trim().toLowerCase();
  const isSticker = kind === 'sticker';

  return {
    display: 'block',
    width: 'auto',
    height: 'auto',
    maxWidth: isSticker ? '120px' : '240px',
    maxHeight: isSticker ? '120px' : '180px',
    minWidth: '0px',
    objectFit: 'contain',
    borderRadius: isSticker ? '0px' : '8px',
    background: 'transparent',
    verticalAlign: 'top',
  
    objectPosition: 'center',};
}
/* END __AUTOATENDE_INBOX_WHATSAPP_CLEAN_V11_B_MEDIA_STYLE__ */

function getMediaFilename(message) {
  const mediaObject =
    message?.raw?.[message?.type] || {};

  return firstText(
    message?.meta?.filename,
    message?.meta?.file_name,
    mediaObject?.filename,
    mediaObject?.file_name,
    `arquivo-${message?.id || 'whatsapp'}`
  );
}


/* __AUTOATENDE_OUTBOUND_MEDIA_PHASE2D_R2__ */
const AA_OUTBOUND_MEDIA_VERSION =
  '__AUTOATENDE_OUTBOUND_MEDIA_PHASE2D_R2__';

/* __AUTOATENDE_AUDIO_ATTACHMENT_PHASE4A__ */

/* __AUTOATENDE_VOICE_RECORDER_PHASE4B2__ */
const AA_VOICE_RECORDER_VERSION =
  '__AUTOATENDE_VOICE_RECORDER_PHASE4B2__';

const AA_VOICE_MAX_SECONDS = 300;

const AA_VOICE_MAX_BYTES =
  16 * 1024 * 1024;

function aaSelectVoiceRecorderMimeType() {
  if (
    typeof MediaRecorder === 'undefined'
  ) {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];

  for (const candidate of candidates) {
    try {
      if (
        typeof MediaRecorder
          .isTypeSupported !== 'function' ||
        MediaRecorder.isTypeSupported(
          candidate
        )
      ) {
        return candidate;
      }
    } catch (_) {
      // Testa o próximo formato.
    }
  }

  return '';
}

function aaVoiceFileExtension(
  mimeType
) {
  const normalized = String(
    mimeType || ''
  ).toLowerCase();

  if (normalized.includes('ogg')) {
    return 'ogg';
  }

  if (normalized.includes('mp4')) {
    return 'm4a';
  }

  return 'webm';
}

function aaFormatVoiceDuration(
  seconds
) {
  const total = Math.max(
    0,
    Math.floor(
      Number(seconds || 0)
    )
  );

  const minutes =
    Math.floor(total / 60);

  const remainder =
    total % 60;

  return (
    String(minutes)
      .padStart(2, '0') +
    ':' +
    String(remainder)
      .padStart(2, '0')
  );
}
/* END __AUTOATENDE_VOICE_RECORDER_PHASE4B2__ */


const AA_OUTBOUND_MEDIA_ACCEPT =
  [
    'image/jpeg',
    'image/png',
    'video/mp4',
    'video/3gpp',

    'audio/aac',
    'audio/amr',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',

    '.aac',
    '.amr',
    '.mp3',
    '.m4a',
    '.ogg',

    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'application/rtf',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ].join(',');

const AA_OUTBOUND_MEDIA_LIMITS = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 95 * 1024 * 1024,
};

function aaResolveOutboundMediaKind(file) {
  const mime = String(
    file?.type || ''
  ).toLowerCase();

  if (
    mime === 'image/jpeg' ||
    mime === 'image/png'
  ) {
    return 'image';
  }

  if (
    mime === 'video/mp4' ||
    mime === 'video/3gpp'
  ) {
    return 'video';
  }

  const filename =
    String(
      file?.name || ''
    ).toLowerCase();

  if (
    [
      'audio/aac',
      'audio/amr',
      'audio/mpeg',
      'audio/mp3',
      'audio/x-mp3',
      'audio/mp4',
      'audio/x-m4a',
      'audio/ogg',
      'application/ogg',
    ].includes(mime) ||
    /\.(aac|amr|mp3|m4a|ogg)$/i
      .test(filename)
  ) {
    return 'audio';
  }

  if (
    mime &&
    AA_OUTBOUND_MEDIA_ACCEPT
      .split(',')
      .includes(mime)
  ) {
    return 'document';
  }

  return '';
}

function aaFormatOutboundFileSize(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return (
    `${(
      size /
      1024 /
      1024
    ).toFixed(1)} MB`
  );
}

function aaOutboundMediaLabel(kind) {
  if (kind === 'image') {
    return 'Foto';
  }

  if (kind === 'video') {
    return 'Vídeo';
  }

  if (kind === 'audio') {
    return 'Áudio';
  }

  return 'Documento';
}
/* END __AUTOATENDE_OUTBOUND_MEDIA_PHASE2D_R2__ */

function AuthenticatedMedia({
  message,
  accessToken,
}) {

  /* __AUTOATENDE_USE_INBOUND_IMAGE_AS_AVATAR_V1__ */
  const AA_USE_INBOUND_IMAGE_AS_AVATAR_MARKER =
    '__AUTOATENDE_USE_INBOUND_IMAGE_AS_AVATAR_V1__';

  const [aaUseAsAvatarBusy, setAaUseAsAvatarBusy] =
    useState(false);

  const [aaUseAsAvatarMessage, setAaUseAsAvatarMessage] =
    useState('');

  const [aaUseAsAvatarMessageKind, setAaUseAsAvatarMessageKind] =
    useState('');

  const [objectUrl, setObjectUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (
      !message?.id ||
      !accessToken ||
      !MEDIA_TYPES.has(message.type)
    ) {
      setLoading(false);
      setFailed(true);
      return undefined;
    }

    const controller = new AbortController();
    let generatedUrl = '';

    const load = async () => {
      setLoading(true);
      setFailed(false);

      try {
        const response = await fetch(
          `/api/inbox/messages/${encodeURIComponent(message.id)}/media`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `MEDIA_HTTP_${response.status}`
          );
        }

        const blob = await response.blob();

        generatedUrl = URL.createObjectURL(blob);
        setObjectUrl(generatedUrl);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setFailed(true);
        }
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      controller.abort();

      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [
    message?.id,
    message?.type,
    accessToken,
  ]);


  const aaDirection = String(
    firstText(
      message?.direction,
      message?.raw?.direction,
      message?.meta?.direction
    ) || ''
  )
    .trim()
    .toLowerCase();

  const aaSenderType = String(
    firstText(
      message?.senderType,
      message?.sender_type,
      message?.raw?.sender_type,
      message?.meta?.sender_type
    ) || ''
  )
    .trim()
    .toLowerCase();

  const aaFromMe =
    message?.fromMe ??
    message?.from_me ??
    message?.raw?.from_me ??
    message?.meta?.from_me ??
    null;

  const aaOutboundFlag =
    message?.outbound ??
    message?.isOutbound ??
    message?.is_outbound ??
    null;

  const aaExplicitOutbound =
    aaDirection === 'outbound' ||
    aaSenderType === 'human' ||
    aaSenderType === 'agent' ||
    aaSenderType === 'bot' ||
    aaFromMe === true ||
    aaOutboundFlag === true;

  const aaExplicitInbound =
    aaDirection === 'inbound' ||
    aaSenderType === 'customer' ||
    aaFromMe === false ||
    aaOutboundFlag === false;

  const aaCanUseAsAvatar =
    message?.type === 'image' &&
    aaExplicitInbound &&
    !aaExplicitOutbound;

  const aaHandleUseAsAvatar = async () => {
    if (
      !aaCanUseAsAvatar ||
      aaUseAsAvatarBusy
    ) {
      return;
    }

    if (!accessToken) {
      setAaUseAsAvatarMessage(
        'Sua sessão expirou. Entre novamente para continuar.'
      );
      setAaUseAsAvatarMessageKind('error');
      return;
    }

    if (!message?.id) {
      setAaUseAsAvatarMessage(
        'Esta imagem não possui identificação válida.'
      );
      setAaUseAsAvatarMessageKind('error');
      return;
    }

    setAaUseAsAvatarBusy(true);
    setAaUseAsAvatarMessage('');
    setAaUseAsAvatarMessageKind('');

    try {
      const mediaEndpoint =
        `/api/inbox/messages/${encodeURIComponent(
          message.id
        )}/media`;

      const mediaResponse = await fetch(
        mediaEndpoint,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          credentials: 'same-origin',
          cache: 'no-store',
        }
      );

      if (!mediaResponse.ok) {
        throw new Error(
          'Não foi possível carregar esta imagem.'
        );
      }

      const blob = await mediaResponse.blob();
      const normalizedMime = String(
        blob.type || ''
      )
        .split(';')[0]
        .trim()
        .toLowerCase();

      const allowedTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
      ]);

      if (!allowedTypes.has(normalizedMime)) {
        throw new Error(
          'A imagem precisa ser JPEG, PNG ou WebP.'
        );
      }

      if (blob.size > 5 * 1024 * 1024) {
        throw new Error(
          'A imagem deve ter no máximo 5 MB.'
        );
      }

      const result = await new Promise(
        (resolve, reject) => {
          let settled = false;

          const timeout = window.setTimeout(
            () => {
              if (settled) {
                return;
              }

              settled = true;
              reject(
                new Error(
                  'A atualização da foto demorou mais que o esperado.'
                )
              );
            },
            300000
          );

          const complete = (payload = {}) => {
            if (settled) {
              return;
            }

            settled = true;
            window.clearTimeout(timeout);

            if (
              payload?.ok ||
              payload?.cancelled
            ) {
              resolve(payload);
              return;
            }

            reject(
              new Error(
                payload?.message ||
                'Não foi possível usar a imagem como foto.'
              )
            );
          };

          window.dispatchEvent(
            new CustomEvent(
              'aa-use-inbound-image-as-avatar-request',
              {
                detail: {
                  blob,
                  messageId: message.id,
                  complete,
                },
              }
            )
          );
        }
      );

      if (result?.cancelled) {
        setAaUseAsAvatarMessage('');
        setAaUseAsAvatarMessageKind('');
        return;
      }

      setAaUseAsAvatarMessage(
        result?.message ||
        'Foto do contato atualizada.'
      );
      setAaUseAsAvatarMessageKind('success');
    } catch (error) {
      setAaUseAsAvatarMessage(
        error?.message ||
        'Não foi possível usar a imagem como foto.'
      );
      setAaUseAsAvatarMessageKind('error');
    } finally {
      setAaUseAsAvatarBusy(false);
    }
  };

  if (loading) {
    return (
      <span className={styles.mediaLoading}>
        <Loader2 aria-hidden="true" />
        Carregando mídia…
      </span>
    );
  }

  if (failed || !objectUrl) {
    return (
      <span className={styles.mediaUnavailable}>
        <AlertCircle aria-hidden="true" />
        Mídia indisponível
      </span>
    );
  }

  if (
    message.type === 'image' ||
    message.type === 'sticker'
  ) {
    return (
      <span
          className={styles.mediaVisual}
          data-aa-native-media-kind={message.type === 'sticker' ? 'sticker' : 'image'}
        >
        <img
        data-aa-inbox-media-image="true"
        data-aa-inbox-media-renderer="v11-b"
        data-aa-inbox-media-kind={message.type}
        style={aaInboxMediaInlineStyle(message.type)}
          data-aa-chat-media-image="true"
          src={objectUrl}
          alt={
            message.type === 'sticker'
              ? 'Figurinha recebida'
              : 'Imagem recebida'
          }
        />

        {message.type !== 'sticker' ? (
          <span
            className={styles.mediaImageActions}
            data-aa-use-image-as-avatar={
              '__AUTOATENDE_USE_INBOUND_IMAGE_AS_AVATAR_V1__'
            }
          >
            <a
              href={objectUrl}
              download={getMediaFilename(message)}
            >
              Baixar imagem
            </a>

            {aaCanUseAsAvatar ? (
              <button
                type="button"
                className={styles.mediaUseAsAvatarAction}
                onClick={aaHandleUseAsAvatar}
                disabled={aaUseAsAvatarBusy}
              >
                {aaUseAsAvatarBusy
                  ? 'Salvando…'
                  : 'Usar como foto'}
              </button>
            ) : null}
          </span>
        ) : null}

        {aaUseAsAvatarMessage ? (
          <small
            className={cx(
              styles.mediaUseAsAvatarMessage,
              aaUseAsAvatarMessageKind === 'error'
                ? styles.mediaUseAsAvatarMessageError
                : styles.mediaUseAsAvatarMessageSuccess
            )}
            role={
              aaUseAsAvatarMessageKind === 'error'
                ? 'alert'
                : 'status'
            }
          >
            {aaUseAsAvatarMessage}
          </small>
        ) : null}
      </span>
    );
  }

  if (message.type === 'video') {
    return (
      <span
          className={styles.mediaVisual}
          data-aa-native-media-kind="video"
        >
        <video
          src={objectUrl}
          controls
          preload="metadata"
        />

        <a
          href={objectUrl}
          download={getMediaFilename(message)}
        >
          Baixar vídeo
        </a>
      </span>
    );
  }

  if (message.type === 'audio') {
    return (
      <span className={styles.mediaAudio}>
        <audio
          src={objectUrl}
          controls
          preload="metadata"
        />
      </span>
    );
  }

  return (
    <a
      className={styles.mediaDocument}
      href={objectUrl}
      download={getMediaFilename(message)}
    >
      <FileText aria-hidden="true" />

      <span>
        <strong>
          {getMediaFilename(message)}
        </strong>
        <small>Baixar documento</small>
      </span>
    </a>
  );
}

/* END __AUTOATENDE_USE_INBOUND_IMAGE_AS_AVATAR_V1__ */

/* __AUTOATENDE_MEDIA_CLEAN_THREAD_MENU_V1_3__ */

function aaHumanizeMediaPreviewText(
  value
) {
  const text = String(
    value || ''
  ).trim();

  if (!text) {
    return '';
  }

  const normalized =
    text.toLowerCase();

  const exactLabels = {
    '[imagem]': 'Foto',
    '[image]': 'Foto',
    '[foto]': 'Foto',

    '[áudio]': 'Áudio',
    '[audio]': 'Áudio',
    '[voice]': 'Mensagem de voz',

    '[vídeo]': 'Vídeo',
    '[video]': 'Vídeo',

    '[figurinha]': 'Figurinha',
    '[sticker]': 'Figurinha',

    '[documento]': 'Documento',
    '[document]': 'Documento',
  };

  if (
    Object.prototype.hasOwnProperty.call(
      exactLabels,
      normalized
    )
  ) {
    return exactLabels[normalized];
  }

  const documentMatch =
    text.match(
      /^\[(?:documento|document)\]\s*(.*)$/i
    );

  if (documentMatch) {
    const filename =
      String(
        documentMatch[1] || ''
      ).trim();

    return filename
      ? `Documento · ${filename}`
      : 'Documento';
  }

  return text;
}

function aaGetVisibleMediaCaption(
  message
) {
  const type = String(
    message?.type || ''
  )
    .trim()
    .toLowerCase();

  const mediaObject =
    message?.raw?.[type] ||
    message?.raw?.message?.[type] ||
    {};

  const caption = String(
    firstText(
      message?.meta?.caption,
      mediaObject?.caption,
      message?.text
    ) || ''
  ).trim();

  if (!caption) {
    return '';
  }

  const normalized =
    caption.toLowerCase();

  const technicalLabels = {
    image: new Set([
      '[imagem]',
      '[image]',
      '[foto]',
      'imagem',
      'foto',
    ]),

    video: new Set([
      '[vídeo]',
      '[video]',
      'vídeo',
      'video',
    ]),

    audio: new Set([
      '[áudio]',
      '[audio]',
      '[voice]',
      'áudio',
      'audio',
    ]),

    sticker: new Set([
      '[figurinha]',
      '[sticker]',
      'figurinha',
      'sticker',
    ]),

    document: new Set([
      '[documento]',
      '[document]',
      'documento',
      'document',
    ]),
  };

  if (
    technicalLabels[type]
      ?.has(normalized)
  ) {
    return '';
  }

  if (
    type === 'document' &&
    /^\[(?:documento|document)\](?:\s+.*)?$/i
      .test(caption)
  ) {
    return '';
  }

  if (type === 'document') {
    const filename = String(
      firstText(
        mediaObject?.filename,
        message?.meta?.filename
      ) || ''
    ).trim();

    if (
      filename &&
      filename.toLowerCase() ===
        normalized
    ) {
      return '';
    }
  }

  return caption;
}

function MessageBody({
  message,
  accessToken,
}) {
  if (MEDIA_TYPES.has(message.type)) {
    const icon =
      message.type === 'image' ||
      message.type === 'sticker'
        ? <ImageIcon aria-hidden="true" />
        : message.type === 'video'
          ? <VideoIcon aria-hidden="true" />
          : message.type === 'audio'
            ? <Volume2 aria-hidden="true" />
            : <FileText aria-hidden="true" />;

    const visibleCaption =
      aaGetVisibleMediaCaption(message);

    return (
      <>
        <span
          className={styles.mediaKind}
          data-aa-media-label={message.type}
        >
          {icon}
          {aaInboxMediaLabel(message.type)}
        </span>

        <AuthenticatedMedia
          message={message}
          accessToken={accessToken}
        />

        {visibleCaption ? (
          <p>{visibleCaption}</p>
        ) : null}
      </>
    );
  }

  if (
    message.type === 'contacts' ||
    message.type === 'contact'
  ) {
    const contacts =
      message?.raw?.contacts ||
      message?.meta?.contacts ||
      [];

    const contact = Array.isArray(
      contacts
    )
      ? contacts[0]
      : null;

    const contactName = firstText(
      contact?.name?.formatted_name,
      contact?.name?.first_name,
      message.text,
      'Contato compartilhado'
    );

    const contactPhone = firstText(
      contact?.phones?.[0]?.phone,
      contact?.phones?.[0]?.wa_id
    );

    return (
      <span className={styles.sharedContact}>
        <User aria-hidden="true" />

        <span>
          <strong>{contactName}</strong>

          <small>
            {contactPhone ||
              'Contato do WhatsApp'}
          </small>
        </span>
      </span>
    );
  }

  return (
    <p>
      {message.text ||
        'Mensagem sem conteúdo'}
    </p>
  );
}

function isVisible(element) {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity || 1) > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function resolvePortalBounds() {
  const selectors = [
    '.aa-shell-v2-sidebar',
    '[data-aa-shell-sidebar]',
    '.aa-app-sidebar',
    'aside',
  ];

  let left = 0;

  for (const selector of selectors) {
    const elements = Array.from(
      document.querySelectorAll(selector)
    );

    for (const element of elements) {
      if (!isVisible(element)) {
        continue;
      }

      const rect = element.getBoundingClientRect();

      if (
        rect.left <= 4 &&
        rect.height >= window.innerHeight * 0.6
      ) {
        left = Math.max(
          left,
          Math.round(rect.right)
        );
      }
    }
  }

  return {
    left,
    top: 0,
  };
}

/* __AUTOATENDE_AVATAR_CROP_V1__ */
const AA_AVATAR_CROP_MARKER =
  '__AUTOATENDE_AVATAR_CROP_V1__';

function AvatarCropModal({
  sourceUrl,
  sourceLabel,
  busy,
  errorMessage,
  onCancel,
  onSave,
}) {
  const viewportRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);

  const [imageMeta, setImageMeta] =
    useState(null);

  const [zoom, setZoom] =
    useState(1);

  const [offset, setOffset] =
    useState({
      x: 0,
      y: 0,
    });

  const [ready, setReady] =
    useState(false);

  useEffect(() => {
    setImageMeta(null);
    setZoom(1);
    setOffset({
      x: 0,
      y: 0,
    });
    setReady(false);
  }, [sourceUrl]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === 'Escape' &&
        !busy
      ) {
        onCancel?.();
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [
    busy,
    onCancel,
  ]);

  const getMetrics = (
    nextZoom = zoom,
    nextMeta = imageMeta
  ) => {
    const viewport =
      viewportRef.current;

    if (
      !viewport ||
      !nextMeta?.width ||
      !nextMeta?.height
    ) {
      return null;
    }

    const stageSize =
      viewport.clientWidth;

    const baseScale = Math.max(
      stageSize / nextMeta.width,
      stageSize / nextMeta.height
    );

    const displayWidth =
      nextMeta.width *
      baseScale *
      nextZoom;

    const displayHeight =
      nextMeta.height *
      baseScale *
      nextZoom;

    return {
      stageSize,
      baseScale,
      displayWidth,
      displayHeight,
    };
  };

  const clampOffset = (
    nextOffset,
    nextZoom = zoom,
    nextMeta = imageMeta
  ) => {
    const metrics =
      getMetrics(
        nextZoom,
        nextMeta
      );

    if (!metrics) {
      return {
        x: 0,
        y: 0,
      };
    }

    const maxX = Math.max(
      0,
      (
        metrics.displayWidth -
        metrics.stageSize
      ) / 2
    );

    const maxY = Math.max(
      0,
      (
        metrics.displayHeight -
        metrics.stageSize
      ) / 2
    );

    return {
      x: Math.max(
        -maxX,
        Math.min(
          maxX,
          Number(nextOffset?.x) || 0
        )
      ),

      y: Math.max(
        -maxY,
        Math.min(
          maxY,
          Number(nextOffset?.y) || 0
        )
      ),
    };
  };

  const handleImageLoad = (event) => {
    const nextMeta = {
      width:
        event.currentTarget.naturalWidth,

      height:
        event.currentTarget.naturalHeight,
    };

    setImageMeta(nextMeta);
    setZoom(1);
    setOffset(
      clampOffset(
        {
          x: 0,
          y: 0,
        },
        1,
        nextMeta
      )
    );
    setReady(true);
  };

  const handleZoomChange = (event) => {
    const nextZoom =
      Number(event.target.value) || 1;

    setZoom(nextZoom);

    setOffset((current) =>
      clampOffset(
        current,
        nextZoom,
        imageMeta
      )
    );
  };

  const handlePointerDown = (event) => {
    if (
      busy ||
      !ready
    ) {
      return;
    }

    event.preventDefault();

    event.currentTarget
      .setPointerCapture?.(
        event.pointerId
      );

    dragRef.current = {
      pointerId:
        event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      offsetX:
        offset.x,

      offsetY:
        offset.y,
    };
  };

  const handlePointerMove = (event) => {
    const drag =
      dragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    setOffset(
      clampOffset({
        x:
          drag.offsetX +
          event.clientX -
          drag.startX,

        y:
          drag.offsetY +
          event.clientY -
          drag.startY,
      })
    );
  };

  const handlePointerEnd = (event) => {
    const drag =
      dragRef.current;

    if (
      drag?.pointerId ===
      event.pointerId
    ) {
      dragRef.current = null;

      event.currentTarget
        .releasePointerCapture?.(
          event.pointerId
        );
    }
  };

  const handleSave = async () => {
    const viewport =
      viewportRef.current;

    const image =
      imageRef.current;

    const metrics =
      getMetrics();

    if (
      !viewport ||
      !image ||
      !metrics ||
      !ready
    ) {
      return;
    }

    const sourceX =
      (
        (
          metrics.displayWidth -
          metrics.stageSize
        ) / 2 -
        offset.x
      ) /
      metrics.displayWidth *
      image.naturalWidth;

    const sourceY =
      (
        (
          metrics.displayHeight -
          metrics.stageSize
        ) / 2 -
        offset.y
      ) /
      metrics.displayHeight *
      image.naturalHeight;

    const sourceWidth =
      metrics.stageSize /
      metrics.displayWidth *
      image.naturalWidth;

    const sourceHeight =
      metrics.stageSize /
      metrics.displayHeight *
      image.naturalHeight;

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width = 512;
    canvas.height = 512;

    const context =
      canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'Não foi possível preparar o recorte.'
      );
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.drawImage(
      image,

      Math.max(
        0,
        sourceX
      ),

      Math.max(
        0,
        sourceY
      ),

      Math.min(
        sourceWidth,
        image.naturalWidth
      ),

      Math.min(
        sourceHeight,
        image.naturalHeight
      ),

      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob =
      await new Promise(
        (resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) {
                resolve(result);
                return;
              }

              reject(
                new Error(
                  'Não foi possível gerar a foto recortada.'
                )
              );
            },
            'image/png'
          );
        }
      );

    await onSave?.(blob);
  };

  const metrics =
    getMetrics();

  return (
    <div
      className={styles.avatarCropBackdrop}
      role="presentation"
      data-aa-avatar-crop={
        AA_AVATAR_CROP_MARKER
      }
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !busy
        ) {
          onCancel?.();
        }
      }}
    >
      <section
        className={styles.avatarCropModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aa-avatar-crop-title"
      >
        <header
          className={styles.avatarCropHeader}
        >
          <div>
            <span>Foto do contato</span>

            <h2 id="aa-avatar-crop-title">
              Ajustar enquadramento
            </h2>

            <p>
              Arraste a imagem e use o zoom
              para escolher a área que aparecerá
              no avatar circular.
            </p>
          </div>

          <button
            type="button"
            className={styles.avatarCropClose}
            aria-label="Fechar recorte"
            title="Fechar"
            disabled={busy}
            onClick={onCancel}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div
          className={styles.avatarCropContent}
        >
          <div
            ref={viewportRef}
            className={cx(
              styles.avatarCropViewport,
              ready &&
                styles.avatarCropViewportReady
            )}
            aria-label="Área de recorte da foto"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={
              handlePointerEnd
            }
          >
            <img
              ref={imageRef}
              className={styles.avatarCropImage}
              src={sourceUrl}
              alt=""
              draggable="false"
              onLoad={handleImageLoad}
              style={
                metrics
                  ? {
                      width:
                        `${metrics.displayWidth}px`,

                      height:
                        `${metrics.displayHeight}px`,

                      transform:
                        `translate(-50%, -50%) ` +
                        `translate(${offset.x}px, ${offset.y}px)`,
                    }
                  : undefined
              }
            />

            {!ready ? (
              <span
                className={styles.avatarCropLoading}
              >
                <Loader2
                  aria-hidden="true"
                  className={styles.spinning}
                />

                Preparando imagem…
              </span>
            ) : null}

            <span
              className={styles.avatarCropGuide}
              aria-hidden="true"
            />
          </div>

          <div
            className={styles.avatarCropControls}
          >
            <label
              className={styles.avatarCropZoom}
            >
              <span>
                <strong>Zoom</strong>
                <small>
                  {Math.round(zoom * 100)}%
                </small>
              </span>

              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                disabled={
                  busy ||
                  !ready
                }
                onChange={handleZoomChange}
              />
            </label>

            <button
              type="button"
              className={styles.avatarCropReset}
              disabled={
                busy ||
                !ready
              }
              onClick={() => {
                setZoom(1);
                setOffset({
                  x: 0,
                  y: 0,
                });
              }}
            >
              Centralizar
            </button>
          </div>

          <small
            className={styles.avatarCropSource}
          >
            {sourceLabel ||
              'Imagem selecionada'}
            {' · '}
            saída quadrada de 512 × 512 px
          </small>

          {errorMessage ? (
            <div
              className={styles.avatarCropError}
              role="alert"
            >
              <AlertCircle
                aria-hidden="true"
              />
              {errorMessage}
            </div>
          ) : null}
        </div>

        <footer
          className={styles.avatarCropFooter}
        >
          <button
            type="button"
            className={styles.avatarCropCancel}
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={styles.avatarCropSave}
            disabled={
              busy ||
              !ready
            }
            onClick={handleSave}
          >
            {busy ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className={styles.spinning}
                />
                Salvando…
              </>
            ) : (
              'Salvar foto'
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
/* END __AUTOATENDE_AVATAR_CROP_V1__ */

/* __AUTOATENDE_CONTACT_AVATAR_LIVE_SYNC_V1__ */
const AA_CONTACT_AVATAR_LIVE_SYNC_MARKER =
  '__AUTOATENDE_CONTACT_AVATAR_LIVE_SYNC_V1__';

const AA_CONTACT_AVATAR_SYNC_CHANNEL =
  'autoatende-contact-avatar-v1';

const AA_CONTACT_AVATAR_SYNC_STORAGE_KEY =
  '__autoatende_contact_avatar_sync_v1__';

const AA_CONTACT_AVATAR_SYNC_EVENT =
  'aa-contact-avatar-sync-v1';

function aaNormalizeContactAvatarSyncPayload(
  candidate = {}
) {
  const conversationId = String(
    candidate?.conversationId ||
    candidate?.conversation_id ||
    ''
  ).trim();

  if (!conversationId) {
    return null;
  }

  const rawVersion = Number(
    candidate?.version ||
    candidate?.timestamp ||
    Date.now()
  );

  const version =
    Number.isFinite(rawVersion) &&
    rawVersion > 0
      ? rawVersion
      : Date.now();

  const action =
    candidate?.action === 'remove'
      ? 'remove'
      : 'upsert';

  const nonce = String(
    candidate?.nonce ||
    `${version}-${conversationId}-${action}`
  );

  return {
    marker:
      AA_CONTACT_AVATAR_LIVE_SYNC_MARKER,
    conversationId,
    action,
    version,
    nonce,
  };
}

function aaPublishContactAvatarSync({
  conversationId,
  action = 'upsert',
} = {}) {
  if (typeof window === 'undefined') {
    return null;
  }

  const version = Date.now();

  const nonce =
    window.crypto?.randomUUID?.() ||
    `${version}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const payload =
    aaNormalizeContactAvatarSyncPayload({
      conversationId,
      action,
      version,
      nonce,
    });

  if (!payload) {
    return null;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(
        AA_CONTACT_AVATAR_SYNC_EVENT,
        {
          detail: payload,
        }
      )
    );
  } catch (_) {}

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(
        AA_CONTACT_AVATAR_SYNC_CHANNEL
      );

      channel.postMessage(payload);
      channel.close();
    }
  } catch (_) {}

  try {
    window.localStorage.setItem(
      AA_CONTACT_AVATAR_SYNC_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch (_) {}

  return payload;
}

function aaSubscribeContactAvatarSync(
  onPayload
) {
  if (
    typeof window === 'undefined' ||
    typeof onPayload !== 'function'
  ) {
    return () => {};
  }

  const seenNonces = new Set();
  let channel = null;

  const deliver = (candidate) => {
    const payload =
      aaNormalizeContactAvatarSyncPayload(
        candidate
      );

    if (!payload) {
      return;
    }

    if (seenNonces.has(payload.nonce)) {
      return;
    }

    if (seenNonces.size >= 128) {
      seenNonces.clear();
    }

    seenNonces.add(payload.nonce);
    onPayload(payload);
  };

  const handleCustomEvent = (event) => {
    deliver(event?.detail);
  };

  const handleStorage = (event) => {
    if (
      event?.key !==
        AA_CONTACT_AVATAR_SYNC_STORAGE_KEY ||
      !event?.newValue
    ) {
      return;
    }

    try {
      deliver(JSON.parse(event.newValue));
    } catch (_) {}
  };

  window.addEventListener(
    AA_CONTACT_AVATAR_SYNC_EVENT,
    handleCustomEvent
  );

  window.addEventListener(
    'storage',
    handleStorage
  );

  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(
        AA_CONTACT_AVATAR_SYNC_CHANNEL
      );

      channel.addEventListener(
        'message',
        (event) => {
          deliver(event?.data);
        }
      );
    }
  } catch (_) {
    channel = null;
  }

  return () => {
    window.removeEventListener(
      AA_CONTACT_AVATAR_SYNC_EVENT,
      handleCustomEvent
    );

    window.removeEventListener(
      'storage',
      handleStorage
    );

    try {
      channel?.close();
    } catch (_) {}
  };
}
/* END __AUTOATENDE_CONTACT_AVATAR_LIVE_SYNC_V1__ */


/* __AUTOATENDE_CONTACT_INTERNAL_NOTES_LIVE_SYNC_V1__ */
const AA_CONTACT_INTERNAL_NOTE_SYNC_MARKER =
  '__AUTOATENDE_CONTACT_INTERNAL_NOTES_LIVE_SYNC_V1__';

const AA_CONTACT_INTERNAL_NOTE_SYNC_CHANNEL =
  'autoatende-contact-internal-note-sync-v1';

const AA_CONTACT_INTERNAL_NOTE_SYNC_STORAGE_KEY =
  '__autoatende_contact_internal_note_sync_v1__';

const AA_CONTACT_INTERNAL_NOTE_SYNC_EVENT =
  'aa-contact-internal-note-sync-v1';

let aaContactInternalNoteSyncSequence = 0;

function aaCreateContactInternalNoteSyncSource() {
  const timestamp = Date.now();

  return (
    (
      typeof window !== 'undefined' &&
      window.crypto?.randomUUID?.()
    ) ||
    `note-source-${timestamp}-${Math.random()
      .toString(36)
      .slice(2)}`
  );
}

function aaNormalizeContactInternalNoteSyncPayload(
  candidate = {}
) {
  const conversationId = String(
    candidate?.conversationId ||
    candidate?.conversation_id ||
    ''
  ).trim();

  if (!conversationId) {
    return null;
  }

  const action =
    String(candidate?.action || '')
      .trim()
      .toLowerCase() === 'remove'
      ? 'remove'
      : 'upsert';

  const rawVersion = Number(
    candidate?.version ||
    candidate?.timestamp ||
    Date.now()
  );

  const version =
    Number.isFinite(rawVersion) &&
    rawVersion > 0
      ? rawVersion
      : Date.now();

  const nonce = String(
    candidate?.nonce ||
    `${version}-${Math.random()
      .toString(36)
      .slice(2)}`
  ).trim();

  const source = String(
    candidate?.source ||
    candidate?.sourceInstanceId ||
    ''
  ).trim();

  return {
    marker:
      AA_CONTACT_INTERNAL_NOTE_SYNC_MARKER,
    conversationId,
    action,
    updatedAt:
      candidate?.updatedAt ||
      candidate?.updated_at ||
      null,
    version,
    nonce,
    source,
  };
}

function aaPublishContactInternalNoteSync({
  conversationId,
  action = 'upsert',
  updatedAt = null,
  source = '',
} = {}) {
  if (typeof window === 'undefined') {
    return null;
  }

  aaContactInternalNoteSyncSequence =
    (
      aaContactInternalNoteSyncSequence +
      1
    ) % 1000;

  const version =
    Date.now() * 1000 +
    aaContactInternalNoteSyncSequence;

  const payload =
    aaNormalizeContactInternalNoteSyncPayload({
      conversationId,
      action,
      updatedAt,
      version,
      nonce:
        window.crypto?.randomUUID?.() ||
        `${version}-${Math.random()
          .toString(36)
          .slice(2)}`,
      source,
    });

  if (!payload) {
    return null;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(
        AA_CONTACT_INTERNAL_NOTE_SYNC_EVENT,
        { detail: payload }
      )
    );
  } catch (_) {}

  try {
    if ('BroadcastChannel' in window) {
      const channel =
        new BroadcastChannel(
          AA_CONTACT_INTERNAL_NOTE_SYNC_CHANNEL
        );

      channel.postMessage(payload);
      channel.close();
    }
  } catch (_) {}

  try {
    window.localStorage.setItem(
      AA_CONTACT_INTERNAL_NOTE_SYNC_STORAGE_KEY,
      JSON.stringify(payload)
    );

    window.localStorage.removeItem(
      AA_CONTACT_INTERNAL_NOTE_SYNC_STORAGE_KEY
    );
  } catch (_) {}

  return payload;
}

function aaSubscribeContactInternalNoteSync(
  onPayload
) {
  if (
    typeof window === 'undefined' ||
    typeof onPayload !== 'function'
  ) {
    return () => {};
  }

  const seenNonces = new Set();
  const lastVersions = new Map();
  let channel = null;

  const deliver = (candidate) => {
    const payload =
      aaNormalizeContactInternalNoteSyncPayload(
        candidate
      );

    if (!payload?.nonce) {
      return;
    }

    if (seenNonces.has(payload.nonce)) {
      return;
    }

    const previousVersion =
      Number(
        lastVersions.get(
          payload.conversationId
        ) || 0
      );

    if (
      Number.isFinite(previousVersion) &&
      payload.version < previousVersion
    ) {
      return;
    }

    if (seenNonces.size >= 256) {
      seenNonces.clear();
    }

    if (lastVersions.size >= 256) {
      lastVersions.clear();
    }

    seenNonces.add(payload.nonce);

    lastVersions.set(
      payload.conversationId,
      payload.version
    );

    onPayload(payload);
  };

  const handleCustomEvent = (event) => {
    deliver(event?.detail);
  };

  const handleStorage = (event) => {
    if (
      event?.key !==
        AA_CONTACT_INTERNAL_NOTE_SYNC_STORAGE_KEY ||
      !event?.newValue
    ) {
      return;
    }

    try {
      deliver(JSON.parse(event.newValue));
    } catch (_) {}
  };

  window.addEventListener(
    AA_CONTACT_INTERNAL_NOTE_SYNC_EVENT,
    handleCustomEvent
  );

  window.addEventListener(
    'storage',
    handleStorage
  );

  try {
    if ('BroadcastChannel' in window) {
      channel =
        new BroadcastChannel(
          AA_CONTACT_INTERNAL_NOTE_SYNC_CHANNEL
        );

      channel.addEventListener(
        'message',
        (event) => {
          deliver(event?.data);
        }
      );
    }
  } catch (_) {
    channel = null;
  }

  return () => {
    window.removeEventListener(
      AA_CONTACT_INTERNAL_NOTE_SYNC_EVENT,
      handleCustomEvent
    );

    window.removeEventListener(
      'storage',
      handleStorage
    );

    try {
      channel?.close();
    } catch (_) {}
  };
}
/* END __AUTOATENDE_CONTACT_INTERNAL_NOTES_LIVE_SYNC_V1__ */

/* __AUTOATENDE_CONTACT_FOLLOWUP_INBOX_V1__ */
function aaExtractContactFollowup(payload) {
  const candidate =
    payload?.followup ??
    payload?.pending_followup ??
    payload?.pendingFollowup ??
    payload?.item ??
    payload?.data ??
    null;

  return candidate && typeof candidate === 'object'
    ? candidate
    : null;
}

function aaContactFollowupIsoToLocalInput(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part) =>
    String(part).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function aaContactFollowupLocalInputToIso(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function aaFormatContactFollowupLocal(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function aaResolveContactFollowupVisualStatus(
  followup
) {
  if (
    !followup ||
    String(followup?.status || 'pending') !==
      'pending'
  ) {
    return {
      key: 'none',
      label: 'Sem retorno',
    };
  }

  const dueAt = new Date(followup?.due_at);

  if (Number.isNaN(dueAt.getTime())) {
    return {
      key: 'scheduled',
      label: 'Programado',
    };
  }

  const difference = dueAt.getTime() - Date.now();

  if (difference < 0) {
    return {
      key: 'overdue',
      label: 'Atrasado',
    };
  }

  if (difference <= 24 * 60 * 60 * 1000) {
    return {
      key: 'soon',
      label: 'Próximas 24h',
    };
  }

  return {
    key: 'scheduled',
    label: 'Programado',
  };
}
/* END __AUTOATENDE_CONTACT_FOLLOWUP_INBOX_V1__ */

function Inbox() {
  const { session } = useAuth();

  const accessToken =
    session?.access_token || '';

  const currentUserId =
    session?.user?.id || '';

  const [conversations, setConversations] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState('');

  const [messages, setMessages] =
    useState([]);

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  const [draft, setDraft] =
    useState('');

  const [emojiOpen, setEmojiOpen] =
    useState(false);

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const [followupDraftDueAt, setFollowupDraftDueAt] =
    useState('');
  const [followupSavedDueAt, setFollowupSavedDueAt] =
    useState('');
  const [followupDraftSummary, setFollowupDraftSummary] =
    useState('');
  const [followupSavedSummary, setFollowupSavedSummary] =
    useState('');
  const [followupRecord, setFollowupRecord] =
    useState(null);
  const [followupLoading, setFollowupLoading] =
    useState(false);
  const [followupSaving, setFollowupSaving] =
    useState(false);
  const [followupCanceling, setFollowupCanceling] =
    useState(false);
  const [followupCompleting, setFollowupCompleting] =
    useState(false);
  const [followupMessage, setFollowupMessage] =
    useState('');
  const [followupMessageKind, setFollowupMessageKind] =
    useState('');

  /* __AUTOATENDE_CONTACT_INTERNAL_NOTES_INBOX_V1__ */
  const [internalNoteDraft, setInternalNoteDraft] =
    useState('');
  const [internalNoteSavedContent, setInternalNoteSavedContent] =
    useState('');
  const [internalNoteRecord, setInternalNoteRecord] =
    useState(null);
  const [internalNoteLoading, setInternalNoteLoading] =
    useState(false);
  const [internalNoteSaving, setInternalNoteSaving] =
    useState(false);
  const [internalNoteDeleting, setInternalNoteDeleting] =
    useState(false);
  const [internalNoteMessage, setInternalNoteMessage] =
    useState('');
  const [internalNoteMessageKind, setInternalNoteMessageKind] =
    useState('');

  const [internalNoteSyncVersion, setInternalNoteSyncVersion] =
    useState(0);

  const [avatarVersion, setAvatarVersion] =
    useState(0);

  const [selectedAvatarExists, setSelectedAvatarExists] =
    useState(null);

  const [avatarBusy, setAvatarBusy] =
    useState(false);

  const [avatarMessage, setAvatarMessage] =
    useState('');

  const [avatarMessageKind, setAvatarMessageKind] =
    useState('');

  const [avatarCropSource, setAvatarCropSource] =
    useState(null);

  const [avatarCropSubmitting, setAvatarCropSubmitting] =
    useState(false);

  const [avatarCropError, setAvatarCropError] =
    useState('');

  const [loadingList, setLoadingList] =
    useState(true);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [attachmentOpen, setAttachmentOpen] =
    useState(false);

  const [mediaDraft, setMediaDraft] =
    useState(null);

  const [mediaSending, setMediaSending] =
    useState(false);

  const [isVoiceRecording, setIsVoiceRecording] =
    useState(false);

  const [voiceElapsedSeconds, setVoiceElapsedSeconds] =
    useState(0);

  const [voiceDraft, setVoiceDraft] =
    useState(null);

  const [voicePreviewUrl, setVoicePreviewUrl] =
    useState('');

  const [voiceSending, setVoiceSending] =
    useState(false);

  const [threadMenuOpen, setThreadMenuOpen] =
    useState(false);

  const [threadActionBusy, setThreadActionBusy] =
    useState(false);

  const [threadActionNotice, setThreadActionNotice] =
    useState('');

  const [mediaPreviewUrl, setMediaPreviewUrl] =
    useState('');

  const fileInputRef = useRef(null);

  const voiceRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceTimerRef = useRef(null);
  const voiceStartedAtRef = useRef(0);
  const voiceCancelledRef = useRef(false);
  const voiceUnmountedRef = useRef(false);
  const voiceConversationIdRef = useRef(null);

  const threadMenuRef = useRef(null);
  const threadMenuButtonRef = useRef(null);

  /* __AUTOATENDE_COMPOSER_OUTSIDE_DISMISS_V1__ */
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

  const attachmentMenuRef = useRef(null);
  const attachmentButtonRef = useRef(null);

  useEffect(() => {
    if (
      !emojiOpen &&
      !attachmentOpen
    ) {
      return undefined;
    }

    const handleOutsidePointerDown = (
      event
    ) => {
      const target = event.target;

      if (
        typeof Node !== 'undefined' &&
        !(target instanceof Node)
      ) {
        return;
      }

      const insideEmoji =
        Boolean(
          emojiPickerRef.current?.contains(
            target
          )
        ) ||
        Boolean(
          emojiButtonRef.current?.contains(
            target
          )
        );

      const insideAttachment =
        Boolean(
          attachmentMenuRef.current?.contains(
            target
          )
        ) ||
        Boolean(
          attachmentButtonRef.current?.contains(
            target
          )
        );

      if (!insideEmoji) {
        setEmojiOpen(false);
      }

      if (!insideAttachment) {
        setAttachmentOpen(false);
      }
    };

    const handleDismissKeyDown = (
      event
    ) => {
      if (event.key !== 'Escape') {
        return;
      }

      setEmojiOpen(false);
      setAttachmentOpen(false);
    };

    document.addEventListener(
      'pointerdown',
      handleOutsidePointerDown,
      true
    );

    document.addEventListener(
      'keydown',
      handleDismissKeyDown
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
        true
      );

      document.removeEventListener(
        'keydown',
        handleDismissKeyDown
      );
    };
  }, [
    emojiOpen,
    attachmentOpen,
  ]);
  /* END __AUTOATENDE_COMPOSER_OUTSIDE_DISMISS_V1__ */

  useEffect(() => {
    if (!voiceDraft?.file) {
      setVoicePreviewUrl('');
      return undefined;
    }

    const objectUrl =
      URL.createObjectURL(
        voiceDraft.file
      );

    setVoicePreviewUrl(
      objectUrl
    );

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [
    voiceDraft?.file,
  ]);

  useEffect(() => {
    voiceCancelledRef.current = true;

    if (voiceTimerRef.current) {
      window.clearInterval(
        voiceTimerRef.current
      );

      voiceTimerRef.current = null;
    }

    const recorder =
      voiceRecorderRef.current;

    if (
      recorder &&
      recorder.state !== 'inactive'
    ) {
      try {
        recorder.stop();
      } catch (_) {
        // Nenhuma ação adicional.
      }
    }

    const stream =
      voiceStreamRef.current;

    stream?.getTracks?.()
      ?.forEach((track) => {
        try {
          track.stop();
        } catch (_) {
          // Nenhuma ação adicional.
        }
      });

    voiceRecorderRef.current = null;
    voiceStreamRef.current = null;
    voiceChunksRef.current = [];

    setIsVoiceRecording(false);
    setVoiceElapsedSeconds(0);
    setVoiceDraft(null);
    setVoicePreviewUrl('');
  }, [
    selectedId,
  ]);

  useEffect(() => {
    voiceUnmountedRef.current = false;

    return () => {
      voiceUnmountedRef.current = true;
      voiceCancelledRef.current = true;

      if (voiceTimerRef.current) {
        window.clearInterval(
          voiceTimerRef.current
        );
      }

      const recorder =
        voiceRecorderRef.current;

      if (
        recorder &&
        recorder.state !== 'inactive'
      ) {
        try {
          recorder.stop();
        } catch (_) {
          // Nenhuma ação adicional.
        }
      }

      voiceStreamRef.current
        ?.getTracks?.()
        ?.forEach((track) => {
          try {
            track.stop();
          } catch (_) {
            // Nenhuma ação adicional.
          }
        });
    };
  }, []);


  useEffect(() => {
    if (
      !mediaDraft?.file ||
      mediaDraft.kind !== 'image'
    ) {
      setMediaPreviewUrl('');
      return undefined;
    }

    const objectUrl =
      URL.createObjectURL(
        mediaDraft.file
      );

    setMediaPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [
    mediaDraft?.file,
    mediaDraft?.kind,
  ]);

  useEffect(() => {
    setMediaDraft(null);
    setAttachmentOpen(false);
    setMediaPreviewUrl('');
  }, [
    selectedId,
  ]);


  const [listError, setListError] =
    useState('');

  const [messageError, setMessageError] =
    useState('');

  const [composerError, setComposerError] =
    useState('');

  /* __AUTOATENDE_INBOX_REAL_ACTIONS_V2_STATE__ */
  const [modeBusy, setModeBusy] =
    useState(false);

  const [modeError, setModeError] =
    useState('');

  const [labelEditorOpen, setLabelEditorOpen] =
    useState(false);

  const [labelDraft, setLabelDraft] =
    useState('');

  const [labelBusy, setLabelBusy] =
    useState(false);

  const [labelError, setLabelError] =
    useState('');

  const [bounds, setBounds] = useState({
    left: 246,
    top: 0,
  });

  const [viewportWidth, setViewportWidth] =
    useState(() => (
      typeof window === 'undefined'
        ? 1366
        : window.innerWidth
    ));

  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const selectedIdRef = useRef('');
  const listRequestRef = useRef(0);
  const messageRequestRef = useRef(0);
  const internalNoteRequestRef = useRef(0);
  const internalNoteAbortRef = useRef(null);
  const internalNoteConversationRef = useRef('');
  const internalNoteSyncSourceRef = useRef('');
  const followupRequestRef = useRef(0);
  const followupAbortRef = useRef(null);
  const followupConversationRef = useRef('');

  if (!internalNoteSyncSourceRef.current) {
    internalNoteSyncSourceRef.current =
      aaCreateContactInternalNoteSyncSource();
  }

  selectedIdRef.current = selectedId;

  const headers = useMemo(() => ({
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }), [accessToken]);

  const compact = viewportWidth < 1180;
  const narrow = viewportWidth < 920;

  const selectedConversation = useMemo(
    () => (
      conversations.find(
        (conversation) =>
          conversation.id === selectedId
      ) || null
    ),
    [conversations, selectedId]
  );


  /* __AUTOATENDE_INBOX_DIRECT_CONVERSATION_FROM_FOLLOWUP_V9__:BEGIN */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search || '');
    const requestedConversationId = String(
      params.get('aaConversationId') ||
      params.get('conversation_id') ||
      params.get('conversationId') ||
      ''
    ).trim();

    if (!requestedConversationId || !Array.isArray(conversations) || conversations.length === 0) {
      return;
    }

    const targetConversation = conversations.find((conversation) => (
      String(conversation?.id || '') === requestedConversationId ||
      String(conversation?.conversation_id || '') === requestedConversationId
    ));

    if (!targetConversation?.id) {
      return;
    }

    if (String(selectedId || '') !== String(targetConversation.id)) {
      setSelectedId(targetConversation.id);
    }
  }, [conversations, selectedId]);
  /* __AUTOATENDE_INBOX_DIRECT_CONVERSATION_FROM_FOLLOWUP_V9__:END */

  useEffect(() => {
    setModeError('');
    setLabelError('');
    setLabelEditorOpen(false);

    setLabelDraft(
      selectedConversation?.label || ''
    );
  }, [
    selectedConversation?.id,
    selectedConversation?.label,
  ]);


  useEffect(() => {
    const conversationId = String(
      selectedConversation?.id || ''
    ).trim();

    internalNoteAbortRef.current?.abort();
    const requestId = ++internalNoteRequestRef.current;

    if (internalNoteConversationRef.current !== conversationId) {
      internalNoteConversationRef.current = conversationId;
      setInternalNoteDraft('');
      setInternalNoteSavedContent('');
      setInternalNoteRecord(null);
      setInternalNoteMessage('');
      setInternalNoteMessageKind('');
    }

    if (!detailsOpen || !conversationId || !accessToken) {
      setInternalNoteLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    internalNoteAbortRef.current = controller;

    const loadInternalNote = async () => {
      setInternalNoteLoading(true);
      setInternalNoteMessage('');
      setInternalNoteMessageKind('');

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/internal-note`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        );

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao carregar a observação (${response.status}).`
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== internalNoteRequestRef.current ||
          selectedIdRef.current !== conversationId
        ) {
          return;
        }

        const note = payload?.note || null;
        const content = String(note?.content || '');
        setInternalNoteRecord(note);
        setInternalNoteDraft(content);
        setInternalNoteSavedContent(content);
      } catch (error) {
        if (error?.name === 'AbortError') return;

        if (
          requestId === internalNoteRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setInternalNoteRecord(null);
          setInternalNoteDraft('');
          setInternalNoteSavedContent('');
          setInternalNoteMessage(
            error?.message ||
            'Não foi possível carregar a observação interna.'
          );
          setInternalNoteMessageKind('error');
        }
      } finally {
        if (
          requestId === internalNoteRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setInternalNoteLoading(false);
        }
      }
    };

    loadInternalNote();
    return () => controller.abort();
  }, [
    accessToken,
    detailsOpen,
    internalNoteSyncVersion,
    selectedConversation?.id,
  ]);

  useEffect(() => {
    const conversationId = String(
      selectedConversation?.id || ''
    ).trim();

    followupAbortRef.current?.abort();
    const requestId = ++followupRequestRef.current;

    if (
      followupConversationRef.current !==
      conversationId
    ) {
      followupConversationRef.current =
        conversationId;
      setFollowupDraftDueAt('');
      setFollowupSavedDueAt('');
      setFollowupDraftSummary('');
      setFollowupSavedSummary('');
      setFollowupRecord(null);
      setFollowupMessage('');
      setFollowupMessageKind('');
    }

    if (
      !detailsOpen ||
      !conversationId ||
      !accessToken
    ) {
      setFollowupLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    followupAbortRef.current = controller;

    const loadFollowup = async () => {
      setFollowupLoading(true);
      setFollowupMessage('');
      setFollowupMessageKind('');

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/followup`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        );

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao carregar o retorno (${response.status}).`
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== followupRequestRef.current ||
          selectedIdRef.current !== conversationId
        ) {
          return;
        }

        const followup =
          aaExtractContactFollowup(payload);
        const localDueAt =
          aaContactFollowupIsoToLocalInput(
            followup?.due_at
          );
        const summary = String(
          followup?.summary || ''
        );

        setFollowupRecord(followup);
        setFollowupDraftDueAt(localDueAt);
        setFollowupSavedDueAt(localDueAt);
        setFollowupDraftSummary(summary);
        setFollowupSavedSummary(summary);
      } catch (error) {
        if (error?.name === 'AbortError') return;

        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupRecord(null);
          setFollowupDraftDueAt('');
          setFollowupSavedDueAt('');
          setFollowupDraftSummary('');
          setFollowupSavedSummary('');
          setFollowupMessage(
            error?.message ||
            'Não foi possível carregar o retorno programado.'
          );
          setFollowupMessageKind('error');
        }
      } finally {
        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupLoading(false);
        }
      }
    };

    loadFollowup();

    return () => controller.abort();
  }, [
    accessToken,
    detailsOpen,
    selectedConversation?.id,
  ]);

  const counts = useMemo(() => ({
    all: conversations.length,
    unread: conversations.reduce(
      (total, item) =>
        total + (item.unread > 0 ? 1 : 0),
      0
    ),
    mine: conversations.reduce(
      (total, item) =>
        total + (item.isMine ? 1 : 0),
      0
    ),
  }), [conversations]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return conversations.filter(
      (conversation) => {
        if (
          filter === 'unread' &&
          conversation.unread <= 0
        ) {
          return false;
        }

        if (
          filter === 'mine' &&
          !conversation.isMine
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [
          conversation.name,
          conversation.phone,
          conversation.preview,
          conversation.label,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      }
    );
  }, [
    conversations,
    filter,
    search,
  ]);

  const fetchConversations = useCallback(
    async ({
      silent = false,
    } = {}) => {
      if (!accessToken) {
        setLoadingList(false);
        return;
      }

      const requestId =
        ++listRequestRef.current;

      if (!silent) {
        setLoadingList(true);
      }

      try {
        const response = await fetch(
          '/api/inbox/conversations',
          {
            method: 'GET',
            headers,
            credentials: 'same-origin',
            cache: 'no-store',
          }
        );

        const payload =
          await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao carregar conversas (${response.status}).`
          );
        }

        const rows = extractArray(
          payload,
          [
            'conversations',
            'items',
            'rows',
          ]
        );

        const normalized = rows
          .map((row) =>
            normalizeConversation(
              row,
              currentUserId
            )
          )
          .filter((item) => item.id)
          .sort((left, right) => {
            const leftDate = new Date(
              left.lastMessageAt ||
              left.createdAt ||
              0
            ).getTime();

            const rightDate = new Date(
              right.lastMessageAt ||
              right.createdAt ||
              0
            ).getTime();

            return rightDate - leftDate;
          });

        if (
          requestId !==
          listRequestRef.current
        ) {
          return;
        }

        setConversations(normalized);
        setListError('');

        const currentSelection =
          selectedIdRef.current;

        if (
          !currentSelection ||
          !normalized.some(
            (item) =>
              item.id === currentSelection
          )
        ) {
          setSelectedId(
            normalized[0]?.id || ''
          );
        }
      } catch (error) {
        if (
          requestId ===
          listRequestRef.current
        ) {
          setListError(
            error?.message ||
            'Não foi possível carregar as conversas.'
          );
        }
      } finally {
        if (
          requestId ===
          listRequestRef.current
        ) {
          setLoadingList(false);
        }
      }
    },
    [
      accessToken,
      currentUserId,
      headers,
    ]
  );

  const fetchMessages = useCallback(
    async (
      conversationId,
      {
        silent = false,
      } = {}
    ) => {
      if (
        !accessToken ||
        !conversationId
      ) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      const requestId =
        ++messageRequestRef.current;

      if (!silent) {
        setLoadingMessages(true);
      }

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
          {
            method: 'GET',
            headers,
            credentials: 'same-origin',
            cache: 'no-store',
          }
        );

        const payload =
          await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao carregar mensagens (${response.status}).`
          );
        }

        const rows = extractArray(
          payload,
          [
            'messages',
            'items',
            'rows',
          ]
        );

        const normalized = rows
          .map(normalizeMessage)
          .sort((left, right) => {
            const leftDate = new Date(
              left.createdAt || 0
            ).getTime();

            const rightDate = new Date(
              right.createdAt || 0
            ).getTime();

            return leftDate - rightDate;
          });

        if (
          requestId !==
          messageRequestRef.current
        ) {
          return;
        }

        setMessages(normalized);
        setMessageError('');
      } catch (error) {
        if (
          requestId ===
          messageRequestRef.current
        ) {
          setMessageError(
            error?.message ||
            'Não foi possível carregar o histórico.'
          );
        }
      } finally {
        if (
          requestId ===
          messageRequestRef.current
        ) {
          setLoadingMessages(false);
        }
      }
    },
    [
      accessToken,
      headers,
    ]
  );

  /* __AUTOATENDE_INBOX_REAL_ACTIONS_V2__ */

  const patchConversationLocally = useCallback(
    (conversationId, patch = {}) => {
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            ...patch,
            raw: {
              ...(conversation.raw || {}),
              ...(patch.raw || {}),
            },
          };
        })
      );
    },
    []
  );

  const handleModeToggle = useCallback(
    async () => {
      if (
        !selectedConversation?.id ||
        !selectedConversation?.phone ||
        !accessToken ||
        modeBusy
      ) {
        return;
      }

      const conversationId =
        selectedConversation.id;

      const contact =
        selectedConversation.phone;

      const previousMode =
        selectedConversation.mode === 'human'
          ? 'human'
          : 'bot';

      const targetMode =
        previousMode === 'human'
          ? 'bot'
          : 'human';

      const endpoint =
        targetMode === 'human'
          ? '/api/attendance/transfer/human'
          : '/api/attendance/return/bot';

      setModeBusy(true);
      setModeError('');
      setLabelEditorOpen(false);

      /*
       * Atualização otimista.
       * A lista é recarregada depois com a fonte autoritativa.
       */
      patchConversationLocally(
        conversationId,
        {
          mode: targetMode,
          raw: {
            mode: targetMode,
            current_mode: targetMode,
          },
        }
      );

      try {
        const response = await fetch(
          endpoint,
          {
            method: 'POST',
            headers,
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({
              contact,
            }),
          }
        );

        const payload =
          await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            (
              targetMode === 'human'
                ? 'Não foi possível assumir esta conversa no atendimento humano.'
                : 'Não foi possível devolver esta conversa para o bot.'
            )
          );
        }

        /*
         * Recarrega o estado autoritativo de conversation_states.
         */
        await fetchConversations({
          silent: true,
        });
      } catch (error) {
        patchConversationLocally(
          conversationId,
          {
            mode: previousMode,
            raw: {
              mode: previousMode,
              current_mode: previousMode,
            },
          }
        );

        setModeError(
          error?.message ||
          'Não foi possível alterar o modo desta conversa.'
        );
      } finally {
        setModeBusy(false);
      }
    },
    [
      selectedConversation,
      accessToken,
      modeBusy,
      headers,
      patchConversationLocally,
      fetchConversations,
    ]
  );

  const handleLabelSave = useCallback(
    async (forcedValue) => {
      if (
        !selectedConversation?.id ||
        !selectedConversation?.phone ||
        !accessToken ||
        labelBusy
      ) {
        return;
      }

      const conversationId =
        selectedConversation.id;

      const contact =
        selectedConversation.phone;

      const rawValue =
        typeof forcedValue === 'string'
          ? forcedValue
          : labelDraft;

      const normalizedValue =
        String(rawValue || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 48);

      const nextLabels =
        normalizedValue
          ? [normalizedValue]
          : [];

      const previousLabels =
        Array.isArray(selectedConversation.labels)
          ? selectedConversation.labels
          : selectedConversation.label
            ? [selectedConversation.label]
            : [];

      const applyLabels = (labels) => {
        const safeLabels =
          Array.isArray(labels)
            ? labels
                .map((item) =>
                  firstText(
                    item?.name,
                    item?.label,
                    item?.title,
                    item
                  )
                )
                .filter(Boolean)
                .slice(0, 1)
            : [];

        patchConversationLocally(
          conversationId,
          {
            label: safeLabels[0] || '',
            labels: safeLabels,
            raw: {
              labels: safeLabels,
            },
          }
        );
      };

      setLabelBusy(true);
      setLabelError('');
      setModeError('');

      applyLabels(nextLabels);

      try {
        const response = await fetch(
          '/api/inbox-labels',
          {
            method: 'PATCH',
            headers,
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({
              contact,
              labels: nextLabels,
            }),
          }
        );

        const payload =
          await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            'Não foi possível salvar a etiqueta.'
          );
        }

        const persistedLabels =
          Array.isArray(payload?.labels)
            ? payload.labels
            : nextLabels;

        applyLabels(persistedLabels);

        setLabelDraft(
          firstText(
            persistedLabels?.[0]?.name,
            persistedLabels?.[0]?.label,
            persistedLabels?.[0]
          )
        );

        setLabelEditorOpen(false);

        /*
         * Reidrata também a projeção exibida na lista.
         */
        await fetchConversations({
          silent: true,
        });
      } catch (error) {
        applyLabels(previousLabels);

        setLabelError(
          error?.message ||
          'Não foi possível salvar a etiqueta.'
        );
      } finally {
        setLabelBusy(false);
      }
    },
    [
      selectedConversation,
      accessToken,
      labelBusy,
      labelDraft,
      headers,
      patchConversationLocally,
      fetchConversations,
    ]
  );

  const internalNoteNormalizedDraft =
    internalNoteDraft.trim();

  const internalNoteCharacterCount =
    Array.from(internalNoteDraft).length;

  const internalNoteExists = Boolean(
    internalNoteRecord?.id ||
    internalNoteSavedContent
  );

  const internalNoteDirty =
    internalNoteNormalizedDraft !==
    internalNoteSavedContent;

  const internalNoteBusy =
    internalNoteLoading ||
    internalNoteSaving ||
    internalNoteDeleting;

  const formatInternalNoteUpdatedAt = (value) => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch (_) {
      return '';
    }
  };

  useEffect(() => {
    const unsubscribe =
      aaSubscribeContactInternalNoteSync(
        (payload) => {
          const conversationId = String(
            selectedConversation?.id || ''
          ).trim();

          if (
            !conversationId ||
            !detailsOpen ||
            payload?.conversationId !==
              conversationId ||
            payload?.source ===
              internalNoteSyncSourceRef.current
          ) {
            return;
          }

          if (
            internalNoteSaving ||
            internalNoteDeleting ||
            internalNoteDirty
          ) {
            setInternalNoteMessage(
              'A observação foi alterada em outra tela. Suas alterações locais foram preservadas; reabra o contato para carregar a versão mais recente.'
            );
            setInternalNoteMessageKind(
              'error'
            );
            return;
          }

          setInternalNoteMessage('');
          setInternalNoteMessageKind('');

          setInternalNoteSyncVersion(
            (current) => (
              Math.max(
                Number(current || 0) + 1,
                Number(payload?.version || 0)
              )
            )
          );
        }
      );

    return unsubscribe;
  }, [
    detailsOpen,
    internalNoteDeleting,
    internalNoteDirty,
    internalNoteSaving,
    selectedConversation?.id,
  ]);

  const handleInternalNoteSave = useCallback(
    async () => {
      const conversationId = String(
        selectedConversation?.id || ''
      ).trim();
      const content = internalNoteDraft.trim();
      const contentLength = Array.from(content).length;

      if (
        !conversationId ||
        !accessToken ||
        internalNoteSaving ||
        internalNoteDeleting
      ) return;

      if (!content) {
        setInternalNoteMessage(
          'Digite uma observação antes de salvar.'
        );
        setInternalNoteMessageKind('error');
        return;
      }

      if (contentLength > 4000) {
        setInternalNoteMessage(
          'A observação deve ter no máximo 4.000 caracteres.'
        );
        setInternalNoteMessageKind('error');
        return;
      }

      internalNoteAbortRef.current?.abort();
      const requestId = ++internalNoteRequestRef.current;
      const controller = new AbortController();
      internalNoteAbortRef.current = controller;

      setInternalNoteSaving(true);
      setInternalNoteMessage('');
      setInternalNoteMessageKind('');

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/internal-note`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
            body: JSON.stringify({ content }),
          }
        );

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao salvar a observação (${response.status}).`
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== internalNoteRequestRef.current ||
          selectedIdRef.current !== conversationId
        ) return;

        const note = payload?.note || { content };
        const savedContent = String(note?.content || content);
        setInternalNoteRecord(note);
        setInternalNoteDraft(savedContent);
        setInternalNoteSavedContent(savedContent);
        setInternalNoteMessage(
          payload?.created
            ? 'Observação interna criada com sucesso.'
            : 'Observação interna atualizada com sucesso.'
        );
        setInternalNoteMessageKind('success');

        aaPublishContactInternalNoteSync({
          conversationId,
          action: 'upsert',
          updatedAt:
            note?.updated_at ||
            note?.updatedAt ||
            null,
          source:
            internalNoteSyncSourceRef.current,
        });
      } catch (error) {
        if (error?.name === 'AbortError') return;

        if (
          requestId === internalNoteRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setInternalNoteMessage(
            error?.message ||
            'Não foi possível salvar a observação interna.'
          );
          setInternalNoteMessageKind('error');
        }
      } finally {
        if (
          requestId === internalNoteRequestRef.current &&
          selectedIdRef.current === conversationId
        ) setInternalNoteSaving(false);
      }
    },
    [
      accessToken,
      internalNoteDeleting,
      internalNoteDraft,
      internalNoteSaving,
      selectedConversation?.id,
    ]
  );

  const handleInternalNoteDelete = useCallback(
    async () => {
      const conversationId = String(
        selectedConversation?.id || ''
      ).trim();

      if (
        !conversationId ||
        !accessToken ||
        !internalNoteExists ||
        internalNoteSaving ||
        internalNoteDeleting
      ) return;

      if (!window.confirm(
        'Remover a observação interna deste contato?'
      )) return;

      internalNoteAbortRef.current?.abort();
      const requestId = ++internalNoteRequestRef.current;
      const controller = new AbortController();
      internalNoteAbortRef.current = controller;

      setInternalNoteDeleting(true);
      setInternalNoteMessage('');
      setInternalNoteMessageKind('');

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/internal-note`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        );

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao remover a observação (${response.status}).`
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== internalNoteRequestRef.current ||
          selectedIdRef.current !== conversationId
        ) return;

        setInternalNoteRecord(null);
        setInternalNoteDraft('');
        setInternalNoteSavedContent('');
        setInternalNoteMessage(
          payload?.note_removed
            ? 'Observação interna removida.'
            : 'Este contato já estava sem observação.'
        );
        setInternalNoteMessageKind('success');

        aaPublishContactInternalNoteSync({
          conversationId,
          action: 'remove',
          updatedAt: null,
          source:
            internalNoteSyncSourceRef.current,
        });
      } catch (error) {
        if (error?.name === 'AbortError') return;

        if (
          requestId === internalNoteRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setInternalNoteMessage(
            error?.message ||
            'Não foi possível remover a observação interna.'
          );
          setInternalNoteMessageKind('error');
        }
      } finally {
        if (
          requestId === internalNoteRequestRef.current &&
          selectedIdRef.current === conversationId
        ) setInternalNoteDeleting(false);
      }
    },
    [
      accessToken,
      internalNoteDeleting,
      internalNoteExists,
      internalNoteSaving,
      selectedConversation?.id,
    ]
  );

  const followupNormalizedSummary =
    followupDraftSummary.trim();

  const followupCharacterCount =
    Array.from(followupDraftSummary).length;

  const followupExists = Boolean(
    followupRecord?.id &&
    String(followupRecord?.status || 'pending') ===
      'pending'
  );

  const followupDirty =
    followupDraftDueAt !== followupSavedDueAt ||
    followupNormalizedSummary !==
      followupSavedSummary;

  const followupBusy =
    followupLoading ||
    followupSaving ||
    followupCanceling ||
    followupCompleting;

  const followupVisualStatus =
    aaResolveContactFollowupVisualStatus(
      followupRecord
    );

  useEffect(() => {
    if (!followupDirty) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );
    };
  }, [followupDirty]);

  useEffect(() => (
    () => {
      followupAbortRef.current?.abort();
    }
  ), []);

  const handleFollowupSave = useCallback(
    async () => {
      const conversationId = String(
        selectedConversation?.id || ''
      ).trim();
      const dueAtIso =
        aaContactFollowupLocalInputToIso(
          followupDraftDueAt
        );
      const summary =
        followupNormalizedSummary;

      if (
        !conversationId ||
        !accessToken ||
        followupBusy
      ) {
        return;
      }

      if (!dueAtIso) {
        setFollowupMessage(
          'Informe uma data e um horário válidos para o retorno.'
        );
        setFollowupMessageKind('error');
        return;
      }

      if (followupCharacterCount > 500) {
        setFollowupMessage(
          'O contexto do retorno deve ter no máximo 500 caracteres.'
        );
        setFollowupMessageKind('error');
        return;
      }

      followupAbortRef.current?.abort();
      const controller = new AbortController();
      followupAbortRef.current = controller;
      const requestId = ++followupRequestRef.current;

      setFollowupSaving(true);
      setFollowupMessage('');
      setFollowupMessageKind('');

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/followup`,
          {
            method: 'PUT',
            headers,
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
            body: JSON.stringify({
              due_at: dueAtIso,
              summary,
            }),
          }
        );

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao salvar o retorno (${response.status}).`
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== followupRequestRef.current ||
          selectedIdRef.current !== conversationId
        ) {
          return;
        }

        const followup =
          aaExtractContactFollowup(payload);

        if (!followup?.id) {
          throw new Error(
            'A API não retornou o registro do retorno salvo.'
          );
        }

        const localDueAt =
          aaContactFollowupIsoToLocalInput(
            followup?.due_at || dueAtIso
          );
        const persistedSummary = String(
          followup?.summary ?? summary
        );

        setFollowupRecord(followup);
        setFollowupDraftDueAt(localDueAt);
        setFollowupSavedDueAt(localDueAt);
        setFollowupDraftSummary(
          persistedSummary
        );
        setFollowupSavedSummary(
          persistedSummary
        );
        setFollowupMessage(
          payload?.created
            ? 'Retorno programado com sucesso.'
            : 'Retorno atualizado com sucesso.'
        );
        setFollowupMessageKind('success');
      } catch (error) {
        if (error?.name === 'AbortError') return;

        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupMessage(
            error?.message ||
            'Não foi possível salvar o retorno programado.'
          );
          setFollowupMessageKind('error');
        }
      } finally {
        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupSaving(false);
        }
      }
    },
    [
      accessToken,
      followupBusy,
      followupCharacterCount,
      followupDraftDueAt,
      followupNormalizedSummary,
      headers,
      selectedConversation?.id,
    ]
  );

  const handleFollowupCancel = useCallback(
    async () => {
      const conversationId = String(
        selectedConversation?.id || ''
      ).trim();

      if (
        !conversationId ||
        !accessToken ||
        !followupExists ||
        followupBusy
      ) {
        return;
      }

      const confirmed = window.confirm(
        followupDirty
          ? 'Cancelar este retorno? As alterações não salvas também serão descartadas.'
          : 'Cancelar este retorno programado? O histórico será preservado.'
      );

      if (!confirmed) return;

      followupAbortRef.current?.abort();
      const controller = new AbortController();
      followupAbortRef.current = controller;
      const requestId = ++followupRequestRef.current;

      setFollowupCanceling(true);
      setFollowupMessage('');
      setFollowupMessageKind('');

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/followup`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        );

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao cancelar o retorno (${response.status}).`
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== followupRequestRef.current ||
          selectedIdRef.current !== conversationId
        ) {
          return;
        }

        setFollowupRecord(null);
        setFollowupDraftDueAt('');
        setFollowupSavedDueAt('');
        setFollowupDraftSummary('');
        setFollowupSavedSummary('');
        setFollowupMessage(
          payload?.canceled === false
            ? 'Este contato já estava sem retorno pendente.'
            : 'Retorno cancelado. O histórico foi preservado.'
        );
        setFollowupMessageKind('success');
      } catch (error) {
        if (error?.name === 'AbortError') return;

        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupMessage(
            error?.message ||
            'Não foi possível cancelar o retorno programado.'
          );
          setFollowupMessageKind('error');
        }
      } finally {
        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupCanceling(false);
        }
      }
    },
    [
      accessToken,
      followupBusy,
      followupDirty,
      followupExists,
      selectedConversation?.id,
    ]
  );

  const handleFollowupComplete = useCallback(
    async () => {
      const conversationId = String(
        selectedConversation?.id || ''
      ).trim();

      if (
        !conversationId ||
        !accessToken ||
        !followupExists ||
        followupBusy
      ) {
        return;
      }

      const confirmed = window.confirm(
        followupDirty
          ? 'Concluir este retorno? As alterações não salvas também serão descartadas.'
          : 'Marcar este retorno como concluído? O histórico será preservado.'
      );

      if (!confirmed) return;

      followupAbortRef.current?.abort();
      const controller = new AbortController();
      followupAbortRef.current = controller;
      const requestId = ++followupRequestRef.current;

      setFollowupCompleting(true);
      setFollowupMessage('');
      setFollowupMessageKind('');

      try {
        const response = await fetch(
          `/api/inbox/conversations/${encodeURIComponent(conversationId)}/followup/complete`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        );

        const payload = await readJsonSafe(response);

        if (!response.ok) {
          throw new Error(
            findErrorMessage(payload) ||
            findErrorCode(payload) ||
            `Falha ao concluir o retorno (${response.status}).`
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== followupRequestRef.current ||
          selectedIdRef.current !== conversationId
        ) {
          return;
        }

        setFollowupRecord(null);
        setFollowupDraftDueAt('');
        setFollowupSavedDueAt('');
        setFollowupDraftSummary('');
        setFollowupSavedSummary('');
        setFollowupMessage(
          payload?.completed === false
            ? 'Este contato já estava sem retorno pendente.'
            : 'Retorno concluído. O histórico foi preservado.'
        );
        setFollowupMessageKind('success');
      } catch (error) {
        if (error?.name === 'AbortError') return;

        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupMessage(
            error?.message ||
            'Não foi possível concluir o retorno programado.'
          );
          setFollowupMessageKind('error');
        }
      } finally {
        if (
          requestId === followupRequestRef.current &&
          selectedIdRef.current === conversationId
        ) {
          setFollowupCompleting(false);
        }
      }
    },
    [
      accessToken,
      followupBusy,
      followupDirty,
      followupExists,
      selectedConversation?.id,
    ]
  );

  const handleFollowupRestore = useCallback(
    () => {
      if (followupBusy) return;

      setFollowupDraftDueAt(
        followupSavedDueAt
      );
      setFollowupDraftSummary(
        followupSavedSummary
      );
      setFollowupMessage('');
      setFollowupMessageKind('');
    },
    [
      followupBusy,
      followupSavedDueAt,
      followupSavedSummary,
    ]
  );

  const handleFollowupKeyDown = useCallback(
    (event) => {
      if (
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();

        if (
          followupDirty &&
          followupDraftDueAt &&
          followupCharacterCount <= 500 &&
          !followupBusy
        ) {
          handleFollowupSave();
        }
      }
    },
    [
      followupBusy,
      followupCharacterCount,
      followupDirty,
      followupDraftDueAt,
      handleFollowupSave,
    ]
  );

  const confirmFollowupDiscard = useCallback(
    () => {
      if (
        followupSaving ||
        followupCanceling ||
        followupCompleting
      ) {
        return false;
      }

      if (!followupDirty) return true;

      return window.confirm(
        'Descartar as alterações não salvas do retorno programado?'
      );
    },
    [
      followupCanceling,
      followupCompleting,
      followupDirty,
      followupSaving,
    ]
  );

  const confirmInternalNoteDiscard = useCallback(
    () => {
      if (internalNoteSaving || internalNoteDeleting) return false;
      if (!internalNoteDirty) return true;
      return window.confirm(
        'Descartar as alterações não salvas da observação interna?'
      );
    },
    [
      internalNoteDeleting,
      internalNoteDirty,
      internalNoteSaving,
    ]
  );

  const handleConversationSelect = useCallback(
    (conversationId) => {
      if (conversationId === selectedId) return;
      if (!confirmInternalNoteDiscard()) return;
      if (!confirmFollowupDiscard()) return;
      setSelectedId(conversationId);
      setEmojiOpen(false);
    },
    [
      confirmFollowupDiscard,
      confirmInternalNoteDiscard,
      selectedId,
    ]
  );

  const handleDetailsClose = useCallback(
    () => {
      if (!confirmInternalNoteDiscard()) return;
      if (!confirmFollowupDiscard()) return;

      if (internalNoteDirty) {
        setInternalNoteDraft(internalNoteSavedContent);
      }

      if (followupDirty) {
        setFollowupDraftDueAt(followupSavedDueAt);
        setFollowupDraftSummary(followupSavedSummary);
      }

      setDetailsOpen(false);
    },
    [
      confirmFollowupDiscard,
      confirmInternalNoteDiscard,
      followupDirty,
      followupSavedDueAt,
      followupSavedSummary,
      internalNoteDirty,
      internalNoteSavedContent,
    ]
  );

  const handleInternalNoteKeyDown = useCallback(
    (event) => {
      if (
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        if (
          internalNoteDirty &&
          internalNoteNormalizedDraft &&
          !internalNoteBusy
        ) handleInternalNoteSave();
      }
    },
    [
      handleInternalNoteSave,
      internalNoteBusy,
      internalNoteDirty,
      internalNoteNormalizedDraft,
    ]
  );

  const handleInternalNoteRestore = useCallback(
    () => {
      if (internalNoteBusy) return;
      setInternalNoteDraft(internalNoteSavedContent);
      setInternalNoteMessage('');
      setInternalNoteMessageKind('');
    },
    [internalNoteBusy, internalNoteSavedContent]
  );

  useLayoutEffect(() => {
    const updateBounds = () => {
      setBounds(resolvePortalBounds());
      setViewportWidth(window.innerWidth);
    };

    updateBounds();

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateBounds)
        : null;

    const sidebar =
      document.querySelector(
        '.aa-shell-v2-sidebar'
      );

    if (observer && sidebar) {
      observer.observe(sidebar);
    }

    window.addEventListener(
      'resize',
      updateBounds
    );

    const interval = window.setInterval(
      updateBounds,
      1500
    );

    return () => {
      observer?.disconnect();

      window.removeEventListener(
        'resize',
        updateBounds
      );

      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add(
      'aa-inbox-v2-portal-active'
    );

    return () => {
      document.body.classList.remove(
        'aa-inbox-v2-portal-active'
      );
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    fetchConversations({
      silent: false,
    });

    return undefined;
  }, [
    accessToken,
    fetchConversations,
  ]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return undefined;
    }

    setComposerError('');

    fetchMessages(
      selectedId,
      {
        silent: false,
      }
    );

    return undefined;
  }, [
    selectedId,
    fetchMessages,
  ]);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    const interval = window.setInterval(
      () => {
        if (
          document.visibilityState !==
          'visible'
        ) {
          return;
        }

        fetchConversations({
          silent: true,
        });

        if (selectedIdRef.current) {
          fetchMessages(
            selectedIdRef.current,
            {
              silent: true,
            }
          );
        }
      },
      12000
    );

    return () =>
      window.clearInterval(interval);
  }, [
    accessToken,
    fetchConversations,
    fetchMessages,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'end',
    });
  }, [
    messages.length,
    selectedId,
  ]);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '40px';

    textarea.style.height =
      `${Math.min(
        Math.max(
          textarea.scrollHeight,
          40
        ),
        108
      )}px`;

    textarea.style.overflowY =
      textarea.scrollHeight > 108
        ? 'auto'
        : 'hidden';
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;

    if (!textarea) {
      setDraft((current) =>
        `${current}${emoji}`
      );

      return;
    }

    const selectionStart =
      textarea.selectionStart ??
      draft.length;

    const selectionEnd =
      textarea.selectionEnd ??
      draft.length;

    const nextDraft =
      draft.slice(0, selectionStart) +
      emoji +
      draft.slice(selectionEnd);

    setDraft(nextDraft);

    window.requestAnimationFrame(() => {
      const nextCursor =
        selectionStart + emoji.length;

      textarea.focus();

      textarea.setSelectionRange(
        nextCursor,
        nextCursor
      );

      resizeTextarea();
    });
  };



  useEffect(() => {
    if (!threadMenuOpen) {
      return undefined;
    }

    const handleThreadMenuOutside = (
      event
    ) => {
      const target =
        event.target;

      if (
        typeof Node !== 'undefined' &&
        !(target instanceof Node)
      ) {
        return;
      }

      const insideMenu =
        Boolean(
          threadMenuRef.current
            ?.contains(target)
        );

      const insideButton =
        Boolean(
          threadMenuButtonRef.current
            ?.contains(target)
        );

      if (
        !insideMenu &&
        !insideButton
      ) {
        setThreadMenuOpen(false);
      }
    };

    const handleThreadMenuEscape = (
      event
    ) => {
      if (event.key === 'Escape') {
        setThreadMenuOpen(false);
      }
    };

    document.addEventListener(
      'pointerdown',
      handleThreadMenuOutside,
      true
    );

    document.addEventListener(
      'keydown',
      handleThreadMenuEscape
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleThreadMenuOutside,
        true
      );

      document.removeEventListener(
        'keydown',
        handleThreadMenuEscape
      );
    };
  }, [
    threadMenuOpen,
  ]);

  useEffect(() => {
    setThreadMenuOpen(false);
    setThreadActionNotice('');
  }, [
    selectedId,
  ]);

  const stopVoiceTimer = () => {
    if (!voiceTimerRef.current) {
      return;
    }

    window.clearInterval(
      voiceTimerRef.current
    );

    voiceTimerRef.current = null;
  };

  const stopVoiceStream = () => {
    const stream =
      voiceStreamRef.current;

    stream?.getTracks?.()
      ?.forEach((track) => {
        try {
          track.stop();
        } catch (_) {
          // Nenhuma ação adicional.
        }
      });

    voiceStreamRef.current = null;
  };

  const clearVoiceDraft = () => {
    setVoiceDraft(null);
    setVoicePreviewUrl('');
  };

  const cancelVoiceRecording = () => {
    voiceCancelledRef.current = true;

    stopVoiceTimer();

    const recorder =
      voiceRecorderRef.current;

    if (
      recorder &&
      recorder.state !== 'inactive'
    ) {
      try {
        recorder.stop();
      } catch (_) {
        stopVoiceStream();
      }
    } else {
      stopVoiceStream();
    }

    voiceRecorderRef.current = null;
    voiceChunksRef.current = [];

    setIsVoiceRecording(false);
    setVoiceElapsedSeconds(0);
  };

  const finishVoiceRecording = () => {
    voiceCancelledRef.current = false;

    stopVoiceTimer();

    const recorder =
      voiceRecorderRef.current;

    if (
      !recorder ||
      recorder.state === 'inactive'
    ) {
      setIsVoiceRecording(false);
      stopVoiceStream();
      return;
    }

    try {
      recorder.stop();
    } catch (error) {
      setComposerError(
        'Não foi possível finalizar a gravação.'
      );

      cancelVoiceRecording();
    }
  };

  const startVoiceRecording = async () => {
    if (!selectedConversation?.id) {
      setComposerError(
        'Selecione uma conversa antes de gravar.'
      );

      return;
    }

    if (
      selectedConversation.mode !== 'human'
    ) {
      setComposerError(
        'Assuma a conversa no modo Humano antes de gravar uma mensagem de voz.'
      );

      return;
    }

    if (
      sending ||
      mediaSending ||
      voiceSending ||
      isVoiceRecording
    ) {
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setComposerError(
        'Este navegador não oferece suporte à gravação de áudio.'
      );

      return;
    }

    setComposerError('');
    setAttachmentOpen(false);
    setEmojiOpen(false);
    setMediaDraft(null);
    clearVoiceDraft();

    try {
      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
            video: false,
          });

      const mimeType =
        aaSelectVoiceRecorderMimeType();

      const recorderOptions =
        mimeType
          ? {
              mimeType,
              audioBitsPerSecond: 64000,
            }
          : {
              audioBitsPerSecond: 64000,
            };

      const recorder =
        new MediaRecorder(
          stream,
          recorderOptions
        );

      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      voiceCancelledRef.current = false;
      voiceStartedAtRef.current =
        Date.now();

      voiceConversationIdRef.current =
        selectedConversation.id;

      recorder.ondataavailable = (
        event
      ) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          voiceChunksRef.current.push(
            event.data
          );
        }
      };

      recorder.onerror = () => {
        voiceCancelledRef.current = true;

        setComposerError(
          'O navegador interrompeu a gravação de áudio.'
        );

        stopVoiceTimer();
        stopVoiceStream();

        setIsVoiceRecording(false);
        setVoiceElapsedSeconds(0);
      };

      recorder.onstop = () => {
        stopVoiceTimer();
        stopVoiceStream();

        const cancelled =
          voiceCancelledRef.current;

        const chunks =
          voiceChunksRef.current;

        voiceChunksRef.current = [];
        voiceRecorderRef.current = null;

        if (
          voiceUnmountedRef.current ||
          cancelled
        ) {
          return;
        }

        const actualMimeType =
          String(
            recorder.mimeType ||
            mimeType ||
            chunks?.[0]?.type ||
            'audio/webm'
          );

        const blob =
          new Blob(
            chunks,
            {
              type: actualMimeType,
            }
          );

        if (!blob.size) {
          setComposerError(
            'Nenhum áudio foi capturado. Tente gravar novamente.'
          );

          return;
        }

        if (
          blob.size >
          AA_VOICE_MAX_BYTES
        ) {
          setComposerError(
            'A gravação excedeu o limite permitido de 16 MB.'
          );

          return;
        }

        const elapsedSeconds =
          Math.max(
            1,
            Math.min(
              AA_VOICE_MAX_SECONDS,
              Math.round(
                (
                  Date.now() -
                  voiceStartedAtRef.current
                ) /
                1000
              )
            )
          );

        const extension =
          aaVoiceFileExtension(
            actualMimeType
          );

        const file =
          new File(
            [blob],
            `mensagem-de-voz-${Date.now()}.${extension}`,
            {
              type: actualMimeType,
              lastModified:
                Date.now(),
            }
          );

        setVoiceDraft({
          file,
          durationSeconds:
            elapsedSeconds,
          mimeType:
            actualMimeType,
          conversationId:
            voiceConversationIdRef.current,
        });
      };

      recorder.start(250);

      setIsVoiceRecording(true);
      setVoiceElapsedSeconds(0);

      voiceTimerRef.current =
        window.setInterval(
          () => {
            const elapsed =
              Math.max(
                0,
                Math.floor(
                  (
                    Date.now() -
                    voiceStartedAtRef.current
                  ) /
                  1000
                )
              );

            const limited =
              Math.min(
                AA_VOICE_MAX_SECONDS,
                elapsed
              );

            setVoiceElapsedSeconds(
              limited
            );

            if (
              limited >=
              AA_VOICE_MAX_SECONDS
            ) {
              stopVoiceTimer();

              const activeRecorder =
                voiceRecorderRef.current;

              if (
                activeRecorder &&
                activeRecorder.state !==
                  'inactive'
              ) {
                voiceCancelledRef.current =
                  false;

                try {
                  activeRecorder.stop();
                } catch (_) {
                  stopVoiceStream();
                }
              }

              setIsVoiceRecording(
                false
              );
            }
          },
          250
        );
    } catch (error) {
      stopVoiceTimer();
      stopVoiceStream();

      const name =
        String(
          error?.name || ''
        );

      if (
        name === 'NotAllowedError' ||
        name === 'SecurityError'
      ) {
        setComposerError(
          'Permissão do microfone negada. Autorize o acesso ao microfone no navegador.'
        );
      } else if (
        name === 'NotFoundError' ||
        name === 'DevicesNotFoundError'
      ) {
        setComposerError(
          'Nenhum microfone foi encontrado neste dispositivo.'
        );
      } else if (
        name === 'NotReadableError' ||
        name === 'TrackStartError'
      ) {
        setComposerError(
          'O microfone está sendo utilizado por outro aplicativo.'
        );
      } else {
        setComposerError(
          error?.message ||
          'Não foi possível iniciar a gravação.'
        );
      }

      setIsVoiceRecording(false);
      setVoiceElapsedSeconds(0);
    }
  };

  const submitVoice = async (
    event
  ) => {
    event.preventDefault();

    if (
      !voiceDraft?.file ||
      !selectedConversation?.id ||
      voiceSending ||
      sending ||
      mediaSending
    ) {
      return;
    }

    if (
      selectedConversation.mode !== 'human'
    ) {
      setComposerError(
        'Assuma a conversa no modo Humano antes de enviar a mensagem de voz.'
      );

      return;
    }

    if (
      voiceDraft.conversationId !==
      selectedConversation.id
    ) {
      setComposerError(
        'A conversa foi alterada. Grave a mensagem de voz novamente.'
      );

      clearVoiceDraft();
      return;
    }

    const conversationId =
      selectedConversation.id;

    const formData =
      new FormData();

    formData.append(
      'file',
      voiceDraft.file,
      voiceDraft.file.name
    );

    formData.append(
      'voice_recording',
      'true'
    );

    setVoiceSending(true);
    setComposerError('');
    setAttachmentOpen(false);
    setEmojiOpen(false);

    try {
      const response = await fetch(
        `/api/inbox/conversations/${encodeURIComponent(conversationId)}/media`,
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          credentials:
            'same-origin',
          cache:
            'no-store',
          body:
            formData,
        }
      );

      const payload =
        await readJsonSafe(response);

      if (!response.ok) {
        const error = new Error(
          findErrorMessage(payload) ||
          findErrorCode(payload) ||
          `Falha ao enviar a mensagem de voz (${response.status}).`
        );

        error.code =
          findErrorCode(payload) || '';

        error.details =
          payload?.details || null;

        throw error;
      }

      clearVoiceDraft();

      await Promise.all([
        fetchMessages(
          conversationId,
          {
            silent: true,
          }
        ),

        fetchConversations({
          silent: true,
        }),
      ]);

      window.requestAnimationFrame(
        () => {
          textareaRef.current
            ?.focus();
        }
      );
    } catch (error) {
      const code =
        String(
          error?.code || ''
        );

      if (
        code ===
        'WHATSAPP_24H_WINDOW_CLOSED'
      ) {
        setComposerError(
          'A janela de atendimento de 24h está fechada. Use um template aprovado para retomar a conversa.'
        );
      } else if (
        code ===
        'MEDIA_REQUIRES_HUMAN_MODE'
      ) {
        setComposerError(
          'Assuma a conversa no modo Humano antes de enviar a mensagem de voz.'
        );
      } else if (
        code ===
        'VOICE_TRANSCODE_FAILED' ||
        code ===
        'VOICE_INPUT_TYPE_NOT_ALLOWED'
      ) {
        setComposerError(
          'Não foi possível processar a gravação. Grave novamente.'
        );
      } else if (
        code ===
        'MEDIA_SENT_PERSIST_FAILED'
      ) {
        setComposerError(
          'A mensagem de voz chegou ao WhatsApp, mas houve falha no histórico. Não envie novamente antes de conferir o celular.'
        );
      } else {
        setComposerError(
          error?.message ||
          'Não foi possível enviar a mensagem de voz.'
        );
      }
    } finally {
      setVoiceSending(false);
    }
  };

  const refreshThreadFromMenu =
    async () => {
      const conversationId =
        selectedConversation?.id;

      if (
        !conversationId ||
        threadActionBusy
      ) {
        return;
      }

      setThreadActionBusy(true);
      setThreadActionNotice('');

      try {
        await Promise.all([
          fetchMessages(
            conversationId,
            {
              silent: false,
            }
          ),

          fetchConversations({
            silent: true,
          }),
        ]);

        setThreadActionNotice(
          'Histórico atualizado'
        );
      } catch (error) {
        console.error(
          'Falha ao atualizar histórico',
          error
        );

        setThreadActionNotice(
          'Não foi possível atualizar'
        );
      } finally {
        setThreadActionBusy(false);
      }
    };

  const copyThreadPhone =
    async () => {
      const phone = String(
        selectedConversation?.phone || ''
      ).trim();

      if (!phone) {
        setThreadActionNotice(
          'Telefone não disponível'
        );

        return;
      }

      try {
        if (
          navigator.clipboard
            ?.writeText
        ) {
          await navigator.clipboard
            .writeText(phone);
        } else {
          const temporary =
            document.createElement(
              'textarea'
            );

          temporary.value = phone;

          temporary.setAttribute(
            'readonly',
            ''
          );

          temporary.style.position =
            'fixed';

          temporary.style.opacity =
            '0';

          document.body.appendChild(
            temporary
          );

          temporary.select();

          document.execCommand(
            'copy'
          );

          temporary.remove();
        }

        setThreadActionNotice(
          'Telefone copiado'
        );
      } catch (error) {
        console.error(
          'Falha ao copiar telefone',
          error
        );

        setThreadActionNotice(
          'Não foi possível copiar'
        );
      }
    };

  const openThreadInWhatsApp =
    () => {
      const digits = String(
        selectedConversation?.phone || ''
      ).replace(/\D/g, '');

      if (!digits) {
        setThreadActionNotice(
          'Telefone não disponível'
        );

        return;
      }

      setThreadMenuOpen(false);

      window.open(
        `https://wa.me/${digits}`,
        '_blank',
        'noopener,noreferrer'
      );
    };

  const showVoiceAction =
    !draft.trim() &&
    !mediaDraft &&
    !voiceDraft &&
    !isVoiceRecording;

  const clearMediaDraft = () => {
    setMediaDraft(null);
    setAttachmentOpen(false);
    setMediaPreviewUrl('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openAttachmentPicker = () => {
    if (!selectedConversation?.id) {
      setComposerError(
        'Selecione uma conversa antes de anexar um arquivo.'
      );

      return;
    }

    if (
      selectedConversation.mode !== 'human'
    ) {
      setComposerError(
        'Assuma a conversa no modo Humano antes de enviar anexos.'
      );

      return;
    }

    setComposerError('');
    setEmojiOpen(false);

    setAttachmentOpen(
      (current) => !current
    );
  };

  const chooseAttachmentType = (
    accept
  ) => {
    const input = fileInputRef.current;

    if (!input) {
      return;
    }

    input.accept = accept;
    setAttachmentOpen(false);
    input.click();
  };

  const handleMediaFileSelected = (
    event
  ) => {
    const file =
      event.target.files?.[0] || null;

    event.target.value = '';

    if (!file) {
      return;
    }

    clearVoiceDraft();

    const kind =
      aaResolveOutboundMediaKind(file);

    if (!kind) {
      setComposerError(
        'Formato não permitido. Use foto JPG/PNG, vídeo MP4/3GP, áudio MP3/M4A/AAC/AMR/OGG Opus ou um documento compatível.'
      );

      return;
    }

    const maxBytes =
      AA_OUTBOUND_MEDIA_LIMITS[kind];

    if (
      Number(file.size || 0) >
      maxBytes
    ) {
      setComposerError(
        `O ${aaOutboundMediaLabel(kind).toLowerCase()} excede o limite permitido de ${aaFormatOutboundFileSize(maxBytes)}.`
      );

      return;
    }

    setComposerError('');

    setMediaDraft({
      file,
      kind,
      filename:
        file.name || 'arquivo',
    });

    setAttachmentOpen(false);
  };

  const submitMedia = async (
    event
  ) => {
    event.preventDefault();

    if (
      !mediaDraft?.file ||
      !selectedConversation?.id ||
      mediaSending ||
      sending
    ) {
      return;
    }

    if (
      selectedConversation.mode !== 'human'
    ) {
      setComposerError(
        'Assuma a conversa no modo Humano antes de enviar anexos.'
      );

      return;
    }

    const conversationId =
      selectedConversation.id;

    const formData =
      new FormData();

    formData.append(
      'file',
      mediaDraft.file,
      mediaDraft.file.name
    );

    if (
      mediaDraft.kind !== 'audio' &&
      draft.trim()
    ) {
      formData.append(
        'caption',
        draft.trim()
      );
    }

    setMediaSending(true);
    setComposerError('');
    setAttachmentOpen(false);
    setEmojiOpen(false);

    try {
      const response = await fetch(
        `/api/inbox/conversations/${encodeURIComponent(conversationId)}/media`,
        {
          method: 'POST',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          credentials: 'same-origin',
          cache: 'no-store',
          body: formData,
        }
      );

      const payload =
        await readJsonSafe(response);

      if (!response.ok) {
        const error = new Error(
          findErrorMessage(payload) ||
          findErrorCode(payload) ||
          `Falha ao enviar arquivo (${response.status}).`
        );

        error.code =
          findErrorCode(payload) || '';

        error.details =
          payload?.details || null;

        throw error;
      }

      clearMediaDraft();

      if (
        mediaDraft.kind !== 'audio'
      ) {
        setDraft('');
      }

      await Promise.all([
        fetchMessages(
          conversationId,
          {
            silent: true,
          }
        ),

        fetchConversations({
          silent: true,
        }),
      ]);

      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (error) {
      const code =
        String(error?.code || '');

      if (
        code ===
        'WHATSAPP_24H_WINDOW_CLOSED'
      ) {
        setComposerError(
          'A janela de atendimento de 24h está fechada. Use um template aprovado para retomar a conversa.'
        );
      } else if (
        code ===
        'MEDIA_REQUIRES_HUMAN_MODE'
      ) {
        setComposerError(
          'Assuma a conversa no modo Humano antes de enviar anexos.'
        );
      } else if (
        code ===
        'MEDIA_SENT_PERSIST_FAILED'
      ) {
        setComposerError(
          'O arquivo chegou ao WhatsApp, mas houve falha ao registrar a mensagem no histórico. Não envie novamente antes de conferir o celular.'
        );
      } else {
        setComposerError(
          error?.message ||
          'Não foi possível enviar o arquivo.'
        );
      }
    } finally {
      setMediaSending(false);
    }
  };

  const submitMessage = async (event) => {
    event.preventDefault();

    const text = draft.trim();

    if (
      !text ||
      !selectedConversation?.id ||
      sending
    ) {
      return;
    }

    const optimisticId =
      `optimistic-${Date.now()}`;

    const optimisticMessage = {
      id: optimisticId,
      direction: 'outbound',
      senderType: 'human',
      sender: 'Você',
      type: 'text',
      text,
      createdAt:
        new Date().toISOString(),
      time: formatTime(new Date()),
      raw: {},
      meta: {},
      optimistic: true,
    };

    setSending(true);
    setComposerError('');
    setDraft('');
    setEmojiOpen(false);

    setMessages((current) => [
      ...current,
      optimisticMessage,
    ]);

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.style.height =
        '40px';

      textareaRef.current.focus();
    });

    try {
      const response = await fetch(
        `/api/inbox/conversations/${encodeURIComponent(selectedConversation.id)}/messages`,
        {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({
            text,
          }),
        }
      );

      const payload =
        await readJsonSafe(response);

      if (!response.ok) {
        const code =
          findErrorCode(payload);

        if (
          response.status === 409 ||
          code ===
            'WHATSAPP_24H_WINDOW_CLOSED'
        ) {
          throw new Error(
            'A janela de atendimento de 24 horas está fechada. Use um template aprovado para retomar esta conversa.'
          );
        }

        throw new Error(
          findErrorMessage(payload) ||
          code ||
          `Não foi possível enviar a mensagem (${response.status}).`
        );
      }

      await Promise.all([
        fetchMessages(
          selectedConversation.id,
          {
            silent: true,
          }
        ),
        fetchConversations({
          silent: true,
        }),
      ]);
    } catch (error) {
      setMessages((current) =>
        current.filter(
          (message) =>
            message.id !== optimisticId
        )
      );

      setDraft(text);

      setComposerError(
        error?.message ||
        'Não foi possível enviar a mensagem.'
      );
    } finally {
      setSending(false);
    }
  };

  const refreshAll = async () => {
    await fetchConversations({
      silent: false,
    });

    if (selectedIdRef.current) {
      await fetchMessages(
        selectedIdRef.current,
        {
          silent: false,
        }
      );
    }
  };

  useEffect(() => {
    setSelectedAvatarExists(null);
    setAvatarMessage('');
    setAvatarMessageKind('');
  }, [selectedId]);

  const selectedAvatarEndpoint =
    selectedConversation?.id
      ? `/api/inbox/conversations/${encodeURIComponent(
          selectedConversation.id
        )}/avatar`
      : '';

  useEffect(() => {
    return aaSubscribeContactAvatarSync(
      (payload) => {
        setAvatarVersion(payload.version);

        if (
          firstText(selectedConversation?.id) ===
          payload.conversationId
        ) {
          setSelectedAvatarExists(
            payload.action !== 'remove'
          );
        }
      }
    );
  }, [selectedConversation?.id]);

  const handleContactAvatarChoose = () => {
    if (avatarBusy) {
      return;
    }

    document
      .getElementById(
        'aa-contact-avatar-file-input'
      )
      ?.click();
  };

  const aaOpenAvatarCrop = (
    blob,
    options = {}
  ) => {
    if (!(blob instanceof Blob)) {
      throw new Error(
        'A imagem não pôde ser preparada para o recorte.'
      );
    }

    if (!selectedAvatarEndpoint) {
      throw new Error(
        'Selecione uma conversa antes de atualizar a foto.'
      );
    }

    const previewUrl =
      URL.createObjectURL(blob);

    setAvatarCropError('');

    setAvatarCropSource({
      blob,
      previewUrl,
      endpoint:
        selectedAvatarEndpoint,

      conversationId:
        firstText(selectedConversation?.id),

      source:
        options?.source ||
        'manual',

      sourceLabel:
        options?.sourceLabel ||
        'Imagem selecionada',

      complete:
        typeof options?.complete ===
        'function'
          ? options.complete
          : null,

      successMessage:
        options?.successMessage ||
        'Foto do contato salva com sucesso.',

      externalSuccessMessage:
        options?.externalSuccessMessage ||
        'Foto do contato atualizada.',
    });
  };

  useEffect(() => {
    const previewUrl =
      avatarCropSource?.previewUrl;

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        );
      }
    };
  }, [
    avatarCropSource?.previewUrl,
  ]);

  const aaCloseAvatarCrop = ({
    cancelled = false,
  } = {}) => {
    const current =
      avatarCropSource;

    if (!current) {
      return;
    }

    if (
      cancelled &&
      typeof current.complete ===
        'function'
    ) {
      current.complete({
        ok: false,
        cancelled: true,
      });
    }

    setAvatarCropError('');
    setAvatarCropSource(null);
  };

  const aaHandleAvatarCropSave =
    async (croppedBlob) => {
      const current =
        avatarCropSource;

      if (
        !current ||
        !(croppedBlob instanceof Blob)
      ) {
        return;
      }

      if (!accessToken) {
        setAvatarCropError(
          'Sua sessão expirou. Entre novamente para continuar.'
        );
        return;
      }

      setAvatarCropSubmitting(true);
      setAvatarBusy(true);
      setAvatarCropError('');
      setAvatarMessage('');
      setAvatarMessageKind('');

      try {
        const file = new File(
          [croppedBlob],
          `contact-avatar-${Date.now()}.png`,
          {
            type: 'image/png',
          }
        );

        const formData =
          new FormData();

        formData.append(
          'file',
          file
        );

        const response = await fetch(
          current.endpoint,
          {
            method: 'POST',
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            credentials: 'same-origin',
            body: formData,
          }
        );

        const payload = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload?.message ||
            'Não foi possível salvar a foto recortada.'
          );
        }

        const syncPayload =
          aaPublishContactAvatarSync({
            conversationId:
              current.conversationId,
            action: 'upsert',
          });

        setSelectedAvatarExists(true);
        setAvatarVersion(
          syncPayload?.version ||
          Date.now()
        );

        setAvatarMessage(
          current.successMessage
        );
        setAvatarMessageKind('success');

        current.complete?.({
          ok: true,
          message:
            current.externalSuccessMessage,
        });

        setAvatarCropSource(null);
        setAvatarCropError('');
      } catch (error) {
        const message =
          error?.message ||
          'Não foi possível salvar a foto recortada.';

        setAvatarCropError(message);
        setAvatarMessage(message);
        setAvatarMessageKind('error');
      } finally {
        setAvatarCropSubmitting(false);
        setAvatarBusy(false);
      }
    };

  const handleContactAvatarFileChange =
    async (event) => {
      const input =
        event.currentTarget;

      const file =
        input.files?.[0] || null;

      input.value = '';

      if (!file) {
        return;
      }

      setAvatarMessage('');
      setAvatarMessageKind('');

      if (!selectedAvatarEndpoint) {
        setAvatarMessage(
          'Selecione uma conversa antes de adicionar a foto.'
        );
        setAvatarMessageKind('error');
        return;
      }

      if (!accessToken) {
        setAvatarMessage(
          'Sua sessão expirou. Entre novamente para continuar.'
        );
        setAvatarMessageKind('error');
        return;
      }

      const allowedTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
      ]);

      if (!allowedTypes.has(file.type)) {
        setAvatarMessage(
          'Use uma imagem JPEG, PNG ou WebP.'
        );
        setAvatarMessageKind('error');
        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        setAvatarMessage(
          'A foto deve ter no máximo 5 MB.'
        );
        setAvatarMessageKind('error');
        return;
      }

      try {
        aaOpenAvatarCrop(
          file,
          {
            source: 'manual',
            sourceLabel:
              file.name ||
              'Arquivo selecionado',

            successMessage:
              'Foto do contato recortada e salva com sucesso.',
          }
        );
      } catch (error) {
        setAvatarMessage(
          error?.message ||
          'Não foi possível preparar a foto.'
        );
        setAvatarMessageKind('error');
      }
    };

  useEffect(() => {
    const handleUseInboundImageAsAvatar =
      async (event) => {
        const detail =
          event?.detail || {};

        const complete =
          typeof detail?.complete ===
          'function'
            ? detail.complete
            : () => {};

        try {
          if (!selectedAvatarEndpoint) {
            throw new Error(
              'Selecione uma conversa para atualizar a foto.'
            );
          }

          if (!accessToken) {
            throw new Error(
              'Sua sessão expirou. Entre novamente para continuar.'
            );
          }

          const blob =
            detail?.blob;

          if (!(blob instanceof Blob)) {
            throw new Error(
              'A imagem recebida não pôde ser preparada.'
            );
          }

          const normalizedMime =
            String(
              blob.type || ''
            )
              .split(';')[0]
              .trim()
              .toLowerCase();

          const allowedTypes =
            new Set([
              'image/jpeg',
              'image/png',
              'image/webp',
            ]);

          if (
            !allowedTypes.has(
              normalizedMime
            )
          ) {
            throw new Error(
              'A imagem precisa ser JPEG, PNG ou WebP.'
            );
          }

          if (
            blob.size >
            5 * 1024 * 1024
          ) {
            throw new Error(
              'A imagem deve ter no máximo 5 MB.'
            );
          }

          aaOpenAvatarCrop(
            blob,
            {
              source: 'inbound',

              sourceLabel:
                'Imagem recebida do cliente',

              complete,

              successMessage:
                'Imagem recebida recortada e definida como foto do contato.',

              externalSuccessMessage:
                'Imagem recortada e definida como foto do contato.',
            }
          );
        } catch (error) {
          const message =
            error?.message ||
            'Não foi possível preparar a imagem como foto.';

          setAvatarMessage(message);
          setAvatarMessageKind('error');

          complete({
            ok: false,
            message,
          });
        }
      };

    window.addEventListener(
      'aa-use-inbound-image-as-avatar-request',
      handleUseInboundImageAsAvatar
    );

    return () => {
      window.removeEventListener(
        'aa-use-inbound-image-as-avatar-request',
        handleUseInboundImageAsAvatar
      );
    };
  }, [
    accessToken,
    selectedAvatarEndpoint,
  ]);

  const handleContactAvatarRemove = async () => {
    if (
      avatarBusy ||
      !selectedAvatarEndpoint ||
      !selectedAvatarExists
    ) {
      return;
    }

    if (!accessToken) {
      setAvatarMessage(
        'Sua sessão expirou. Entre novamente para continuar.'
      );
      setAvatarMessageKind('error');
      return;
    }

    const confirmed = window.confirm(
      'Remover a foto deste contato?'
    );

    if (!confirmed) {
      return;
    }

    setAvatarBusy(true);
    setAvatarMessage('');
    setAvatarMessageKind('');

    try {
      const response = await fetch(
        selectedAvatarEndpoint,
        {
          method: 'DELETE',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          credentials: 'same-origin',
          cache: 'no-store',
        }
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.message ||
          'Não foi possível remover a foto.'
        );
      }

      const syncPayload =
        aaPublishContactAvatarSync({
          conversationId:
            firstText(selectedConversation?.id),
          action: 'remove',
        });

      setSelectedAvatarExists(false);
      setAvatarVersion(
        syncPayload?.version ||
        Date.now()
      );
      setAvatarMessage(
        'Foto removida com sucesso.'
      );
      setAvatarMessageKind('success');
    } catch (error) {
      setAvatarMessage(
        error?.message ||
        'Não foi possível remover a foto.'
      );
      setAvatarMessageKind('error');
    } finally {
      setAvatarBusy(false);
    }
  };

  if (
    typeof document === 'undefined'
  ) {
    return null;
  }

  return createPortal(
    <div
      className={cx(
        styles.portal,
        detailsOpen &&
          styles.detailsOpen,
        compact &&
          styles.compact,
        narrow &&
          styles.narrow
      )}
      style={{
        '--aa-inbox-left':
          `${bounds.left}px`,
        '--aa-inbox-top':
          `${bounds.top}px`,
      }}
      data-aa-inbox-version="real-v1"
      data-aa-real-inbox={
        AA_REAL_INBOX_MARKER
      }
    >
      {avatarCropSource ? (
        <AvatarCropModal
          sourceUrl={
            avatarCropSource.previewUrl
          }
          sourceLabel={
            avatarCropSource.sourceLabel
          }
          busy={avatarCropSubmitting}
          errorMessage={avatarCropError}
          onCancel={() =>
            aaCloseAvatarCrop({
              cancelled: true,
            })
          }
          onSave={
            aaHandleAvatarCropSave
          }
        />
      ) : null}

      <section
        className={styles.conversationPanel}
      >
        <header
          className={styles.conversationHeader}
        >
          <div>
            <span>
              Central de atendimento
            </span>

            <h1>Conversas</h1>
          </div>

          <button
            type="button"
            className={styles.iconButton}
            title="Atualizar conversas"
            aria-label="Atualizar conversas"
            onClick={refreshAll}
            disabled={loadingList}
          >
            {loadingList ? (
              <Loader2
                aria-hidden="true"
                className={styles.spinning}
              />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
          </button>
        </header>

        <div className={styles.search}>
          <Search aria-hidden="true" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Buscar conversa"
            aria-label="Buscar conversa"
          />
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            className={
              filter === 'all'
                ? styles.filterActive
                : undefined
            }
            onClick={() =>
              setFilter('all')
            }
          >
            Todas
            <span>{counts.all}</span>
          </button>

          <button
            type="button"
            className={
              filter === 'unread'
                ? styles.filterActive
                : undefined
            }
            onClick={() =>
              setFilter('unread')
            }
          >
            Não lidas
            <span>{counts.unread}</span>
          </button>

          <button
            type="button"
            className={
              filter === 'mine'
                ? styles.filterActive
                : undefined
            }
            onClick={() =>
              setFilter('mine')
            }
          >
            Minhas
            <span>{counts.mine}</span>
          </button>
        </div>

        <div
          className={styles.conversationList}
          aria-live="polite"
        >
          {listError ? (
            <div className={styles.errorState}>
              <AlertCircle aria-hidden="true" />

              <span>{listError}</span>

              <button
                type="button"
                onClick={() =>
                  fetchConversations({
                    silent: false,
                  })
                }
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {loadingList &&
          conversations.length === 0 ? (
            <div className={styles.loadingState}>
              <Loader2
                aria-hidden="true"
                className={styles.spinning}
              />

              <span>
                Carregando conversas…
              </span>
            </div>
          ) : null}

          {!loadingList &&
          !listError &&
          filteredConversations.length === 0 ? (
            <div className={styles.emptyState}>
              <span>
                {search
                  ? 'Nenhuma conversa encontrada.'
                  : filter === 'mine'
                    ? 'Nenhuma conversa atribuída a você.'
                    : filter === 'unread'
                      ? 'Nenhuma conversa não lida.'
                      : 'Nenhuma conversa disponível.'}
              </span>
            </div>
          ) : null}

          {filteredConversations.map(
            (conversation) => {
              const isSelected =
                conversation.id ===
                selectedId;

              return (
                <button
                  type="button"
                  key={conversation.id}
                  className={cx(
                    styles.conversation,
                    isSelected &&
                      styles.conversationSelected
                  )}
                  onClick={() =>
                    handleConversationSelect(
                      conversation.id
                    )
                  }
                >
                  <span
                    className={cx(
                      styles.avatar,
                      styles[
                        `avatar_${conversation.tone}`
                      ]
                    )}
                  >
                    <AvatarContent
                      conversation={conversation}
                      accessToken={accessToken}
                      version={avatarVersion}
                    />
                  </span>

                  <span
                    className={
                      styles.conversationCopy
                    }
                  >
                    <span
                      className={
                        styles.conversationTitle
                      }
                    >
                      <strong>
                        {conversation.name}
                      </strong>

                      <time
                        dateTime={
                          conversation.timestamp
                            ? String(
                                conversation.timestamp
                              )
                            : undefined
                        }
                        title={
                          conversation.time
                        }
                      >
                        {conversation.time}
                      </time>
                    </span>

                    <p>
                      {aaHumanizeMediaPreviewText(
                        conversation.preview
                      )}
                    </p>

                    <span
                      className={
                        styles.conversationMeta
                      }
                    >
                      <span
                        className={cx(
                          styles.mode,
                          conversation.mode ===
                          'human'
                            ? styles.modeHuman
                            : styles.modeBot
                        )}
                      >
                        {conversation.mode ===
                        'human' ? (
                          <User
                            aria-hidden="true"
                          />
                        ) : (
                          <Bot
                            aria-hidden="true"
                          />
                        )}

                        {conversation.mode ===
                        'human'
                          ? 'Humano'
                          : 'Bot'}
                      </span>

                      {conversation.label ? (
                        <span
                          className={
                            styles.tag
                          }
                        >
                          {conversation.label}
                        </span>
                      ) : null}

                      {conversation.unread > 0 ? (
                        <span
                          className={
                            styles.unread
                          }
                        >
                          {conversation.unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            }
          )}
        </div>
      </section>

      <main className={styles.chat}>
        <header className={styles.chatHeader}>
          {selectedConversation ? (
            <div
              className={cx(
                styles.chatContact,
                styles.chatContactAction
              )}
              role="button"
              tabIndex={0}
              aria-label="Abrir informações do contato"
              aria-controls="aa-inbox-contact-details"
              aria-expanded={
                detailsOpen
                  ? 'true'
                  : 'false'
              }
              data-aa-contact-header-action="v19-b"
              onClick={() => {
                setDetailsOpen((current) => !current);
                setThreadMenuOpen(false);
              }}
              onKeyDown={(event) => {
                if (
                  event.key !== 'Enter' &&
                  event.key !== ' '
                ) {
                  return;
                }

                event.preventDefault();
                setDetailsOpen((current) => !current);
                setThreadMenuOpen(false);
              }}
            >
              <span
                className={cx(
                  styles.avatar,
                  styles[
                    `avatar_${selectedConversation.tone}`
                  ]
                )}
              >
                <AvatarContent
                  conversation={selectedConversation}
                  accessToken={accessToken}
                  version={avatarVersion}
                />
              </span>

              <div>
                <h2>
                  {selectedConversation.name}
                </h2>

                <span>
                  {selectedConversation.phone}

                  {selectedConversation.responsible
                    ? ` · Responsável: ${selectedConversation.responsible}`
                    : ''}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={styles.chatContact}
            >
              <div>
                <h2>
                  Nenhuma conversa selecionada
                </h2>

                <span>
                  Selecione um contato na lista
                </span>
              </div>
            </div>
          )}

          <div className={styles.chatActions}>
            {selectedConversation ? (
              <>
                <button
                  type="button"
                  className={cx(
                    styles.mode,
                    styles.modeAction,
                    selectedConversation.mode ===
                    'human'
                      ? styles.modeHuman
                      : styles.modeBot
                  )}
                  title={
                    selectedConversation.mode ===
                    'human'
                      ? 'Voltar esta conversa para o bot'
                      : 'Assumir esta conversa no atendimento humano'
                  }
                  aria-label={
                    selectedConversation.mode ===
                    'human'
                      ? 'Voltar conversa para o bot'
                      : 'Assumir conversa no humano'
                  }
                  onClick={handleModeToggle}
                  disabled={modeBusy}
                >
                  {modeBusy ? (
                    <Loader2
                      aria-hidden="true"
                      className={styles.spinning}
                    />
                  ) : selectedConversation.mode ===
                    'human' ? (
                    <User aria-hidden="true" />
                  ) : (
                    <Bot aria-hidden="true" />
                  )}

                  {selectedConversation.mode ===
                  'human'
                    ? 'Humano'
                    : 'Bot'}
                </button>

                <div
                  className={styles.labelControl}
                >
                  <button
                    type="button"
                    className={cx(
                      styles.headerButton,
                      styles.labelAction,
                      labelEditorOpen &&
                        styles.labelActionActive
                    )}
                    title="Editar etiqueta"
                    aria-label="Editar etiqueta da conversa"
                    aria-expanded={
                      labelEditorOpen
                        ? 'true'
                        : 'false'
                    }
                    onClick={() => {
                      setLabelDraft(
                        selectedConversation.label ||
                        ''
                      );

                      setLabelError('');
                      setModeError('');
                      setLabelEditorOpen(true);
                    }}
                  >
                    <Tag aria-hidden="true" />

                    <span>
                      {selectedConversation.label ||
                        'Sem etiqueta'}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.iconButton}
                  title={
                    detailsOpen
                      ? 'Fechar informações'
                      : 'Abrir informações'
                  }
                  aria-label={
                    detailsOpen
                      ? 'Fechar informações'
                      : 'Abrir informações'
                  }
                  onClick={() =>
                    setDetailsOpen(
                      (current) => !current
                    )
                  }
                >
                  {detailsOpen ? (
                    <PanelRightClose
                      aria-hidden="true"
                    />
                  ) : (
                    <PanelRightOpen
                      aria-hidden="true"
                    />
                  )}
                </button>

                <div
                  className={
                    styles.threadMenuWrap
                  }
                >
                  <button
                    ref={threadMenuButtonRef}
                    type="button"
                    className={
                      styles.iconButton
                    }
                    title="Ações da conversa"
                    aria-label="Ações da conversa"
                    aria-haspopup="menu"
                    aria-expanded={
                      threadMenuOpen
                        ? 'true'
                        : 'false'
                    }
                    onClick={() => {
                      setEmojiOpen(false);
                      setAttachmentOpen(false);
                      setThreadActionNotice('');

                      setThreadMenuOpen(
                        (current) =>
                          !current
                      );
                    }}
                  >
                    <MoreVertical
                      aria-hidden="true"
                    />
                  </button>

                  {threadMenuOpen ? (
                    <div
                      ref={threadMenuRef}
                      className={
                        styles.threadMenu
                      }
                      role="menu"
                      aria-label="Ações da conversa"
                      data-aa-thread-menu="v1.3"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={
                          threadActionBusy
                        }
                        onClick={
                          refreshThreadFromMenu
                        }
                      >
                        <RefreshCw
                          aria-hidden="true"
                        />

                        <span>
                          {threadActionBusy
                            ? 'Atualizando...'
                            : 'Atualizar histórico'}
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        disabled={
                          threadActionBusy
                        }
                        onClick={
                          copyThreadPhone
                        }
                      >
                        <Copy
                          aria-hidden="true"
                        />

                        <span>
                          Copiar telefone
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        disabled={
                          threadActionBusy
                        }
                        onClick={
                          openThreadInWhatsApp
                        }
                      >
                        <ExternalLink
                          aria-hidden="true"
                        />

                        <span>
                          Abrir no WhatsApp
                        </span>
                      </button>

                      {threadActionNotice ? (
                        <span
                          className={
                            styles.threadMenuNotice
                          }
                          role="status"
                        >
                          {threadActionNotice}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          {modeError ? (
            <div
              className={
                styles.headerActionError
              }
              role="alert"
            >
              <AlertCircle aria-hidden="true" />

              <span>
                {modeError}
              </span>
            </div>
          ) : null}
        </header>

        <section
          className={styles.messages}
            data-aa-native-messages-balance="true"
          aria-live="polite"
        >
          {selectedConversation ? (
            <div className={styles.dayMarker}>
              Hoje
            </div>
          ) : null}

          {messageError ? (
            <div className={styles.threadError}>
              <AlertCircle aria-hidden="true" />

              <span>{messageError}</span>

              <button
                type="button"
                onClick={() =>
                  fetchMessages(
                    selectedId,
                    {
                      silent: false,
                    }
                  )
                }
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {loadingMessages &&
          messages.length === 0 ? (
            <div
              className={styles.threadLoading}
            >
              <Loader2
                aria-hidden="true"
                className={styles.spinning}
              />

              <span>
                Carregando histórico…
              </span>
            </div>
          ) : null}

          {!loadingMessages &&
          !messageError &&
          selectedConversation &&
          messages.length === 0 ? (
            <div
              className={styles.threadEmpty}
            >
              Ainda não há mensagens nesta conversa.
            </div>
          ) : null}

          {!selectedConversation ? (
            <div
              className={styles.threadEmpty}
            >
              Selecione uma conversa para visualizar o histórico.
            </div>
          ) : null}

          {messages.map((message) => {
            const outbound =
              message.direction === 'outbound';

            return (
              <div
                key={message.id}
                className={cx(
                  styles.messageRow,
                  outbound
                    ? styles.messageRowOutbound
                    : styles.messageRowInbound
                )}
              >
                <article
                  data-aa-media-kind={
                    message.type
                  }
                  data-aa-chat-image-layout={
                    "__AUTOATENDE_CHAT_IMAGE_COMPACT_V1__"
                  }
                  className={cx(
                    styles.message,
                    outbound
                      ? styles.messageOutbound
                      : styles.messageInbound,
                    message.optimistic &&
                      styles.messageOptimistic
                  )}
                >
                  <span>
                    {message.sender}
                  </span>

                  <MessageBody
                    message={message}
                    accessToken={
                      accessToken
                    }
                  />

                  <footer>
                    {message.time}

                    {outbound ? (
                      <CheckCheck
                        aria-hidden="true"
                      />
                    ) : null}
                  </footer>
                </article>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </section>

        <form
          className={styles.composer}
          data-aa-premium-composer="v19-d-r2"
          onSubmit={
            voiceDraft
              ? submitVoice
              : mediaDraft
                ? submitMedia
                : submitMessage
          }
        >
          {composerError ? (
            <div
              className={
                styles.composerError
              }
              role="alert"
            >
              <AlertCircle aria-hidden="true" />
              {composerError}
            </div>
          ) : null}


          <input
            ref={fileInputRef}
            className={styles.hiddenFileInput}
            type="file"
            accept={AA_OUTBOUND_MEDIA_ACCEPT}
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleMediaFileSelected}
          />

          {isVoiceRecording ? (
            <section
              className={
                styles.voiceRecordingPanel
              }
              data-aa-voice-recorder={
                AA_VOICE_RECORDER_VERSION
              }
              aria-live="polite"
            >
              <span
                className={
                  styles.voiceRecordingPulse
                }
                aria-hidden="true"
              >
                <Mic />
              </span>

              <span
                className={
                  styles.voiceRecordingCopy
                }
              >
                <strong>
                  Gravando mensagem de voz
                </strong>

                <small>
                  {aaFormatVoiceDuration(
                    voiceElapsedSeconds
                  )}
                  {' / '}
                  {aaFormatVoiceDuration(
                    AA_VOICE_MAX_SECONDS
                  )}
                </small>
              </span>

              <span
                className={
                  styles.voiceRecordingWave
                }
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>

              <button
                type="button"
                className={
                  styles.voiceCancelButton
                }
                title="Cancelar gravação"
                aria-label="Cancelar gravação"
                onClick={
                  cancelVoiceRecording
                }
              >
                <Trash2
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                className={
                  styles.voiceStopButton
                }
                title="Finalizar gravação"
                aria-label="Finalizar gravação"
                onClick={
                  finishVoiceRecording
                }
              >
                <Square
                  aria-hidden="true"
                />
              </button>
            </section>
          ) : null}

          {voiceDraft ? (
            <section
              className={
                styles.voicePreviewPanel
              }
              data-aa-voice-preview="ready"
            >
              <span
                className={
                  styles.voicePreviewIcon
                }
                aria-hidden="true"
              >
                <Mic />
              </span>

              <span
                className={
                  styles.voicePreviewCopy
                }
              >
                <strong>
                  Mensagem de voz pronta
                </strong>

                <small>
                  {aaFormatVoiceDuration(
                    voiceDraft
                      .durationSeconds
                  )}
                  {' · ouvir antes de enviar'}
                </small>
              </span>

              {voicePreviewUrl ? (
                <audio
                  className={
                    styles.voicePreviewAudio
                  }
                  src={voicePreviewUrl}
                  controls
                  preload="metadata"
                />
              ) : null}

              <button
                type="button"
                className={
                  styles.voiceDiscardButton
                }
                title="Excluir gravação"
                aria-label="Excluir gravação"
                disabled={voiceSending}
                onClick={
                  clearVoiceDraft
                }
              >
                <Trash2
                  aria-hidden="true"
                />
              </button>
            </section>
          ) : null}

          {mediaDraft ? (
            <div
              className={styles.attachmentDraft}
              data-aa-media-draft={
                AA_OUTBOUND_MEDIA_VERSION
              }
            >
              {mediaDraft.kind === 'image' &&
              mediaPreviewUrl ? (
                <img
                  className={
                    styles.attachmentPreview
                  }
                  src={mediaPreviewUrl}
                  alt=""
                />
              ) : (
                <span
                  className={
                    styles.attachmentDraftIcon
                  }
                  aria-hidden="true"
                >
                  {mediaDraft.kind === 'video'
                    ? <VideoIcon />
                    : mediaDraft.kind ===
                        'audio'
                      ? <Volume2 />
                      : <FileText />}
                </span>
              )}

              <span
                className={
                  styles.attachmentDraftCopy
                }
              >
                <strong>
                  {mediaDraft.filename}
                </strong>

                <small>
                  {aaOutboundMediaLabel(
                    mediaDraft.kind
                  )}
                  {' · '}
                  {aaFormatOutboundFileSize(
                    mediaDraft.file.size
                  )}
                </small>
              </span>

              <button
                type="button"
                className={
                  styles.attachmentDraftRemove
                }
                title="Remover anexo"
                aria-label="Remover anexo"
                disabled={mediaSending}
                onClick={clearMediaDraft}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className={styles.composerBox}>

            {attachmentOpen ? (
              <div
                ref={attachmentMenuRef}
                className={
                  styles.attachmentMenu
                }
                data-aa-outside-dismiss="v1"
                data-aa-media-menu={
                  AA_OUTBOUND_MEDIA_VERSION
                }
              >
                <span
                  className={
                    styles.attachmentMenuTitle
                  }
                >
                  Enviar anexo
                </span>

                <button
                  type="button"
                  onClick={() =>
                    chooseAttachmentType(
                      'image/jpeg,image/png'
                    )
                  }
                >
                  <ImageIcon
                    aria-hidden="true"
                  />

                  <span>
                    <strong>Foto</strong>
                    <small>JPG ou PNG</small>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    chooseAttachmentType(
                      'video/mp4,video/3gpp'
                    )
                  }
                >
                  <VideoIcon
                    aria-hidden="true"
                  />

                  <span>
                    <strong>Vídeo</strong>
                    <small>MP4 ou 3GP</small>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    chooseAttachmentType(
                      [
                        'audio/aac',
                        'audio/amr',
                        'audio/mpeg',
                        'audio/mp4',
                        'audio/ogg',
                        '.aac',
                        '.amr',
                        '.mp3',
                        '.m4a',
                        '.ogg',
                      ].join(',')
                    )
                  }
                >
                  <Volume2
                    aria-hidden="true"
                  />

                  <span>
                    <strong>Áudio</strong>
                    <small>
                      MP3, M4A, AAC, AMR ou OGG Opus
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    chooseAttachmentType(
                      [
                        'application/pdf',
                        'text/plain',
                        'text/csv',
                        'application/json',
                        'application/rtf',
                        'application/zip',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-powerpoint',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                      ].join(',')
                    )
                  }
                >
                  <FileText
                    aria-hidden="true"
                  />

                  <span>
                    <strong>Documento</strong>
                    <small>
                      PDF, Office, texto ou ZIP
                    </small>
                  </span>
                </button>
              </div>
            ) : null}


            {emojiOpen ? (
              <div
                ref={emojiPickerRef}
                className={
                  styles.emojiPicker
                }
                data-aa-outside-dismiss="v1"
              >
                <header>
                  <span>Emojis</span>

                  <button
                    type="button"
                    onClick={() =>
                      setEmojiOpen(false)
                    }
                  >
                    Fechar
                  </button>
                </header>

                <div>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() =>
                        insertEmoji(emoji)
                      }
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              ref={attachmentButtonRef}
              type="button"
              className={
                styles.attachmentButton
              }
              title="Enviar foto, vídeo, áudio ou documento"
              aria-label="Enviar foto, vídeo, áudio ou documento"
              aria-expanded={
                attachmentOpen
                  ? 'true'
                  : 'false'
              }
              disabled={
                !selectedConversation ||
                sending ||
                mediaSending ||
                voiceSending ||
                isVoiceRecording ||
                Boolean(voiceDraft)
              }
              onClick={
                openAttachmentPicker
              }
            >
              <Paperclip aria-hidden="true" />
            </button>

            <button
              ref={emojiButtonRef}
              type="button"
              className={cx(
                styles.emojiButton,
                emojiOpen &&
                  styles.emojiButtonActive
              )}
              title="Inserir emoji"
              aria-label="Inserir emoji"
              onClick={() => {
                setAttachmentOpen(false);
                setEmojiOpen(
                  (current) => !current
                );
              }}
              disabled={
                !selectedConversation ||
                sending ||
                mediaSending ||
                voiceSending ||
                isVoiceRecording ||
                Boolean(voiceDraft)
              }
            >
              <Smile aria-hidden="true" />
            </button>

            <textarea
              ref={textareaRef}
              value={draft}
              placeholder={
                !selectedConversation
                  ? 'Selecione uma conversa'
                  : voiceDraft
                    ? 'Mensagem de voz pronta · texto será preservado'
                    : mediaDraft?.kind ===
                        'audio'
                    ? 'Áudio selecionado · texto será preservado'
                    : mediaDraft
                      ? 'Adicione uma legenda opcional'
                      : 'Digite uma mensagem'
              }
              aria-label="Mensagem"
              disabled={
                !selectedConversation ||
                sending ||
                mediaSending ||
                voiceSending ||
                isVoiceRecording ||
                Boolean(voiceDraft)
              }
              rows={1}
              onChange={(event) => {
                setDraft(
                  event.target.value
                );

                setComposerError('');

                window.requestAnimationFrame(
                  resizeTextarea
                );
              }}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  if (voiceDraft) {
                    submitVoice(event);
                  } else if (mediaDraft) {
                    submitMedia(event);
                  } else {
                    submitMessage(event);
                  }
                }
              }}
            />

            <button
              type={
                showVoiceAction
                  ? 'button'
                  : 'submit'
              }
              className={cx(
                styles.sendButton,
                showVoiceAction &&
                  styles.voiceMicButton
              )}
              title={
                showVoiceAction
                  ? 'Gravar mensagem de voz'
                  : voiceDraft
                    ? 'Enviar mensagem de voz'
                    : 'Enviar mensagem'
              }
              aria-label={
                showVoiceAction
                  ? 'Gravar mensagem de voz'
                  : voiceDraft
                    ? 'Enviar mensagem de voz'
                    : 'Enviar mensagem'
              }
              disabled={
                !selectedConversation ||
                sending ||
                mediaSending ||
                voiceSending ||
                isVoiceRecording ||
                (
                  showVoiceAction &&
                  selectedConversation
                    ?.mode !== 'human'
                ) ||
                (
                  !showVoiceAction &&
                  !voiceDraft &&
                  !mediaDraft &&
                  !draft.trim()
                )
              }
            
              onClick={
                showVoiceAction
                  ? startVoiceRecording
                  : undefined
              }>
              {sending || mediaSending || voiceSending ? (
                <Loader2
                  aria-hidden="true"
                  className={styles.spinning}
                />
              ) : (
                showVoiceAction ? (
                  <Mic
                    aria-hidden="true"
                  />
                ) : (
                  <Send
                    aria-hidden="true"
                  />
                )
              )}
            </button>
          </div>
        </form>
      </main>

      {labelEditorOpen &&
      selectedConversation ? (
        <div
          className={
            styles.labelModalBackdrop
          }
          data-aa-label-modal={
            AA_LABEL_MODAL_VERSION
          }
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !labelBusy
            ) {
              setLabelEditorOpen(false);
              setLabelError('');
            }
          }}
        >
          <section
            className={styles.labelModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="aa-label-modal-title"
            onKeyDown={(event) => {
              if (
                event.key === 'Escape' &&
                !labelBusy
              ) {
                event.preventDefault();
                setLabelEditorOpen(false);
                setLabelError('');
              }
            }}
          >
            <header
              className={
                styles.labelModalHeader
              }
            >
              <div>
                <span
                  className={
                    styles.labelModalEyebrow
                  }
                >
                  Organização da conversa
                </span>

                <h2 id="aa-label-modal-title">
                  Editar etiqueta
                </h2>

                <p>
                  Classifique esta conversa para facilitar
                  o acompanhamento da equipe.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.labelModalClose
                }
                aria-label="Fechar editor de etiqueta"
                title="Fechar"
                disabled={labelBusy}
                onClick={() => {
                  setLabelEditorOpen(false);
                  setLabelError('');
                }}
              >
                <span aria-hidden="true">
                  ×
                </span>
              </button>
            </header>

            <div
              className={
                styles.labelContactContext
              }
            >
              <span
                className={cx(
                  styles.avatar,
                  styles[
                    `avatar_${selectedConversation.tone}`
                  ]
                )}
              >
                <AvatarContent
                  conversation={selectedConversation}
                  accessToken={accessToken}
                  version={avatarVersion}
                />
              </span>

              <span>
                <strong>
                  {selectedConversation.name}
                </strong>

                <small>
                  {selectedConversation.phone}
                </small>
              </span>

              <span
                className={
                  styles.labelCurrentValue
                }
              >
                {selectedConversation.label ||
                  'Sem etiqueta'}
              </span>
            </div>

            <form
              className={
                styles.labelModalForm
              }
              onSubmit={(event) => {
                event.preventDefault();
                handleLabelSave();
              }}
            >
              <label
                className={styles.labelField}
              >
                <span>Nova etiqueta</span>

                <div
                  className={
                    styles.labelInputShell
                  }
                >
                  <Tag aria-hidden="true" />

                  <input
                    type="text"
                    value={labelDraft}
                    maxLength={48}
                    autoFocus
                    disabled={labelBusy}
                    placeholder="Ex.: Lead quente"
                    onChange={(event) => {
                      setLabelDraft(
                        event.target.value
                      );

                      setLabelError('');
                    }}
                  />
                </div>

                <small>
                  Use um nome curto e fácil de reconhecer.
                </small>
              </label>

              <div
                className={
                  styles.labelSuggestionGroup
                }
              >
                <span>Sugestões rápidas</span>

                <div>
                  {LABEL_SUGGESTIONS.map(
                    (suggestion) => {
                      const active =
                        labelDraft
                          .trim()
                          .toLowerCase() ===
                        suggestion.toLowerCase();

                      return (
                        <button
                          key={suggestion}
                          type="button"
                          className={cx(
                            styles.labelSuggestion,
                            active &&
                              styles.labelSuggestionActive
                          )}
                          disabled={labelBusy}
                          onClick={() => {
                            setLabelDraft(
                              suggestion
                            );

                            setLabelError('');
                          }}
                        >
                          {suggestion}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {labelError ? (
                <div
                  className={
                    styles.labelModalError
                  }
                  role="alert"
                >
                  <AlertCircle
                    aria-hidden="true"
                  />

                  <span>{labelError}</span>
                </div>
              ) : null}

              <footer
                className={
                  styles.labelModalFooter
                }
              >
                <button
                  type="button"
                  className={
                    styles.labelRemoveButton
                  }
                  disabled={
                    labelBusy ||
                    !selectedConversation.label
                  }
                  onClick={() =>
                    handleLabelSave('')
                  }
                >
                  Remover etiqueta
                </button>

                <div>
                  <button
                    type="button"
                    className={
                      styles.labelCancelButton
                    }
                    disabled={labelBusy}
                    onClick={() => {
                      setLabelEditorOpen(false);
                      setLabelError('');
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className={
                      styles.labelSaveButton
                    }
                    disabled={
                      labelBusy ||
                      !labelDraft.trim()
                    }
                  >
                    {labelBusy ? (
                      <Loader2
                        aria-hidden="true"
                        className={
                          styles.spinning
                        }
                      />
                    ) : (
                      <Tag aria-hidden="true" />
                    )}

                    Salvar etiqueta
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {detailsOpen &&
      selectedConversation ? (
        <aside
          id="aa-inbox-contact-details"
          className={styles.details}
          data-aa-contact-panel="v19-b"
          aria-label="Informações do contato"
        >
          <header
            className={styles.detailsHeader}
          >
            <h2>
              Informações do contato
            </h2>

            <button
              type="button"
              className={styles.iconButton}
              aria-label="Fechar informações"
              title="Fechar informações"
              onClick={
                handleDetailsClose
              }
            >
              <PanelRightClose
                aria-hidden="true"
              />
            </button>
          </header>

          <section
            className={
              styles.contactSummary
            }
          >
            <span
              className={cx(
                styles.avatar,
                styles.avatarLarge,
                styles[
                  `avatar_${selectedConversation.tone}`
                ]
              )}
            >
              <AvatarContent
                  conversation={selectedConversation}
                  accessToken={accessToken}
                  version={avatarVersion}
                  onPresenceChange={
                    setSelectedAvatarExists
                  }
                />
            </span>

            <strong>
              {selectedConversation.name}
            </strong>

            <span>
              {selectedConversation.phone}
            </span>

            <div
              className={styles.avatarActions}
              data-aa-contact-avatar-controls={
                '__AUTOATENDE_CONTACT_AVATAR_FRONTEND_V1__'
              }
            >
              <input
                id="aa-contact-avatar-file-input"
                className={styles.avatarFileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handleContactAvatarFileChange
                }
                disabled={avatarBusy}
              />

              <button
                type="button"
                className={styles.avatarPrimaryAction}
                onClick={handleContactAvatarChoose}
                disabled={avatarBusy}
              >
                {avatarBusy
                  ? 'Processando…'
                  : selectedAvatarExists
                    ? 'Trocar foto'
                    : 'Adicionar foto'}
              </button>

              <button
                type="button"
                className={styles.avatarRemoveAction}
                onClick={handleContactAvatarRemove}
                disabled={
                  avatarBusy ||
                  !selectedAvatarExists
                }
              >
                Remover
              </button>
            </div>

            {avatarMessage ? (
              <small
                className={cx(
                  styles.avatarMessage,
                  avatarMessageKind === 'error'
                    ? styles.avatarMessageError
                    : styles.avatarMessageSuccess
                )}
                role={
                  avatarMessageKind === 'error'
                    ? 'alert'
                    : 'status'
                }
              >
                {avatarMessage}
              </small>
            ) : null}
          </section>

          <section
            className={
              styles.detailsSection
            }
          >
            <h3>Sobre o contato</h3>

            <dl>
              <div>
                <dt>Primeira conversa</dt>
                <dd>
                  {formatDate(
                    selectedConversation.createdAt
                  )}
                </dd>
              </div>

              <div>
                <dt>Última mensagem</dt>
                <dd>
                  {selectedConversation.time ||
                    '—'}
                </dd>
              </div>

              <div>
                <dt>Mensagens</dt>
                <dd>
                  {selectedConversation.messageCount ||
                    messages.length}
                </dd>
              </div>

              <div>
                <dt>Responsável</dt>
                <dd>
                  {selectedConversation.responsible ||
                    'Não atribuído'}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className={
              styles.detailsSection
            }
          >
            <h3>Etiquetas</h3>

            <div
              className={styles.detailTags}
            >
              {selectedConversation.labels.length ? (
                selectedConversation.labels.map(
                  (label) => (
                    <span key={label}>
                      {label}
                    </span>
                  )
                )
              ) : (
                <span>Sem etiqueta</span>
              )}
            </div>
          </section>

          <section
            className={cx(
              styles.detailsSection,
              styles.internalNoteSection
            )}
            data-aa-contact-internal-note={
              '__AUTOATENDE_CONTACT_INTERNAL_NOTES_INBOX_V1__'
            }
          >
            <div className={styles.internalNoteHeader}>
              <h3>Observação interna</h3>
              <span
                className={styles.internalNotePrivacy}
                title="Esta informação não é enviada ao cliente"
              >
                Privada
              </span>
            </div>

            <p className={styles.internalNoteHelp}>
              Registre contexto para a equipe. Esta informação nunca é enviada pelo WhatsApp.
            </p>

            {internalNoteLoading ? (
              <div
                className={styles.internalNoteLoading}
                role="status"
              >
                Carregando observação…
              </div>
            ) : (
              <div className={styles.internalNoteEditor}>
                <textarea
                  className={styles.internalNoteTextarea}
                  value={internalNoteDraft}
                  maxLength={4000}
                  rows={5}
                  placeholder="Ex.: prefere contato pela manhã, solicitou retorno na sexta-feira ou demonstrou interesse no plano intermediário."
                  aria-label="Observação interna do contato"
                  aria-describedby="aa-internal-note-guidance"
                  disabled={
                    internalNoteSaving ||
                    internalNoteDeleting
                  }
                  onChange={(event) => {
                    setInternalNoteDraft(event.target.value);
                    setInternalNoteMessage('');
                    setInternalNoteMessageKind('');
                  }}
                  onKeyDown={handleInternalNoteKeyDown}
                />

                <div
                  id="aa-internal-note-guidance"
                  className={styles.internalNoteMeta}
                >
                  <span
                    className={cx(
                      styles.internalNoteState,
                      internalNoteDirty &&
                        styles.internalNoteStateDirty
                    )}
                  >
                    {internalNoteDirty
                      ? 'Alterações não salvas'
                      : internalNoteExists
                        ? 'Observação salva'
                        : 'Sem observação'}
                  </span>

                  <span
                    className={cx(
                      styles.internalNoteCounter,
                      internalNoteCharacterCount >= 3600 &&
                        styles.internalNoteCounterWarning
                    )}
                  >
                    {internalNoteCharacterCount.toLocaleString('pt-BR')}
                    /4.000
                  </span>
                </div>

                {internalNoteRecord?.updated_at ? (
                  <small className={styles.internalNoteUpdatedAt}>
                    Última atualização:{' '}
                    {formatInternalNoteUpdatedAt(
                      internalNoteRecord.updated_at
                    )}
                  </small>
                ) : null}

                {internalNoteMessage ? (
                  <div
                    className={cx(
                      styles.internalNoteMessage,
                      internalNoteMessageKind === 'error'
                        ? styles.internalNoteMessageError
                        : styles.internalNoteMessageSuccess
                    )}
                    role={
                      internalNoteMessageKind === 'error'
                        ? 'alert'
                        : 'status'
                    }
                  >
                    {internalNoteMessage}
                  </div>
                ) : null}

                <div className={styles.internalNoteActions}>
                  <button
                    type="button"
                    className={styles.internalNoteRemove}
                    onClick={handleInternalNoteDelete}
                    disabled={
                      !internalNoteExists ||
                      internalNoteBusy
                    }
                  >
                    {internalNoteDeleting
                      ? 'Removendo…'
                      : 'Remover'}
                  </button>

                  <div>
                    <button
                      type="button"
                      className={styles.internalNoteRestore}
                      onClick={handleInternalNoteRestore}
                      disabled={
                        !internalNoteDirty ||
                        internalNoteBusy
                      }
                    >
                      Desfazer
                    </button>

                    <button
                      type="button"
                      className={styles.internalNoteSave}
                      onClick={handleInternalNoteSave}
                      disabled={
                        !internalNoteDirty ||
                        !internalNoteNormalizedDraft ||
                        internalNoteCharacterCount > 4000 ||
                        internalNoteBusy
                      }
                      title="Salvar observação (Ctrl + Enter)"
                    >
                      {internalNoteSaving
                        ? 'Salvando…'
                        : internalNoteExists
                          ? 'Salvar alterações'
                          : 'Salvar observação'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section
            className={cx(
              styles.detailsSection,
              styles.followupSection
            )}
            data-aa-contact-followup={
              '__AUTOATENDE_CONTACT_FOLLOWUP_INBOX_V1__'
            }
          >
            <div className={styles.followupHeader}>
              <h3>Retorno programado</h3>

              <span
                className={cx(
                  styles.followupStatus,
                  followupVisualStatus.key === 'none' &&
                    styles.followupStatusNone,
                  followupVisualStatus.key === 'scheduled' &&
                    styles.followupStatusScheduled,
                  followupVisualStatus.key === 'soon' &&
                    styles.followupStatusSoon,
                  followupVisualStatus.key === 'overdue' &&
                    styles.followupStatusOverdue
                )}
              >
                {followupVisualStatus.label}
              </span>
            </div>

            <p className={styles.followupHelp}>
              Defina a próxima ação da equipe. Nenhuma mensagem é enviada automaticamente ao cliente.
            </p>

            {followupLoading ? (
              <div
                className={styles.followupLoading}
                role="status"
              >
                Carregando retorno…
              </div>
            ) : (
              <div className={styles.followupEditor}>
                {followupExists ? (
                  <div className={styles.followupCurrent}>
                    <span>Retorno ativo</span>
                    <strong>
                      {aaFormatContactFollowupLocal(
                        followupRecord?.due_at
                      )}
                    </strong>
                  </div>
                ) : null}

                <label className={styles.followupField}>
                  <span>Data e horário</span>
                  <input
                    type="datetime-local"
                    className={styles.followupInput}
                    value={followupDraftDueAt}
                    disabled={followupBusy}
                    required
                    aria-label="Data e horário do retorno programado"
                    onChange={(event) => {
                      setFollowupDraftDueAt(
                        event.target.value
                      );
                      setFollowupMessage('');
                      setFollowupMessageKind('');
                    }}
                    onKeyDown={handleFollowupKeyDown}
                  />
                </label>

                <label className={styles.followupField}>
                  <span>Contexto opcional</span>
                  <textarea
                    className={styles.followupTextarea}
                    value={followupDraftSummary}
                    maxLength={500}
                    rows={4}
                    placeholder="Ex.: confirmar quantidade, revisar proposta ou retomar negociação."
                    aria-label="Contexto do retorno programado"
                    disabled={followupBusy}
                    onChange={(event) => {
                      setFollowupDraftSummary(
                        event.target.value
                      );
                      setFollowupMessage('');
                      setFollowupMessageKind('');
                    }}
                    onKeyDown={handleFollowupKeyDown}
                  />
                </label>

                <div className={styles.followupMeta}>
                  <span
                    className={cx(
                      followupDirty &&
                        styles.followupDirty
                    )}
                  >
                    {followupDirty
                      ? 'Alterações não salvas'
                      : followupExists
                        ? 'Retorno salvo'
                        : 'Sem retorno programado'}
                  </span>

                  <span
                    className={cx(
                      followupCharacterCount >= 450 &&
                        styles.followupCounterWarning
                    )}
                  >
                    {followupCharacterCount.toLocaleString('pt-BR')}
                    /500
                  </span>
                </div>

                {followupMessage ? (
                  <div
                    className={cx(
                      styles.followupMessage,
                      followupMessageKind === 'error'
                        ? styles.followupMessageError
                        : styles.followupMessageSuccess
                    )}
                    role={
                      followupMessageKind === 'error'
                        ? 'alert'
                        : 'status'
                    }
                  >
                    {followupMessage}
                  </div>
                ) : null}

                <div className={styles.followupActions}>
                  <div className={styles.followupSecondaryActions}>
                    <button
                      type="button"
                      className={cx(
                        styles.followupButton,
                        styles.followupCancel
                      )}
                      onClick={handleFollowupCancel}
                      disabled={
                        !followupExists ||
                        followupBusy
                      }
                    >
                      {followupCanceling
                        ? 'Cancelando…'
                        : 'Cancelar'}
                    </button>

                    <button
                      type="button"
                      className={cx(
                        styles.followupButton,
                        styles.followupComplete
                      )}
                      onClick={handleFollowupComplete}
                      disabled={
                        !followupExists ||
                        followupBusy
                      }
                    >
                      {followupCompleting
                        ? 'Concluindo…'
                        : 'Concluir'}
                    </button>
                  </div>

                  <div className={styles.followupPrimaryActions}>
                    <button
                      type="button"
                      className={cx(
                        styles.followupButton,
                        styles.followupRestore
                      )}
                      onClick={handleFollowupRestore}
                      disabled={
                        !followupDirty ||
                        followupBusy
                      }
                    >
                      Desfazer
                    </button>

                    <button
                      type="button"
                      className={cx(
                        styles.followupButton,
                        styles.followupSave
                      )}
                      onClick={handleFollowupSave}
                      disabled={
                        !followupDirty ||
                        !followupDraftDueAt ||
                        followupCharacterCount > 500 ||
                        followupBusy
                      }
                      title="Salvar retorno (Ctrl + Enter)"
                    >
                      {followupSaving
                        ? 'Salvando…'
                        : followupExists
                          ? 'Atualizar'
                          : 'Programar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section
            className={
              styles.detailsSection
            }
          >
            <h3>Contexto operacional</h3>

            <p className={styles.detailsNote}>
              Esta tela utiliza as conversas e mensagens reais da empresa. O histórico é sincronizado automaticamente.
            </p>
          </section>
        </aside>
      ) : null}
    </div>,
    document.body
  );
}

export default Inbox;
