/* __AUTOATENDE_V4_R29D_R2_INBOX_CLEAN_UNSUPPORTED_FALLBACK_SAFE_PUBLISH__ */

// __AUTOATENDE_V4_R13B_INBOX_TEMPLATE_AND_LAYOUT_POLISH__
// Helpers visuais do Inbox: normalizam mensagens técnicas de template sem alterar backend/banco.
const AA_R13B_TEMPLATE_MARKER = "__AUTOATENDE_V4_R13B_INBOX_TEMPLATE_AND_LAYOUT_POLISH__";


// __AUTOATENDE_V4_R13C_R2A_FIX2_RESTORE_SAFE_TEMPLATE_CLEANING_JS__
// Trim seguro para prefixos técnicos sem reintroduzir literal CSS inválido no bundle.
function aaR13CFix2TrimTemplatePrefix(value) {
  const bullet = String.fromCharCode(8226);
  const pattern = new RegExp("^[\\-:" + bullet + "\\s]+");
  return String(value || "").replace(pattern, "").trim();
}

function aaR13BCleanTemplateText(raw) {
  const text = String(raw ?? "");

  if (!text.trim()) return text;

  const lower = text.toLowerCase();

  const looksLikeTemplate =
    lower.includes("[template enviado]") ||
    lower.includes("template enviado") ||
    lower.includes("template:") ||
    lower.includes("template_name") ||
    lower.includes("template name");

  if (!looksLikeTemplate) return text;

  let cleaned = text
    .replace(/\[\s*template enviado\s*\]/gi, "")
    .replace(/template enviado/gi, "")
    .replace(/template_name/gi, "template")
    .replace(/template name/gi, "template")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = aaR13CFix2TrimTemplatePrefix(cleaned);


  if (!cleaned) {
    return "Template enviado ao cliente.";
  }

  return `Template enviado: ${cleaned}`;
}

function aaR13BIsTemplateMessage(raw) {
  const text = String(raw ?? "").toLowerCase();
return (
    text.includes("[template enviado]") ||
    text.includes("template enviado") ||
    text.includes("template_name") ||
    text.includes("template name")
  );
}

function aaR13BMessageText(raw) {
  return aaR13BCleanTemplateText(raw);
}

/* __AUTOATENDE_C7F_R2_BUTTON_SEMANTICS__ */
/* __AUTOATENDE_C7E_R1_FIX2_INBOX_SELF_REF_HOTFIX__ */
/* __AUTOATENDE_C7E_R1_INBOX_SINGLE_TRUTH_BRIDGE__ */
/* __AUTOATENDE_C7C_R1_INBOX_REASSIGN_MODAL__ */
/* __AUTOATENDE_C7B_HUMAN_OPS_FOUNDATION__ */
/* __AUTOATENDE_C5B1_R5_TOP_ACTION_RAIL__ */
/* __AUTOATENDE_C5B1_R3_INBOX_ACTION_RAIL__ */
/* __AUTOATENDE_C5A3_HF2_R1_INBOX_REPOSITION__ */
// __AUTOATENDE_C3D4_INBOX_OWNERSHIP__
// __AUTOATENDE_C3D3_INBOX_SEMANTICS__
// __AUTOATENDE_C3D2_INBOX_WORKSPACE__
// __AUTOATENDE_C3D1_INBOX_SURFACE__
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Search, Send, Loader2, User, Bot } from "lucide-react";
import OperationsHero from '../components/ops/OperationsHero';





// __AUTOATENDE_V4_R24D_C_B_R2_MEDIA_PROXY_PREVIEW_FIXED_DIST_SMOKE__
const aaR24dCBR2ParseMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

const aaR24dCBR2FindTokenInObject = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 4) return null;

  const directKeys = ['access_token', 'accessToken', 'token', 'jwt'];

  for (const key of directKeys) {
    const candidate = value?.[key];
    if (typeof candidate === 'string' && candidate.length > 20) return candidate;
  }

  for (const item of Object.values(value)) {
    if (typeof item === 'string' && item.startsWith('eyJ') && item.length > 80) return item;
    if (item && typeof item === 'object') {
      const nested = aaR24dCBR2FindTokenInObject(item, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
};

const aaR24dCBR2ResolveAuthToken = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  const preferredKeys = [
    'access_token',
    'accessToken',
    'token',
    'authToken',
    'jwt',
    'sb-access-token',
  ];

  for (const key of preferredKeys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    if (raw.startsWith('eyJ') && raw.length > 80) return raw;

    const parsed = aaR24dCBR2ParseMaybe(raw);
    const nested = aaR24dCBR2FindTokenInObject(parsed);
    if (nested) return nested;
  }

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    const raw = key ? window.localStorage.getItem(key) : null;
    if (!raw) continue;

    if (raw.startsWith('eyJ') && raw.length > 80) return raw;

    const parsed = aaR24dCBR2ParseMaybe(raw);
    const nested = aaR24dCBR2FindTokenInObject(parsed);
    if (nested) return nested;
  }

  return null;
};

const aaR24dCBR2MessageMediaId = (message) => {
  const raw = aaR24dCBR2ParseMaybe(message?.raw);
  const meta = aaR24dCBR2ParseMaybe(message?.meta);
  const type = String(message?.message_type || message?.messageType || meta?.type || raw?.type || '').toLowerCase();

  if (!['image', 'audio', 'video', 'document', 'sticker'].includes(type)) return null;

  return meta?.media_id || raw?.[type]?.id || null;
};

const aaR24dCBR2HasPreview = (message) => {
  const raw = aaR24dCBR2ParseMaybe(message?.raw);
  const meta = aaR24dCBR2ParseMaybe(message?.meta);
  const type = String(message?.message_type || message?.messageType || meta?.type || raw?.type || '').toLowerCase();

  return type === 'image' && Boolean(message?.id) && Boolean(aaR24dCBR2MessageMediaId(message));
};

function AaR24dCBR2MediaPreview({ message }) {
  // __AUTOATENDE_V4_R24D_C_C_DOWNLOAD_IMAGE_BUTTON_FRONTEND_ONLY__
  const [objectUrl, setObjectUrl] = useState(null);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!aaR24dCBR2HasPreview(message)) {
      setObjectUrl(null);
      setDownloadBlob(null);
      setFailed(false);
      return undefined;
    }

    let cancelled = false;
    let createdUrl = null;
    const controller = new AbortController();

    const load = async () => {
      try {
        setFailed(false);
        setDownloadBlob(null);
        const token = aaR24dCBR2ResolveAuthToken();

        if (!token) {
          setFailed(true);
          return;
        }

        const response = await fetch(`/api/inbox/messages/${encodeURIComponent(message.id)}/media`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          credentials: 'same-origin',
        });

        if (!response.ok) {
          setFailed(true);
          return;
        }

        const blob = await response.blob();

        if (!blob || !String(blob.type || '').startsWith('image/')) {
          setFailed(true);
          return;
        }

        createdUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setObjectUrl(createdUrl);
          setDownloadBlob(blob);
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setFailed(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [message?.id]);


  const handleDownload = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!objectUrl || !downloadBlob) return;

    const rawType = String(downloadBlob.type || 'image/jpeg').toLowerCase();
    const ext = rawType.includes('png') ? 'png' : rawType.includes('webp') ? 'webp' : rawType.includes('gif') ? 'gif' : 'jpg';
    const safeId = String(message?.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || Date.now();

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `autoatende-imagem-${safeId}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (!aaR24dCBR2HasPreview(message) || failed || !objectUrl) {
    return null;
  }

  return (
    <span className="aa-r24d-c-b-r2-media-preview">
      <img className="aa-r24d-c-b-r2-media-preview-img" src={objectUrl} alt="Imagem recebida" loading="lazy" />
      <button
        type="button"
        className="aa-r24d-c-c-download-button"
        onClick={handleDownload}
        aria-label="Baixar imagem recebida"
      >
        Baixar imagem
      </button>
    </span>
  );
}


// __AUTOATENDE_V4_R24C_B_R3B_DISPLAY_ONLY_MEDIA_CARDS_NODE_CONTAINER_BUILD__
const aaR24cBR3bParseMaybe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

const aaR24cBR3bType = (message) => {
  const raw = aaR24cBR3bParseMaybe(message?.raw);
  const meta = aaR24cBR3bParseMaybe(message?.meta);
  const explicit = String(message?.message_type || message?.messageType || meta?.type || raw?.type || '').toLowerCase();

  if (explicit) return explicit;

  const content = String(message?.content || message?.body || '').toLowerCase();

  if (content.includes('[imagem]')) return 'image';
  if (content.includes('[audio]') || content.includes('[áudio]')) return 'audio';
  if (content.includes('[video]') || content.includes('[vídeo]')) return 'video';
  if (content.includes('[documento]')) return 'document';
  if (content.includes('[system]')) return 'system';
  if (content.includes('[unsupported]')) return 'system';

  return 'text';
};

/* __AUTOATENDE_V4_R31B_R2_INBOX_WHATSAPP_LIKE_COMPACT_BUBBLES_SAFE_DIST_VALIDATION__ */
const aaR24cBR3bMedia = (message) => {
  const type = aaR24cBR3bType(message);

  if (type === 'text') return null;

  const mediaTypes = [
    'image',
    'audio',
    'video',
    'document',
    'sticker',
    'location',
    'reaction',
    'contacts',
    'contact',
    'interactive',
    'button',
    'order',
    'referral',
    'system',
    'unsupported',
    'unknown',
  ];

  if (!mediaTypes.includes(type)) return null;

  const raw = aaR24cBR3bParseMaybe(message?.raw);
  const meta = aaR24cBR3bParseMaybe(message?.meta);
  const content = String(message?.content || message?.body || '').trim();
  const fileName = meta?.filename || raw?.document?.filename || '';
  const extra = content && !content.startsWith('[') ? content : '';

  const labels = {
    image: 'Imagem',
    audio: 'Áudio',
    video: 'Vídeo',
    document: fileName || 'Documento',
    sticker: 'Figurinha',
    location: 'Localização',
    reaction: 'Reação',
    contacts: 'Contato',
    contact: 'Contato',
    interactive: 'Interação',
    button: 'Botão',
    order: 'Pedido',
    referral: 'Referência',
    system: 'Evento do WhatsApp',
    unsupported: 'Mensagem recebida sem pré-visualização',
    unknown: 'Mensagem',
  };

  return {
    type,
    label: labels[type] || 'Mensagem',
    icon: '',
    description: '',
    extra,
  };
};


const AA_R15A3_LABEL_CATALOG = [
  { key: 'novo_lead', label: 'Novo lead' },
  { key: 'aguardando_cliente', label: 'Aguardando cliente' },
  { key: 'aguardando_equipe', label: 'Aguardando equipe' },
  { key: 'resolvido', label: 'Resolvido' },
  { key: 'urgente', label: 'Urgente' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'suporte', label: 'Suporte' },
  { key: 'financeiro', label: 'Financeiro' },
];

function aaR15a3NormalizeLabels(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.key || item.label || item.name;
      return null;
    })
    .filter(Boolean)
    .slice(0, 5);
}

/* __AUTOATENDE_V4_R33B_R1_FREEFORM_INBOX_LABELS_NODE_VALIDATION_FIX___FRONTEND_LABEL_NAME */
function aaR15a3LabelName(key) {
  const raw = String(key || '').trim();
  const found = AA_R15A3_LABEL_CATALOG.find((item) => item.key === raw);

  if (found) return found.label;
  if (!raw) return 'Sem etiqueta';

  return raw.replace(/_/g, ' ');
}



/* __AUTOATENDE_V4_R33E_R4_REPLACE_STATIC_FILTER_ARRAY_USER_LABELS_FRONTEND_ONLY___FRONTEND */
function aaR33eR4UserCreatedLabelFilterOptions(conversationList) {
  const sourceList = Array.isArray(conversationList) ? conversationList : [];
  const seen = new Set();
  const options = [];

  sourceList.forEach((conversation) => {
    const key = aaR15a3PrimaryLabel(conversation?.labels);
    if (!key) return;

    const normalizedKey = String(key).trim();
    if (!normalizedKey) return;

    const dedupe = normalizedKey.toLowerCase();
    if (seen.has(dedupe)) return;

    seen.add(dedupe);
    options.push({
      value: normalizedKey,
      label: aaR15a3LabelName(normalizedKey),
    });
  });

  return options.sort((a, b) =>
    String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR', { sensitivity: 'base' })
  );
}
/* __AUTOATENDE_V4_R33B_R1_FREEFORM_INBOX_LABELS_NODE_VALIDATION_FIX___FRONTEND */
const aaR33bR1FreeformLabelOption = (source) => {
  const key = aaR15a3PrimaryLabel(source);
  if (!key) return null;

  const exists = AA_R15A3_LABEL_CATALOG.some((item) => item.key === key);
  if (exists) return null;

  return {
    key,
    label: aaR15a3LabelName(key),
  };
};

const aaR33bR1SubmitFreeformLabel = (input, handler) => {
  const value = String(input?.value || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  if (!value || typeof handler !== 'function') return;

  handler({ target: { value } });
  input.value = '';
};
function aaR15a3PrimaryLabel(value) {
  const labels = aaR15a3NormalizeLabels(value);
  return labels[0] || '';
}

function aaR15a3NormalizePhoneCandidate(value) {
  if (value === null || value === undefined) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');

  if (!digits) return '';

  // Aceita números BR completos e telefones locais prováveis.
  // Evita pegar datas/horários como 27042026201350.
  if (digits.length >= 12 && digits.length <= 15 && digits.startsWith('55')) {
    return digits;
  }

  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('20') && !digits.startsWith('19')) {
    return digits;
  }

  return '';
}

function aaR15a3DeepPhoneSearch(value, depth = 0, seen = new WeakSet()) {
  if (depth > 2 || value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number') {
    return aaR15a3NormalizePhoneCandidate(value);
  }

  if (typeof value !== 'object') return '';

  if (seen.has(value)) return '';
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) {
      const found = aaR15a3DeepPhoneSearch(item, depth + 1, seen);
      if (found) return found;
    }
    return '';
  }

  const preferredKeys = [
    'contact',
    'contact_phone',
    'contact_number',
    'customer_phone',
    'customerPhone',
    'from_number',
    'fromNumber',
    'phone',
    'phone_number',
    'phoneNumber',
    'number',
    'wa_id',
    'waId',
    'whatsapp',
    'whatsapp_number',
    'whatsappNumber',
    'remote_jid',
    'remoteJid',
    'sender',
    'recipient',
    'title',
    'name',
    'display_name',
    'displayName',
  ];

  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const found = aaR15a3DeepPhoneSearch(value[key], depth + 1, seen);
      if (found) return found;
    }
  }

  for (const item of Object.values(value).slice(0, 40)) {
    const found = aaR15a3DeepPhoneSearch(item, depth + 1, seen);
    if (found) return found;
  }

  return '';
}

function aaR15a3ContactFromConversation(conversation) {
  return aaR15a3DeepPhoneSearch(conversation);
}

function aaR15a3GetAccessToken() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';

    const directKeys = ['access_token', 'token', 'auth_token'];

    for (const key of directKeys) {
      const value = window.localStorage.getItem(key);
      if (value && value.length > 20 && !value.startsWith('{')) return value;
    }

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw || raw.length < 20) continue;

      try {
        const parsed = JSON.parse(raw);

        const candidates = [
          parsed?.access_token,
          parsed?.currentSession?.access_token,
          parsed?.session?.access_token,
          parsed?.state?.session?.access_token,
          parsed?.state?.currentSession?.access_token,
        ];

        const token = candidates.find((item) => typeof item === 'string' && item.length > 20);
        if (token) return token;
      } catch (_) {
        if ((key.includes('token') || key.includes('auth')) && raw.length > 20 && !raw.startsWith('{')) {
          return raw;
        }
      }
    }
  } catch (_) {}

  return '';
}


/* __AUTOATENDE_C7F_R5_BIND_REAL_HANDLERS__ */
const __aaC7fR5Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const __aaC7fR5Is429 = (error) => {
  const status =
    error?.response?.status ??
    error?.status ??
    error?.request?.status ??
    null;
  return Number(status) === 429;
};

const __aaC7fR5WithAttendanceWriteRetry = async (runner) => {
  try {
    return await runner();
  } catch (error) {
    if (!__aaC7fR5Is429(error)) throw error;
    await __aaC7fR5Sleep(900);
    return await runner();
  }
};



/* __AUTOATENDE_C7F_R4_ATTENDANCE_ACTION_RETRY__ */
const __aaC7fR4Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const __aaC7fR4Is429 = (error) => {
  const status =
    error?.response?.status ??
    error?.status ??
    error?.request?.status ??
    null;
  return Number(status) == 429;
};

const __aaC7fR4WithAttendanceActionRetry = async (runner) => {
  try {
    return await runner();
  } catch (error) {
    if (!__aaC7fR4Is429(error)) throw error;
    await __aaC7fR4Sleep(900);
    return await runner();
  }
};





/* __AUTOATENDE_C4C2_OPERATIONAL_POLISH__ */
const getInboxFilterLabel = (filter = 'all') => {
  if (filter === 'human') return 'Humano';
  if (filter === 'mine') return 'Minhas';
  if (filter === 'unassigned') return 'Sem responsável';
  if (filter === 'bot') return 'Bot';
  return 'Todas';
};

const buildInboxEmptyState = (filter = 'all', totalConversations = 0) => {
  if (!totalConversations) {
    return {
      title: 'Nenhuma conversa disponível agora',
      description: 'Assim que novos contatos entrarem no fluxo, eles aparecerão aqui para operação e acompanhamento.',
      actionLabel: 'Atualizar fila',
      resetFilter: false,
    };
  }

  if (filter === 'mine') {
    return {
      title: 'Nenhuma conversa sob sua responsabilidade',
      description: 'No momento, nenhuma conversa humana está atribuída ao seu usuário.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  if (filter === 'human') {
    return {
      title: 'Nenhuma conversa no humano agora',
      description: 'A fila está limpa neste momento. Quando houver handover, ela aparecerá aqui.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  if (filter === 'unassigned') {
    return {
      title: 'Nenhuma conversa sem responsável',
      description: 'Não há pendências órfãs no momento. A ownership operacional está íntegra.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  if (filter === 'bot') {
    return {
      title: 'Nenhuma conversa em automação',
      description: 'Neste momento, a base visível não tem conversas ativas sob o bot.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  return {
    title: 'Nenhuma conversa encontrada neste recorte',
    description: 'Ajuste o filtro operacional para ampliar a leitura da fila.',
    actionLabel: 'Mostrar todas',
    resetFilter: true,
  };
};

const OperationalEmptyStateCard = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="m-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-5 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button"
          
          onClick={onAction}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  </div>
);

/* __AUTOATENDE_C4C1_RELIABILITY_SURFACES__ */
const buildOperationalSurfaceErrorMessage = (error, fallback) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return fallback;
};

const OperationalSurfaceBanner = ({
  tone = 'neutral',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const toneClasses =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div data-aa-page="inbox" className={`rounded-xl border px-4 py-3 shadow-sm ${toneClasses}`}>
      <div className="aa-inbox-thread-topbar-layout flex flex-col gap-3 md:flex-row md:items-center md:justify-between aa-inbox-r13b-shell">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs opacity-90">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <button type="button"
            
            onClick={onAction}
            className="rounded-lg border border-current px-3 py-2 text-xs font-semibold transition hover:bg-white/40"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

/* __AUTOATENDE_C4A2B_OWNER_LABEL_HELPERS__ */
const buildAgentDirectory = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((acc, item) => {
    if (item?.id) acc[item.id] = item;
    return acc;
  }, {});

const resolveFriendlyOwnerLabel = (entity, agentDirectory = {}, session = null) => {
  const currentUserId = session?.user?.id || null;
  const ownerId =
    entity?.assigned_user_id ||
    entity?.assignedUserId ||
    entity?.assigned_agent_id ||
    entity?.assignedAgentId ||
    entity?.owner_user_id ||
    null;

  const embedded =
    entity?.assigned_user ||
    entity?.assignedUser ||
    entity?.assigned_agent ||
    entity?.assignedAgent ||
    entity?.owner ||
    null;

  if (embedded?.name) return embedded.name;
  if (embedded?.full_name) return embedded.full_name;
  if (embedded?.email) return embedded.email;

  if (ownerId && currentUserId && ownerId === currentUserId) {
    return 'Você';
  }

  const match = ownerId ? agentDirectory?.[ownerId] : null;
  if (match?.name) return match.name;
  if (match?.full_name) return match.full_name;
  if (match?.email) return match.email;

  if (ownerId) return 'Responsável interno';
  return 'Sem responsável';
};

/* __AUTOATENDE_C4B2_INBOX_OPERATIONAL_CONVERGENCE__ */
const getInboxConversationMode = (conversation = {}) =>
  String(conversation?.mode || 'bot').toLowerCase() === 'human' ? 'human' : 'bot';

const getInboxConversationOwnerId = (conversation = {}) =>
  conversation?.assigned_user_id ||
  conversation?.assignedUserId ||
  conversation?.assigned_agent_id ||
  conversation?.assignedAgentId ||
  conversation?.owner_user_id ||
  null;

const buildInboxOperationalMetrics = (rows = [], currentUserId = null) => {
  const items = Array.isArray(rows) ? rows : [];

  return items.reduce(
    (acc, item) => {
      const mode = getInboxConversationMode(item);
      const ownerId = getInboxConversationOwnerId(item);
      const isHuman = mode === 'human';
      const isMine = Boolean(ownerId && currentUserId && ownerId === currentUserId);
      const isUnassigned = isHuman && !ownerId;

      acc.total += 1;
      if (isHuman) acc.human += 1;
      if (!isHuman) acc.bot += 1;
      if (isMine) acc.mine += 1;
      if (isUnassigned) acc.unassigned += 1;

      return acc;
    },
    { total: 0, human: 0, bot: 0, mine: 0, unassigned: 0 }
  );
};

const buildOrderedInboxConversations = ({
  conversations = [],
  currentUserId = null,
  queueFilter = 'all',
}) => {
  const items = Array.isArray(conversations) ? [...conversations] : [];

  const filtered = items.filter((conversation) => {
    const mode = getInboxConversationMode(conversation);
    const ownerId = getInboxConversationOwnerId(conversation);
    const isHuman = mode === 'human';
    const isMine = Boolean(ownerId && currentUserId && ownerId === currentUserId);
    const isUnassigned = isHuman && !ownerId;

    if (queueFilter === 'all') return true;
    if (queueFilter === 'human') return isHuman;
    if (queueFilter === 'mine') return isMine;
    if (queueFilter === 'unassigned') return isUnassigned;
    if (queueFilter === 'bot') return !isHuman;
    return true;
  });

  filtered.sort((left, right) => {
    const leftMode = getInboxConversationMode(left);
    const rightMode = getInboxConversationMode(right);

    const leftOwner = getInboxConversationOwnerId(left);
    const rightOwner = getInboxConversationOwnerId(right);

    const leftHuman = leftMode === 'human';
    const rightHuman = rightMode === 'human';

    const leftMine = Boolean(leftOwner && currentUserId && leftOwner === currentUserId);
    const rightMine = Boolean(rightOwner && currentUserId && rightOwner === currentUserId);

    const leftUnassigned = leftHuman && !leftOwner;
    const rightUnassigned = rightHuman && !rightOwner;

    const leftPriority =
      leftUnassigned ? 0 :
      leftMine ? 1 :
      leftHuman ? 2 :
      3;

    const rightPriority =
      rightUnassigned ? 0 :
      rightMine ? 1 :
      rightHuman ? 2 :
      3;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftTs = new Date(
      left?.last_message_at || left?.updated_at || left?.created_at || 0
    ).getTime();

    const rightTs = new Date(
      right?.last_message_at || right?.updated_at || right?.created_at || 0
    ).getTime();

    return rightTs - leftTs;
  });

  return filtered;
};


const LIST_POLL_MS = 3000;
const THREAD_POLL_MS = 1200;
const SEARCH_DEBOUNCE_MS = 250;


/* __AUTOATENDE_V4_R19B_B_R2_FRONTEND_DISPLAY_ONLY_HISTORICAL_TEMPLATE_MESSAGES__ */
function aaR19bBParseHistoricalTemplateText(raw) {
  const text = String(raw || '').trim();

  if (!text || !/\[\s*template enviado\s*\]/i.test(text)) {
    return null;
  }

  const withoutPrefix = text.replace(/\[\s*template enviado\s*\]/i, '').trim();
  const parts = withoutPrefix
    .split('•')
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  const templateName = parts[0] || '';
  const language = parts[1] || '';
  const category = parts[2] || '';
  const recipientName = parts[3] || '';

  const readableTemplateName = templateName
    ? templateName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  const readableCategory = category
    ? category.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  const metaParts = [];

  if (readableTemplateName) metaParts.push(readableTemplateName);
  if (language) metaParts.push(language);
  if (readableCategory) metaParts.push(readableCategory);
  if (recipientName) metaParts.push(`Para ${recipientName}`);

  return {
    title: 'Template enviado',
    description: recipientName
      ? `Mensagem aprovada enviada para ${recipientName}.`
      : 'Mensagem aprovada enviada ao cliente.',
    templateName,
    readableTemplateName,
    language,
    category,
    readableCategory,
    recipientName,
    meta: metaParts.join(' · '),
    raw: text
  };
}

function aaR19bBTemplateMetaFallback(template) {
  if (!template) return '';
  return template.meta || 'Template aprovado pelo WhatsApp';
}
/* END __AUTOATENDE_V4_R19B_B_R2_FRONTEND_DISPLAY_ONLY_HISTORICAL_TEMPLATE_MESSAGES__ */

function extractText(message) {
  return (
    message?.content ||
    message?.body ||
    message?.text_body ||
    message?.text?.body ||
    message?.message ||
    ''
  );
}

function isOutbound(message) {
  if (message?.direction) return message.direction === 'outbound';
  if (
    message?.sender_type === 'human' ||
    message?.sender_type === 'agent' ||
    message?.sender_type === 'bot'
  ) {
    return true;
  }
  if (typeof message?.from_me === 'boolean') return message.from_me;
  return false;
}

function getConversationTimestamp(conversation) {
  return (
    conversation?.last_message_at ||
    conversation?.updated_at ||
    conversation?.created_at ||
    null
  );
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR');
}

function getMessageKey(message, index) {
  return (
    message?.id ||
    message?.provider_message_id ||
    `${message?.created_at || 'sem-data'}-${extractText(message)}-${index}`
  );
}

function getPreview(conversation) {
  const preview =
    conversation?.last_message_preview ||
    conversation?.last_message ||
    conversation?.preview ||
    conversation?.content ||
    '';

  const text = String(preview || '').trim();
  if (!text) return ''; // __AUTOATENDE_V4_R5N_R16G_SAFE_METADATA_MICROPATCH__
  if (text.length <= 60) return text;
  return `${text.slice(0, 60)}...`;
}

function getSenderLabel(message) {
  if (message?.sender_type === 'bot') return 'Bot';
  if (message?.sender_type === 'human' || message?.sender_type === 'agent') return 'Equipe';
  if (isOutbound(message)) return 'Saída';
  return 'Cliente';
}

const getInboxConversationContactValue = (conversation = {}) =>
  conversation?.contact ||
  conversation?.contact_phone ||
  conversation?.contact_number ||
  conversation?.customer_phone ||
  conversation?.from_number ||
  conversation?.phone ||
  conversation?.number ||
  null;

const chooseInboxPreferredState = (liveState = null, conversation = null) => {
  const liveMode = String(liveState?.mode || '').trim().toLowerCase();
  const fallbackMode = String(conversation?.mode || '').trim().toLowerCase();

  const preferredMode =
    liveMode === 'human' || liveMode === 'bot'
      ? liveMode
      : fallbackMode === 'human' || fallbackMode === 'bot'
        ? fallbackMode
        : 'bot';

  const preferredOwner =
    liveState?.assigned_agent_id ??
    liveState?.assigned_user_id ??
    liveState?.owner_user_id ??
    conversation?.assigned_agent_id ??
    conversation?.assigned_user_id ??
    conversation?.owner_user_id ??
    null;

  return {
    mode: preferredMode,
    assigned_agent_id: preferredOwner,
    assigned_user_id: preferredOwner,
    owner_user_id: preferredOwner
  };
};

const buildInboxEffectiveConversations = (conversations = [], liveStates = {}) =>
  (Array.isArray(conversations) ? conversations : []).map((conversation) => {
    const contact = getInboxConversationContactValue(conversation);
    const effectiveState = chooseInboxPreferredState(contact ? liveStates?.[contact] : null, conversation);

    return {
      ...conversation,
      mode: effectiveState.mode,
      assigned_agent_id: effectiveState.assigned_agent_id,
      assigned_user_id: effectiveState.assigned_user_id,
      owner_user_id: effectiveState.owner_user_id
    };
  });

const buildAssignableAgentOptions = (agentDirectory = {}, session = null) => {
  const registry = new Map();

  const pushCandidate = (candidate, fallbackLabel = null) => {
    const id = candidate?.id || candidate?.user_id || null;
    if (!id || registry.has(id)) return;

    const label =
      candidate?.name ||
      candidate?.full_name ||
      candidate?.email ||
      fallbackLabel ||
      `Agente ${String(id).slice(0, 8)}`;

    registry.set(id, {
      id,
      label,
      name: candidate?.name || candidate?.full_name || fallbackLabel || label,
      email: candidate?.email || '',
    });
  };

  Object.values(agentDirectory || {}).forEach((candidate) => pushCandidate(candidate));

  if (session?.user?.id) {
    pushCandidate(
      {
        id: session.user.id,
        name: 'Você',
        email: session.user.email || '',
      },
      'Você'
    );
  }

  return Array.from(registry.values());
};

const resolveConversationOwnerId = (conversation = {}) =>
  conversation?.assigned_user_id ||
  conversation?.assignedUserId ||
  conversation?.assigned_agent_id ||
  conversation?.assignedAgentId ||
  conversation?.owner_user_id ||
  null;



// __AUTOATENDE_V4_R23C_A_INBOX_TECHNICAL_MESSAGE_DISPLAY_NORMALIZATION__

/* __AUTOATENDE_V4_R31D_INBOX_SIDEBAR_PREVIEW_TOKEN_MAPPING_FRONTEND_ONLY__ */
const aaR31dConversationPreviewTokenLabels = {
  '[unsupported]': 'Mensagem recebida sem pré-visualização',
  '[system]': 'Evento do WhatsApp',
  '[sticker]': 'Figurinha',
  '[imagem]': 'Imagem',
  '[image]': 'Imagem',
  '[audio]': 'Áudio',
  '[áudio]': 'Áudio',
  '[video]': 'Vídeo',
  '[vídeo]': 'Vídeo',
  '[documento]': 'Documento',
  '[document]': 'Documento',
  '[location]': 'Localização',
  '[reaction]': 'Reação',
  '[contacts]': 'Contato',
  '[contact]': 'Contato',
  '[interactive]': 'Interação',
  '[button]': 'Botão',
  '[order]': 'Pedido',
  '[referral]': 'Referência',
};

function aaR31dNormalizeConversationPreviewTokens(value, depth = 0) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return aaR31dConversationPreviewTokenLabels[normalized] || value;
  }

  if (depth > 4) return value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const normalizedItem = aaR31dNormalizeConversationPreviewTokens(item, depth + 1);
      if (normalizedItem !== item) changed = true;
      return normalizedItem;
    });
    return changed ? next : value;
  }

  if (typeof value === 'object') {
    let changed = false;
    const next = { ...value };

    Object.keys(next).forEach((key) => {
      const current = next[key];
      const normalizedCurrent = aaR31dNormalizeConversationPreviewTokens(current, depth + 1);

      if (normalizedCurrent !== current) {
        next[key] = normalizedCurrent;
        changed = true;
      }
    });

    return changed ? next : value;
  }

  return value;
}

const aaR23cTechnicalMessageLabels = {
  '[system]': 'Evento técnico do WhatsApp',
  '[unsupported]': 'Mensagem recebida sem pré-visualização',
};

function aaR23cNormalizeTechnicalMessageText(value) {
  if (value === null || value === undefined) return value;

  const raw = String(value);
  const normalized = raw.trim().toLowerCase();

  if (Object.prototype.hasOwnProperty.call(aaR23cTechnicalMessageLabels, normalized)) {
    return aaR23cTechnicalMessageLabels[normalized];
  }

  return value;
}

function aaR23cNormalizeInboxMessageForDisplay(message) {
  if (!message || typeof message !== 'object') return message;

  const next = { ...message };
  const keys = [
    'content',
    'body',
    'message',
    'text',
    'caption',
    'last_message',
    'lastMessage',
    'preview',
    'snippet',
    'last_message_content',
    'lastMessageContent',
  ];

  let isTechnical = false;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;

    const before = next[key];
    const after = aaR23cNormalizeTechnicalMessageText(before);
    next[key] = after;

    if (before !== after) isTechnical = true;
  }

  if (isTechnical) {
    next.is_technical_event = true;
    next.message_type = next.message_type || 'technical_event';
  }

  return next;
}

function aaR23cNormalizeInboxMessagesForDisplay(value) {
  if (!Array.isArray(value)) return value;
  return value.map(aaR23cNormalizeInboxMessageForDisplay);
}

function aaR23cNormalizeInboxConversationForDisplay(conversation) {
  if (!conversation || typeof conversation !== 'object') return conversation;

  const next = { ...conversation };
  const keys = [
    'content',
    'body',
    'message',
    'text',
    'last_message',
    'lastMessage',
    'preview',
    'snippet',
    'last_message_content',
    'lastMessageContent',
    'latest_message',
    'latestMessage',
  ];

  let isTechnical = false;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;

    const before = next[key];
    const after = aaR23cNormalizeTechnicalMessageText(before);
    next[key] = after;

    if (before !== after) isTechnical = true;
  }

  if (isTechnical) {
    next.has_technical_event_preview = true;
  }

  return next;
}

function aaR23cNormalizeInboxConversationsForDisplay(value) {
  if (!Array.isArray(value)) return value;
  return value.map(aaR23cNormalizeInboxConversationForDisplay);
}



// __AUTOATENDE_V4_R24E_C_R2_FRONTEND_RENDERERS_SAFE_ANCHOR__
// __AUTOATENDE_V4_R24E_C_R4_REMOVE_AUDIO_DOWNLOAD_BUTTON_FRONTEND_ONLY__
// __AUTOATENDE_V4_R24E_C_R3_REMOVE_STICKER_DOWNLOAD_BUTTON_FRONTEND_ONLY__
const aaR24eCR2MediaLabels = {
  audio: 'Áudio recebido',
  document: 'Documento recebido',
  video: 'Vídeo recebido',
  sticker: 'Figurinha recebida',
};

const aaR24eCR2DownloadLabels = {
  document: 'Baixar documento',
  video: 'Baixar vídeo',
};

const aaR24eCR2ExtensionFromMime = (mimeType, type) => {
  const mime = String(mimeType || '').toLowerCase();

  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('mp4')) return type === 'audio' ? 'm4a' : 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';

  if (type === 'audio') return 'ogg';
  if (type === 'video') return 'mp4';
  if (type === 'document') return 'pdf';
  if (type === 'sticker') return 'webp';

  return 'bin';
};

const aaR24eCR2SafeFilename = (name, fallback) => {
  const rawName = String(name || fallback || 'autoatende-arquivo').trim();
  return rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || fallback || 'autoatende-arquivo';
};

const aaR24eCR2MediaInfo = (message) => {
  const raw = aaR24dCBR2ParseMaybe(message?.raw);
  const meta = aaR24dCBR2ParseMaybe(message?.meta);
  const type = String(message?.message_type || message?.messageType || meta?.type || raw?.type || '').toLowerCase();

  if (!['audio', 'document', 'video', 'sticker'].includes(type)) return null;

  const mediaObject = raw?.[type] && typeof raw[type] === 'object' ? raw[type] : null;
  const mediaId = meta?.media_id || mediaObject?.id || null;

  return {
    type,
    mediaId,
    mimeType: meta?.mime_type || mediaObject?.mime_type || '',
    filename: meta?.filename || mediaObject?.filename || '',
    voice: meta?.voice ?? mediaObject?.voice ?? null,
    animated: meta?.animated ?? mediaObject?.animated ?? null,
  };
};

const aaR24eCR2HasNonImageMedia = (message) => {
  const info = aaR24eCR2MediaInfo(message);
  return Boolean(message?.id && info?.type && info?.mediaId);
};

function AaR24eCR2NonImageMediaRenderer({ message }) {
  const info = aaR24eCR2MediaInfo(message);
  const [objectUrl, setObjectUrl] = useState(null);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!aaR24eCR2HasNonImageMedia(message)) {
      setObjectUrl(null);
      setDownloadBlob(null);
      setFailed(false);
      return undefined;
    }

    let cancelled = false;
    let createdUrl = null;
    const controller = new AbortController();

    const load = async () => {
      try {
        setFailed(false);
        setDownloadBlob(null);

        const token = aaR24dCBR2ResolveAuthToken();

        if (!token) {
          setFailed(true);
          return;
        }

        const response = await fetch(`/api/inbox/messages/${encodeURIComponent(message.id)}/media`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          credentials: 'same-origin',
        });

        if (!response.ok) {
          setFailed(true);
          return;
        }

        const blob = await response.blob();

        if (!blob || blob.size <= 0) {
          setFailed(true);
          return;
        }

        createdUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setObjectUrl(createdUrl);
          setDownloadBlob(blob);
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setFailed(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [message?.id]);

  if (!aaR24eCR2HasNonImageMedia(message) || failed || !info || !objectUrl) {
    return null;
  }

  const type = info.type;
  const label = aaR24eCR2MediaLabels[type] || 'Arquivo recebido';
  const ext = aaR24eCR2ExtensionFromMime(downloadBlob?.type || info.mimeType, type);
  const baseName = info.filename || `autoatende-${type}-${String(message?.id || Date.now()).slice(0, 12)}.${ext}`;
  const safeFileName = aaR24eCR2SafeFilename(baseName, `autoatende-${type}.${ext}`);

  const handleDownload = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!objectUrl || !downloadBlob) return;

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = safeFileName.includes('.') ? safeFileName : `${safeFileName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <span className={`aa-r24e-c-r2-media-renderer aa-r24e-c-r2-media-renderer--${type}`}>
      <span className="aa-r24e-c-r2-media-title">{label}</span>

      {type === 'audio' ? (
        <audio className="aa-r24e-c-r2-audio-player" src={objectUrl} controls preload="metadata" />
      ) : null}

      {type === 'video' ? (
        <video className="aa-r24e-c-r2-video-player" src={objectUrl} controls preload="metadata" />
      ) : null}

      {type === 'sticker' ? (
        <img className="aa-r24e-c-r2-sticker-preview" src={objectUrl} alt="Figurinha recebida" loading="lazy" />
      ) : null}

      {type === 'document' ? (
        <span className="aa-r24e-c-r2-document-box">
          <span className="aa-r24e-c-r2-document-name">{info.filename || 'Documento recebido'}</span>
          <span className="aa-r24e-c-r2-document-meta">{info.mimeType || 'arquivo'}</span>
        </span>
      ) : null}

      {!['sticker', 'audio'].includes(type) ? (
        <button
          type="button"
          className="aa-r24e-c-r2-download-button"
          onClick={handleDownload}
          aria-label={aaR24eCR2DownloadLabels[type] || 'Baixar arquivo'}
        >
          {aaR24eCR2DownloadLabels[type] || 'Baixar arquivo'}
        </button>
      ) : null}
    </span>
  );
}



// __AUTOATENDE_V4_R25C_R2D_AVATAR_EXACT_ATTENDANCE_INBOX_PATCH__
const aaR25cR2dCleanDigits = (value) => String(value || '').replace(/\D/g, '');

const aaR25cR2dFirstText = (...values) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const aaR25cR2dName = (contact) => aaR25cR2dFirstText(
  contact?.contact_name,
  contact?.contactName,
  contact?.profile_name,
  contact?.profileName,
  contact?.name,
  contact?.display_name,
  contact?.displayName,
  contact?.customer_name,
  contact?.customerName
);

const aaR25cR2dPhone = (contact) => aaR25cR2dFirstText(
  contact?.contact_phone,
  contact?.contactPhone,
  contact?.contact_number,
  contact?.contactNumber,
  contact?.phone,
  contact?.contact,
  contact?.from_number,
  contact?.to_number,
  contact?.customer_phone,
  contact?.customerPhone
);

const aaR25cR2dPhoto = (contact) => aaR25cR2dFirstText(
  contact?.contact_avatar_url,
  contact?.contactAvatarUrl,
  contact?.avatar_url,
  contact?.avatarUrl,
  contact?.profile_photo_url,
  contact?.profilePhotoUrl,
  contact?.photo_url,
  contact?.photoUrl,
  contact?.picture_url,
  contact?.pictureUrl
);

const aaR25cR2dInitials = (contact) => {
  const name = aaR25cR2dName(contact);
  const phone = aaR25cR2dCleanDigits(aaR25cR2dPhone(contact));

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }

  if (phone) return phone.slice(-2);

  return 'SF';
};

// __AUTOATENDE_V4_R27C_R3_PROFILE_PHOTO_VISUAL_FALLBACK_FRONTEND_ONLY_NO_DBURL__
const aaR27cR3FirstText = (...values) => {
  for (const value of values) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
};

const aaR27cR3SafeContactPhotoUrl = (contact) => {
  const candidate = aaR27cR3FirstText(
    contact?.contact_photo_url,
    contact?.contactPhotoUrl,
    contact?.profile_photo_url,
    contact?.profilePhotoUrl,
    contact?.avatar_url,
    contact?.avatarUrl,
    contact?.photo_url,
    contact?.photoUrl,
    contact?.profile_picture,
    contact?.profilePicture,
    contact?.picture,
    contact?.raw?.contact_photo_url,
    contact?.raw?.contactPhotoUrl,
    contact?.raw?.profile_photo_url,
    contact?.raw?.profilePhotoUrl,
    contact?.raw?.avatar_url,
    contact?.raw?.avatarUrl,
    contact?.raw?.photo_url,
    contact?.raw?.photoUrl,
    contact?.profile?.photo_url,
    contact?.profile?.picture
  );

  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch (_) {
    return '';
  }
};

const aaR27cR3ContactAvatarInitials = (contact) => {
  const label = aaR27cR3FirstText(
    contact?.contact_name,
    contact?.contactName,
    contact?.profile_name,
    contact?.profileName,
    contact?.display_name,
    contact?.displayName,
    contact?.customer_name,
    contact?.customerName,
    contact?.name,
    contact?.contact_phone,
    contact?.contact_number,
    contact?.phone,
    contact?.contact,
    contact
  );

  const cleaned = label.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }

  return (words[0] || cleaned).slice(0, 2).toUpperCase();
};

function AaR25cR2dContactAvatar({ contact, variant = 'default' }) {
  const photoUrl = aaR27cR3SafeContactPhotoUrl(contact);
  const initials = aaR27cR3ContactAvatarInitials(contact);
  const className = [
    'aa-r25c-r2d-contact-avatar',
    'aa-r27c-r3-contact-avatar',
    `aa-r25c-r2d-contact-avatar--${variant}`,
    photoUrl ? 'aa-r27c-r3-contact-avatar--has-photo' : 'aa-r27c-r3-contact-avatar--no-photo'
  ].filter(Boolean).join(' ');

  return (
    <span className={className} aria-label={photoUrl ? 'Foto do contato' : 'Contato sem foto'}>
      {photoUrl ? (
        <img
          className="aa-r27c-r3-contact-avatar__image"
          src={photoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
            event.currentTarget.parentElement?.classList.add('aa-r27c-r3-contact-avatar--broken');
          }}
        />
      ) : null}

      <span className="aa-r27c-r3-contact-avatar__fallback" aria-hidden="true">
        <svg className="aa-r27c-r3-contact-avatar__icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M12 12.2c2.25 0 4.05-1.8 4.05-4.05S14.25 4.1 12 4.1 7.95 5.9 7.95 8.15 9.75 12.2 12 12.2Zm0 1.85c-3.2 0-6.05 1.64-7.67 4.12-.36.55.04 1.28.7 1.28h13.94c.66 0 1.06-.73.7-1.28C18.05 15.69 15.2 14.05 12 14.05Z" />
        </svg>
        {initials ? <span className="aa-r27c-r3-contact-avatar__initials">{initials}</span> : null}
      </span>
    </span>
  );
}


const Inbox = () => {
  const { session } = useAuth();

  const [conversations, aaR31dSetConversationsRaw] = useState([]);
  const setConversations = useCallback((value) => {
    aaR31dSetConversationsRaw((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      return aaR31dNormalizeConversationPreviewTokens(next);
    });
  }, []);
  
  const [aaR15a3SavingLabel, setAaR15a3SavingLabel] = React.useState(false);
  const [aaR15a3LabelError, setAaR15a3LabelError] = React.useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);


  const aaR15a3HandleLabelChange = React.useCallback(async (event) => {
    const nextLabelKey = event?.target?.value || '';

    let aaR15a3EffectiveConversation = selectedConversation || null;

    try {
      if (!aaR15a3ContactFromConversation(aaR15a3EffectiveConversation) && typeof selectedConversationEffective !== 'undefined' && selectedConversationEffective) {
        aaR15a3EffectiveConversation = selectedConversationEffective;
      }
    } catch (_) {}

    try {
      if (!aaR15a3ContactFromConversation(aaR15a3EffectiveConversation) && selectedConversationRef?.current) {
        aaR15a3EffectiveConversation = selectedConversationRef.current;
      }
    } catch (_) {}

    try {
      if (!aaR15a3ContactFromConversation(aaR15a3EffectiveConversation) && Array.isArray(conversations)) {
        const selectedId = selectedConversation?.id || selectedConversation?.conversation_id || selectedConversation?.conversationId || null;
        const selectedPhone = aaR15a3ContactFromConversation(selectedConversation);

        const matched = conversations.find((item) => {
          const itemId = item?.id || item?.conversation_id || item?.conversationId || null;
          const itemPhone = aaR15a3ContactFromConversation(item);

          return (
            (selectedId && itemId && String(itemId) === String(selectedId)) ||
            (selectedPhone && itemPhone && selectedPhone === itemPhone)
          );
        });

        if (matched) aaR15a3EffectiveConversation = matched;
      }
    } catch (_) {}

    let contact = aaR15a3ContactFromConversation(aaR15a3EffectiveConversation);

    try {
      if (!contact && typeof getConversationContact === 'function') {
        contact = aaR15a3NormalizePhoneCandidate(getConversationContact(aaR15a3EffectiveConversation));
      }
    } catch (_) {}

    try {
      if (!contact && typeof getInboxConversationContactValue === 'function') {
        contact = aaR15a3NormalizePhoneCandidate(getInboxConversationContactValue(aaR15a3EffectiveConversation));
      }
    } catch (_) {}

    const previousLabels = aaR15a3NormalizeLabels(aaR15a3EffectiveConversation?.labels || selectedConversation?.labels);
    const nextLabels = nextLabelKey ? [nextLabelKey] : [];

    if (!contact) {
      setAaR15a3LabelError('Não foi possível identificar o telefone desta conversa para salvar a etiqueta.');
      return;
    }

    const applyLabelsLocally = (labels) => {
      const safeLabels = aaR15a3NormalizeLabels(labels);

      if (typeof setSelectedConversation === 'function') {
        setSelectedConversation((prev) => (prev ? { ...prev, labels: safeLabels } : prev));
      }

      if (typeof setConversations === 'function') {
        setConversations((prev) => Array.isArray(prev)
          ? prev.map((item) => {
              const itemContact = aaR15a3ContactFromConversation(item);
              return itemContact === contact ? { ...item, labels: safeLabels } : item;
            })
          : prev
        );
      }
    };

    try {
      setAaR15a3SavingLabel(true);
      setAaR15a3LabelError('');

      applyLabelsLocally(nextLabels);

      const token = aaR15a3GetAccessToken();

      const response = await fetch('/api/inbox-labels', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          contact,
          labels: nextLabels,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Falha ao salvar etiqueta.');
      }

      applyLabelsLocally(payload?.labels || nextLabels);
    } catch (error) {
      applyLabelsLocally(previousLabels);
      setAaR15a3LabelError(error?.message || 'Não foi possível salvar a etiqueta.');
    } finally {
      setAaR15a3SavingLabel(false);
    }
  }, [selectedConversation, conversations]);
const [messages, setMessages] = useState([]);
  // __AUTOATENDE_V4_R22C_B_R3_RECOVER_AND_APPLY_SAFE_INBOX_BILLING_GUARD__
  const [messagesLoading, setMessagesLoading] = useState(false);
  const latestMessagesRequestRef = useRef(0);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [draft, setDraft] = useState('');

  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  // __AUTOATENDE_V4_R21G_B_R2_DISABLE_INBOX_SKELETON_LOADING_VISUAL_BUG_MINIFIED_SAFE__
  const aaR21gDisableInboxSkeletonUi = Boolean(
    (typeof window !== 'undefined' && window.__AUTOATENDE_R21G_B_R2_DISABLE_INBOX_SKELETON_UI__) ?? true
  );

  const [sending, setSending] = useState(false);

  const [lastListSync, setLastListSync] = useState(null);
  const [lastThreadSync, setLastThreadSync] = useState(null);

  const selectedConversationRef = useRef(null);

  // __AUTOATENDE_V4_R22C_D_B_R3_INBOX_TRANSITION_BILLING_STATUS_BUCKET_PATCH__
  const aaR22cDBR3SelectConversationInstantly = useCallback((conversation) => {
    if (!conversation) return;
    selectedConversationRef.current = conversation;
    setSelectedConversation(conversation);
  }, []);

  // __AUTOATENDE_V4_R21C_B1_R2_REDUCE_INBOX_POLLING_CONSTANTS_SAFE__
  const aaR21cB1LastInboxPollRef = useRef({ conversations: 0, messages: 0, combined: 0, focus: 0 });

  const aaR21cB1ShouldSkipBackgroundPoll = useCallback(() => {
    if (typeof document !== 'undefined' && document.hidden) return true;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    return false;
  }, []);

  const aaR21cB1CanPoll = useCallback((key, minIntervalMs) => {
    const now = Date.now();
    const last = aaR21cB1LastInboxPollRef.current?.[key] || 0;

    if (now - last < minIntervalMs) {
      return false;
    }

    aaR21cB1LastInboxPollRef.current = {
      ...aaR21cB1LastInboxPollRef.current,
      [key]: now
    };

    return true;
  }, []);
  // END __AUTOATENDE_V4_R21C_B1_R2_REDUCE_INBOX_POLLING_CONSTANTS_SAFE__

  const searchRef = useRef('');
  const listBusyRef = useRef(false);
  const threadBusyRef = useRef(false);
  const bottomRef = useRef(null);

  /* __AUTOATENDE_C3FIX_SAFE_INLINE_HANDOVER__ */
  const [inlineMode, setInlineMode] = useState('bot');
  const [handoverBusy, setHandoverBusy] = useState(false);
  const [handoverError, setHandoverError] = useState('');

  const getConversationContact = useCallback((conversation) => {
    if (!conversation) return null;
    return (
      conversation.contact ||
      conversation.contact_phone ||
      conversation.contact_number ||
      conversation.customer_phone ||
      conversation.from_number ||
      conversation.phone ||
      conversation.number ||
      null
    );
  }, []);


  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  const syncLiveStatesForConversations = useCallback(async (items = []) => {
    if (!session?.access_token) return;

    const contacts = Array.from(
      new Set(
        (Array.isArray(items) ? items : [])
          .map((item) => getInboxConversationContactValue(item))
          .filter(Boolean)
      )
    );

    if (!contacts.length) return;

    const nextStates = {};

    await Promise.all(
      contacts.map(async (contact) => {
        try {
          const response = await fetch(
            `/api/attendance/state?contact=${encodeURIComponent(contact)}`,
            {
              method: 'GET',
              headers,
              cache: 'no-store',
            }
          );

          const payload = await response.json().catch(() => null);

          if (response.ok && payload?.success && payload?.data) {
            nextStates[contact] = payload.data;
          }
        } catch (error) {
          console.warn('Inbox live state sync warning', contact, error);
        }
      })
    );

    if (Object.keys(nextStates).length > 0) {
      setLiveStates((prev) => ({ ...prev, ...nextStates }));
    }
  }, [headers, session?.access_token]);

  

  
  const [queueFilter, setQueueFilter] = useState('all');
  const [surfaceError, setSurfaceError] = useState('');
  const [surfaceWarning, setSurfaceWarning] = useState('');
  const [lastSuccessfulListSyncAt, setLastSuccessfulListSyncAt] = useState('');
const [agentDirectory, setAgentDirectory] = useState({});
const [liveStates, setLiveStates] = useState({});

  

  const effectiveConversations = useMemo(
    () => buildInboxEffectiveConversations(conversations, liveStates),
    [conversations, liveStates]
  );

  const selectedConversationEffective = useMemo(() => {
    if (!selectedConversation) return null;
    return buildInboxEffectiveConversations([selectedConversation], liveStates)[0] || selectedConversation;
  }, [selectedConversation, liveStates]);

  const ownerLabel = resolveFriendlyOwnerLabel(selectedConversationEffective, agentDirectory, session);
  const assignableAgentOptions = useMemo(
    () => buildAssignableAgentOptions(agentDirectory, session),
    [agentDirectory, session]
  );
  const selectedOwnerId = resolveConversationOwnerId(selectedConversationEffective || selectedConversation);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignAgentId, setReassignAgentId] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignError, setReassignError] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');

useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const response = await fetch('/api/users/agents', { headers });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const items = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];
        setAgentDirectory(buildAgentDirectory(items));
      } catch (error) {
        console.warn('Failed to load inbox agent directory', error);
      }
    })();
  }, [session?.access_token]);
useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    if (!showReassignModal) return;

    const fallbackOwner =
      selectedOwnerId ||
      session?.user?.id ||
      assignableAgentOptions?.[0]?.id ||
      '';

    setReassignAgentId(fallbackOwner);
    setReassignError('');
  }, [showReassignModal, selectedOwnerId, session?.user?.id, assignableAgentOptions]);

  useEffect(() => {
    if (!actionFeedback) return;
    const timeout = setTimeout(() => setActionFeedback(''), 3500);
    return () => clearTimeout(timeout);
  }, [actionFeedback]);


  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  
  const currentUserId = session?.user?.id || null;

  const queueMetrics = useMemo(
    () => buildInboxOperationalMetrics(effectiveConversations, currentUserId),
    [effectiveConversations, currentUserId]
  );

  const orderedConversations = useMemo(
    () =>
      buildOrderedInboxConversations({
        conversations: effectiveConversations,
        currentUserId,
        queueFilter,
      }),
    [effectiveConversations, currentUserId, queueFilter]
  );

  // __AUTOATENDE_V4_R15A_R4G_SAFE_INLINE_LABEL_FILTER__
  const [aaR15a4ListLabelFilter, setAaR15a4ListLabelFilter] = useState('all');

  const aaR15a4ListLabelFilterOptions = [
    { value: 'all', label: 'Todas' },
    ...aaR33eR4UserCreatedLabelFilterOptions(conversations),
  ];

  const aaR15a4VisibleConversations = useMemo(() => {
    const list = Array.isArray(orderedConversations) ? orderedConversations : [];

    if (aaR15a4ListLabelFilter === 'all') {
      return list;
    }

    return list.filter((conversation) => {
      const labels = aaR15a3NormalizeLabels(conversation?.labels);

      if (aaR15a4ListLabelFilter === 'none') {
        return labels.length === 0;
      }

      return labels.includes(aaR15a4ListLabelFilter);
    });
  }, [orderedConversations, aaR15a4ListLabelFilter]);

  const aaR15a4ListLabelFilterControl = (
    <div className="aa-r15a4-list-filter" aria-label="Filtro discreto por etiqueta da lista">
      <span className="aa-r15a4-list-filter__label">Filtro</span>
      <select
        className="aa-r15a4-list-filter__select"
        value={aaR15a4ListLabelFilter}
        onChange={(event) => setAaR15a4ListLabelFilter(event.target.value)}
        aria-label="Filtrar lista por etiqueta"
      >
        {aaR15a4ListLabelFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );


  const inboxEmptyState = useMemo(
    () => buildInboxEmptyState(queueFilter, effectiveConversations.length),
    [queueFilter, effectiveConversations.length]
  );
const fetchConversations = useCallback(async (searchQuery = '', options = {}) => {
    const { silent = false } = options;

    if (!session?.access_token) return;
    if (listBusyRef.current) return;

    listBusyRef.current = true;
    if (!silent) setLoadingList(true);
      setSurfaceError('');

    try {
      const query = searchQuery ? `search=${encodeURIComponent(searchQuery)}&` : '';
      const url = `/api/inbox/conversations?${query}_ts=${Date.now()}`;

      const res = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar conversas.');
      }

      const payload = await res.json();
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      setConversations(aaR23cNormalizeInboxConversationsForDisplay(list));
      await syncLiveStatesForConversations(list);
      setLastListSync(new Date().toISOString());
      setLastSuccessfulListSyncAt(new Date().toISOString());
      setLastSuccessfulListSyncAt(new Date().toISOString());

      setSelectedConversation((current) => {
        if (!current?.id) {
          return list[0] || null;
        }

        const updated = list.find((item) => item.id === current.id);
        return updated || (!searchQuery && list.length > 0 ? list[0] : current);
      });

      const selected = selectedConversationRef.current;
      if (selected?.id) {
        const updatedSelected = list.find((item) => item.id === selected.id);

        const previousTs = getConversationTimestamp(selected);
        const nextTs = getConversationTimestamp(updatedSelected);

        if (updatedSelected && nextTs && nextTs !== previousTs) {
          // força refresh da thread quando a conversa selecionada foi alterada
          setTimeout(() => {
            fetchMessages(updatedSelected.id, { silent: true });
          }, 0);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar conversas', error);
      setSurfaceError(buildOperationalSurfaceErrorMessage(error, 'Não foi possível carregar a fila do Inbox agora.'));
    } finally {
      listBusyRef.current = false;
      if (!silent) setLoadingList(false);
    }
  }, [headers, session?.access_token]);

  const fetchMessages = useCallback(async (conversationId, options = {}) => {
    const aaR22cBRequestId = Date.now() + Math.random();
    latestMessagesRequestRef.current = aaR22cBRequestId;
    const aaR22cBSilent = Boolean(options?.silent);

    if (!aaR22cBSilent) {
      setMessagesLoading(true);
    }

    const aaR22cBIsCurrentRequest = () => latestMessagesRequestRef.current === aaR22cBRequestId;

    const { silent = false } = options;

    if (!session?.access_token || !conversationId) return;
    if (threadBusyRef.current) return;

    threadBusyRef.current = true;
    if (!silent) setLoadingThread(true);

    try {
      const url = `/api/inbox/conversations/${conversationId}/messages?_ts=${Date.now()}`;

      const res = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar mensagens.');
      }

      const payload = await res.json();
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      if (aaR22cBIsCurrentRequest()) {
      setMessages(aaR23cNormalizeInboxMessagesForDisplay(list));
    }
      setSurfaceWarning('');
      setLastThreadSync(new Date().toISOString());
    } catch (error) {
      console.error('Erro ao carregar mensagens', error);
      setSurfaceWarning(buildOperationalSurfaceErrorMessage(error, 'A thread ficou temporariamente indisponível.'));
    } finally {
      if (aaR22cBIsCurrentRequest()) {
        setMessagesLoading(false);
      }
      threadBusyRef.current = false;
      if (!silent) setLoadingThread(false);
    }
  }, [headers, session?.access_token]);

  useEffect(() => {
    if (session?.access_token) {
      fetchConversations('');
    }
  }, [session?.access_token, fetchConversations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (session?.access_token) {
      fetchConversations(search);
    }
  }, [search, session?.access_token, fetchConversations]);

  useEffect(() => {
    if (!selectedConversation?.id) {
      setMessages(aaR23cNormalizeInboxMessagesForDisplay([]));
      return;
    }

    fetchMessages(selectedConversation.id, { silent: false });
  }, [selectedConversation?.id, fetchMessages]);

  useEffect(() => {
    const nextMode = String(selectedConversationEffective?.mode || 'bot').toLowerCase() === 'human' ? 'human' : 'bot';
    setInlineMode(nextMode);
    setHandoverError('');
  }, [selectedConversationEffective?.id, selectedConversationEffective?.mode]);

  const handleInlineHandover = useCallback(async (targetMode) => {
    if (!selectedConversation || !session?.access_token) return;

    const contact = getConversationContact(selectedConversation);
    if (!contact) {
      setHandoverError('Não foi possível identificar o contato desta conversa.');
      return;
    }

    setHandoverBusy(true);
    setHandoverError('');

    try {
      const endpoint =
        targetMode === 'human'
          ? '/api/attendance/transfer/human'
          : '/api/attendance/return/bot';

      const payload =
        targetMode === 'human'
          ? { contact }
          : { contact };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let message = `Falha ao alterar modo de atendimento (${res.status})`;
        try {
          const data = await res.json();
          message = data?.error || data?.message || message;
        } catch (_) {}
        throw new Error(message);
      }

      setInlineMode(targetMode);

      await Promise.allSettled([
        fetchConversations(searchRef.current || '', { silent: true }),
        fetchMessages(selectedConversation.id, { silent: true })
      ]);
    } catch (err) {
      setHandoverError(String(err?.message || err));
    } finally {
      setHandoverBusy(false);
    }
  }, [selectedConversation, session?.access_token, fetchConversations, fetchMessages, getConversationContact]);

  const handleOpenReassignModal = useCallback(() => {
    if (!selectedConversation) return;

    const fallbackOwner =
      selectedOwnerId ||
      session?.user?.id ||
      assignableAgentOptions?.[0]?.id ||
      '';

    setReassignAgentId(fallbackOwner);
    setReassignError('');
    setShowReassignModal(true);
  }, [selectedConversation, selectedOwnerId, session?.user?.id, assignableAgentOptions]);

  const handleConfirmReassign = useCallback(async () => {
    if (!selectedConversation || !session?.access_token) return;

    const contact = getConversationContact(selectedConversation);
    if (!contact) {
      setReassignError('Não foi possível identificar o contato desta conversa.');
      return;
    }

    if (!reassignAgentId) {
      setReassignError('Selecione um agente para continuar.');
      return;
    }

    const selectedConversationId = selectedConversation.id;
    const selectedAgent =
      assignableAgentOptions.find((agent) => agent.id === reassignAgentId) || null;

    const optimisticPatch = {
      mode: 'human',
      assigned_user_id: reassignAgentId,
      assigned_agent_id: reassignAgentId,
      owner_user_id: reassignAgentId,
      assigned_user: selectedAgent
        ? {
            id: selectedAgent.id,
            name: selectedAgent.name || selectedAgent.label,
            email: selectedAgent.email || '',
          }
        : undefined,
      assigned_agent: selectedAgent
        ? {
            id: selectedAgent.id,
            name: selectedAgent.name || selectedAgent.label,
            email: selectedAgent.email || '',
          }
        : undefined,
    };

    setReassignBusy(true);
    setReassignError('');
    setInlineMode('human');

    setSelectedConversation((current) =>
      current ? { ...current, ...optimisticPatch } : current
    );

    setConversations((current) =>
      Array.isArray(current)
        ? current.map((conversation) =>
            conversation?.id === selectedConversationId
              ? { ...conversation, ...optimisticPatch }
              : conversation
          )
        : current
    );

    try {
      const response = await fetch('/api/attendance/transfer/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          contact,
          agent_id: reassignAgentId
        })
      });

      if (!response.ok) {
        let message = `Falha ao reatribuir atendimento (${response.status})`;
        try {
          const payload = await response.json();
          message = payload?.error || payload?.message || message;
        } catch (_) {}
        throw new Error(message);
      }

      setShowReassignModal(false);
      setActionFeedback(
        `Responsável atualizado para ${selectedAgent?.label || 'o agente selecionado'}.`
      );

      await Promise.allSettled([
        fetchConversations(searchRef.current || '', { silent: true }),
        fetchMessages(selectedConversationId, { silent: true })
      ]);
    } catch (err) {
      await Promise.allSettled([
        fetchConversations(searchRef.current || '', { silent: true }),
        fetchMessages(selectedConversationId, { silent: true })
      ]);
      setReassignError(String(err?.message || err));
    } finally {
      setReassignBusy(false);
    }
  }, [
    selectedConversation,
    session?.access_token,
    reassignAgentId,
    assignableAgentOptions,
    getConversationContact,
    fetchConversations,
    fetchMessages
  ]);



  useEffect(() => {
    if (!session?.access_token) return;

    const interval = setInterval(() => {
      if (aaR21cB1ShouldSkipBackgroundPoll()) return;
      if (!aaR21cB1CanPoll('conversations', Math.max(LIST_POLL_MS, 30000))) return;

      fetchConversations(searchRef.current, { silent: true });
    }, Math.max(LIST_POLL_MS, 30000));

    return () => clearInterval(interval);
  }, [session?.access_token, fetchConversations, aaR21cB1ShouldSkipBackgroundPoll, aaR21cB1CanPoll]);

  useEffect(() => {
    if (!session?.access_token || !selectedConversation?.id) return;

    const conversationId = selectedConversation.id;

    const interval = setInterval(() => {
      if (aaR21cB1ShouldSkipBackgroundPoll()) return;
      if (!aaR21cB1CanPoll('messages', Math.max(THREAD_POLL_MS, 20000))) return;

      fetchMessages(conversationId, { silent: true });
    }, Math.max(THREAD_POLL_MS, 20000));

    return () => clearInterval(interval);
  }, [session?.access_token, selectedConversation?.id, fetchMessages, aaR21cB1ShouldSkipBackgroundPoll, aaR21cB1CanPoll]);

  useEffect(() => {
    if (!session?.access_token) return;

    const handleFocus = () => {
      if (aaR21cB1ShouldSkipBackgroundPoll()) return;
      if (!aaR21cB1CanPoll('focus', 12000)) return;

      fetchConversations(searchRef.current, { silent: true });

      if (selectedConversationRef.current?.id) {
        fetchMessages(selectedConversationRef.current.id, { silent: true });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session?.access_token, fetchConversations, fetchMessages, aaR21cB1ShouldSkipBackgroundPoll, aaR21cB1CanPoll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'end',
    });
  }, [messages.length, selectedConversation?.id]);

  const onSend = async (event) => {
    event.preventDefault();

    if (!draft.trim() || !selectedConversation?.id || sending) return;

    setSending(true);

    const text = draft.trim();
    const optimisticId = `temp-${Date.now()}`;

    const optimisticMessage = {
      id: optimisticId,
      direction: 'outbound',
      sender_type: 'human',
      content: text,
      created_at: new Date().toISOString(),
      optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft('');

    try {
      const res = await fetch(`/api/inbox/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error('Falha ao enviar mensagem');
      }

      await Promise.all([
        fetchMessages(selectedConversation.id, { silent: true }),
        fetchConversations(searchRef.current, { silent: true }),
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      alert('Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 aa-page-shell-inbox aa-r14a2-inbox" data-aa-page="inbox" data-aa-r14a2="__AUTOATENDE_V4_R14A_R2_INBOX_SURGICAL_REAL_CLASSES_POLISH__" data-aa-marker="__AUTOATENDE_P2_R2B_INBOX_DETERMINISTIC_CLEAN__">

      

<div className="aa-ops-workspace">

        {actionFeedback ? (
          <div className="mb-4">
            <OperationalSurfaceBanner
              tone="success"
              title="Ownership atualizada"
              description={actionFeedback}
            />
          </div>
        ) : null}


        {(surfaceError || surfaceWarning) ? ( /* __AUTOATENDE_P2_R2C_HEADER_RECOVERY__ */
          <div className="mb-4 space-y-3">
            {surfaceError ? (
              <OperationalSurfaceBanner
                tone="error"
                title="Operação com atenção"
                description={surfaceError}
                actionLabel="Tentar novamente"
                onAction={() => {
                  fetchConversations(searchRef.current || '', { silent: false });
                  if (selectedConversationRef.current?.id) {
                    fetchMessages(selectedConversationRef.current.id, { silent: false });
                  }
                }}
              />
            ) : null}

            {!surfaceError && surfaceWarning ? (
              <OperationalSurfaceBanner
                tone="warning"
                title="Sincronização parcial"
                description={surfaceWarning}
                actionLabel="Recarregar"
                onAction={() => {
                  fetchConversations(searchRef.current || '', { silent: false });
                  if (selectedConversationRef.current?.id) {
                    fetchMessages(selectedConversationRef.current.id, { silent: false });
                  }
                }}
              />
            ) : null}

          </div>
        ) : null}
      <div className="aa-inbox-local-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" data-aa-marker="__AUTOATENDE_P2_R2B_INBOX_DETERMINISTIC_CLEAN__">
        <div className="aa-inbox-local-copy">
          <div className="aa-inbox-local-kicker">Inbox</div>
          <div className="aa-inbox-local-meta">
            <span className="aa-ops-section-support">Central operacional</span>
            <span className="aa-ops-section-state">Tempo real</span>
          </div>
        </div>

        <div className="aa-inbox-local-actions flex flex-wrap items-center gap-2">
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            Lista: {lastListSync ? formatTime(lastListSync) : '--:--'}
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            Thread: {lastThreadSync ? formatTime(lastThreadSync) : '--:--'}
          </div>
          <button type="button"
            onClick={() => {
              fetchConversations(searchRef.current, { silent: false });
              if (selectedConversationRef.current?.id) {
                fetchMessages(selectedConversationRef.current.id, { silent: false });
              }
            }}
            className="aa-premium-surface inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {loadingList || loadingThread ? 'Atualizando...' : 'Atualizar operação'}
          </button>
        </div>
      </div>

      
        <div className="aa-inbox-metrics-row grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Fila total</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{queueMetrics.total}</p>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-yellow-700">Humano</p>
            <p className="mt-2 text-2xl font-bold text-yellow-900">{queueMetrics.human}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Minhas</p>
            <p className="mt-2 text-2xl font-bold text-blue-900">{queueMetrics.mine}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-rose-700">Sem responsável</p>
            <p className="mt-2 text-2xl font-bold text-rose-900">{queueMetrics.unassigned}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-green-700">Bot</p>
            <p className="mt-2 text-2xl font-bold text-green-900">{queueMetrics.bot}</p>
          </div>
        </div>

        <div className="aa-inbox-filters-row aa-inbox-filters-row--scoped aa-inbox-filters-row--compact mt-4 flex flex-wrap gap-2">
          {[
            { id: 'all', label: `Todas (${queueMetrics.total})` },
            { id: 'human', label: `Humano (${queueMetrics.human})` },
            { id: 'mine', label: `Minhas (${queueMetrics.mine})` },
            { id: 'unassigned', label: `Sem responsável (${queueMetrics.unassigned})` },
            { id: 'bot', label: `Bot (${queueMetrics.bot})` },
          ].map((filter) => {
            const isActive = queueFilter === filter.id;

            return (
              <button type="button"
                key={filter.id}
                
                onClick={() => setQueueFilter(filter.id)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="aa-inbox-main-layout aa-r14a2-main-layout">
        <section className="aa-inbox-list-panel aa-inbox-list-panel--scoped aa-premium-surface aa-r14a2-list-panel overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          
              <div className="aa-inbox-filter-strip border-b border-gray-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Filtro ativo · {getInboxFilterLabel(queueFilter)}
                </p>
              </div>
              <div className="aa-inbox-search-wrap border-b border-gray-200 p-3">
            <label className="aa-inbox-searchbox flex items-center rounded-md border border-gray-300 px-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full border-0 px-2 py-2 text-sm focus:outline-none"
                placeholder="Buscar nome ou telefone"
              />
            </label>
          </div>

          <div className="aa-inbox-list-scroll aa-inbox-list-scroll--scoped aa-inbox-list-scroll--compact">
            {!aaR21gDisableInboxSkeletonUi && loadingList && conversations.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                
              </div>
            ) : orderedConversations.length === 0 ? (
                            <OperationalEmptyStateCard
                title={inboxEmptyState.title}
                description={inboxEmptyState.description}
                actionLabel={inboxEmptyState.actionLabel}
                onAction={() => {
                  if (inboxEmptyState.resetFilter) {
                    setQueueFilter('all');
                    return;
                  }
                  fetchConversations(searchRef.current || '', { silent: false });
                }}
              />
            ) : (
              (
                    <>
                      {aaR15a4ListLabelFilterControl}
                      {aaR15a4ListLabelFilter !== 'all' && aaR15a4VisibleConversations.length === 0 ? (
                        <div className="aa-r15a4-list-filter-empty" role="status">
                          Nenhuma conversa encontrada para esta etiqueta.
                        </div>
                      ) : null}
                      {aaR15a4VisibleConversations.map((conversation) => {
                const isSelected = selectedConversation?.id === conversation.id;
                const timestamp = getConversationTimestamp(conversation);

                return (
                  <button type="button"
                    key={conversation.id}
                    onClick={() => aaR22cDBR3SelectConversationInstantly(conversation)}
                    className={`aa-r14a2-conversation-card w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${isSelected ? 'aa-r14a2-conversation-card--selected bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="aa-r25c-r2d-contact-cell aa-r25c-r2d-contact-cell--inbox-list min-w-0">
                              <AaR25cR2dContactAvatar contact={conversation} variant="inbox-list" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">
                                  {conversation.contact_name || conversation.contact_number || 'Contato sem identificação'}
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                  {conversation.contact_number || '-'}
                                </p>
                              </div>
                            </div>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {formatTime(timestamp)}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-xs text-gray-500">
                      {getPreview(conversation)}
                    </p>
                        {getInboxConversationMode(conversation) === 'human' && (
                          <p className="mt-1 truncate text-[11px] text-gray-400">Responsável: {resolveFriendlyOwnerLabel(conversation, agentDirectory, session)}</p>
                        )} {/* __AUTOATENDE_V4_R5N_R16H_HIDE_BOT_OWNER_IN_LIST_CARD__ */}

                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                    {aaR15a3PrimaryLabel(conversation?.labels) ? (
                      <div className="aa-r15a3-label-row">
                        <span className="aa-r15a3-label-chip">
                          {aaR15a3LabelName(aaR15a3PrimaryLabel(conversation?.labels))}
                        </span>
                      </div>
                    ) : null}

                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                          ((selectedConversation?.id === conversation.id ? inlineMode : (String(conversation.mode || 'bot').toLowerCase() === 'human' ? 'human' : 'bot')) === 'human')
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {((selectedConversation?.id === conversation.id ? inlineMode : (String(conversation.mode || 'bot').toLowerCase() === 'human' ? 'human' : 'bot')) === 'human') ? 'HUMANO' : 'BOT'}
                        </span>
                      </span>

                      {timestamp ? (
                        <span className="text-[11px] text-gray-400">
                          {formatDateTime(timestamp)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
                    </>
                  )
            )}
          </div>
        </section>

        <section className="aa-inbox-thread-panel aa-inbox-thread-panel--scoped aa-premium-surface aa-r14a2-thread-panel overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                    <div
            className="aa-inbox-thread-header aa-inbox-thread-header--scoped aa-inbox-thread-header--unified aa-inbox-thread-header--with-actions aa-r14a2-thread-header border-b border-gray-200 px-4 py-3"
            data-aa-marker="__AUTOATENDE_V4_R5N_R15T_INBOX_REAL_UNIFIED_HEADER_STRUCTURE__"
          >
            <div className="aa-inbox-thread-identity">
              <div className="aa-r25c-r2d-contact-cell aa-r25c-r2d-contact-cell--inbox-header">
                        <AaR25cR2dContactAvatar contact={selectedConversationEffective || selectedConversation || {}} variant="inbox-header" />
                        <p className="aa-inbox-thread-contact-primary aa-r14a2-contact-primary text-sm font-semibold text-gray-900">
                {selectedConversationEffective?.contact_name || selectedConversationEffective?.contact_number || selectedConversation?.contact_name || selectedConversation?.contact_number || 'Selecione uma conversa'}
              </p>
                      </div>
              {/* __AUTOATENDE_V4_R5N_R16G_SAFE_METADATA_MICROPATCH__: telefone secundário ocultado para evitar duplicação no header */}
              {inlineMode === 'human' && (
                <p className="aa-inbox-thread-owner text-xs font-medium text-gray-600">
                  Responsável: {ownerLabel}
                </p>
              )} {/* __AUTOATENDE_V4_R5N_R16G_SAFE_METADATA_MICROPATCH__: owner visível apenas em HUMANO */}
            </div>

            {selectedConversation ? (
              <div className="aa-inbox-thread-actions aa-r14a2-thread-actions">

                {selectedConversation ? (
                  <div className="aa-r15a3-label-control">
                    <span className="aa-r15a3-label-control__caption">Etiqueta</span>
                    <div className="aa-r33d-label-editor" data-aa-marker="__AUTOATENDE_V4_R33D_REPLACE_LABEL_SELECT_WITH_FREEFORM_EDITOR_FRONTEND_ONLY___UI">
                      <input
                        key={`aa-r33d-label-${selectedConversation?.id || selectedConversationEffective?.id || 'none'}-${aaR15a3PrimaryLabel(selectedConversation?.labels || selectedConversationEffective?.labels) || 'empty'}`}
                        className="aa-r33d-label-editor__input"
                        type="text"
                        maxLength={48}
                        disabled={aaR15a3SavingLabel}
                        placeholder="Sem etiqueta"
                        aria-label="Etiqueta da conversa"
                        defaultValue={aaR15a3PrimaryLabel(selectedConversation?.labels || selectedConversationEffective?.labels) ? aaR15a3LabelName(aaR15a3PrimaryLabel(selectedConversation?.labels || selectedConversationEffective?.labels)) : ''}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            const value = String(event.currentTarget.value || '').trim().replace(/\s+/g, ' ').slice(0, 48);
                            aaR15a3HandleLabelChange({ target: { value } });
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="aa-r33d-label-editor__button aa-r33d-label-editor__button--save"
                        disabled={aaR15a3SavingLabel}
                        onClick={(event) => {
                          const input = event.currentTarget.parentElement?.querySelector('input');
                          const value = String(input?.value || '').trim().replace(/\s+/g, ' ').slice(0, 48);
                          aaR15a3HandleLabelChange({ target: { value } });
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="aa-r33d-label-editor__button aa-r33d-label-editor__button--clear"
                        disabled={aaR15a3SavingLabel || !aaR15a3PrimaryLabel(selectedConversation?.labels || selectedConversationEffective?.labels)}
                        onClick={(event) => {
                          const input = event.currentTarget.parentElement?.querySelector('input');
                          if (input) input.value = '';
                          aaR15a3HandleLabelChange({ target: { value: '' } });
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="aa-inbox-thread-state-chip aa-r14a2-state-chip">
                  <span className="aa-inbox-thread-state-label aa-r14a2-state-label text-sm font-medium text-gray-600">
                    Estado da conversa:
                  </span>
                  <span
                    className={`aa-inbox-thread-state-badge aa-r14a2-state-badge inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      inlineMode === 'human' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {inlineMode === 'human' ? <User className="mr-1 h-3 w-3" /> : <Bot className="mr-1 h-3 w-3" />}
                    {inlineMode === 'human' ? 'HUMANO' : 'BOT'}
                  </span>
                </div>

                <div className="aa-inbox-thread-action-buttons">
                  {inlineMode === 'human' ? (
                    <>
                      <button
                        type="button"
                        onClick={handleOpenReassignModal}
                        className="aa-inbox-reassign-btn aa-inbox-reassign-btn--compact inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
                      >
                        Reatribuir
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInlineHandover('bot')}
                        disabled={handoverBusy}
                        className="aa-inbox-return-bot-btn aa-inbox-return-bot-btn--compact inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {handoverBusy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                        Voltar para Bot
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInlineHandover('human')}
                      disabled={handoverBusy}
                      className="aa-inbox-handover-btn aa-inbox-handover-btn--compact inline-flex items-center rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-900 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {handoverBusy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                      Assumir conversa no humano
                    </button>
                  )}
                </div>

                {handoverError ? (
                  <div className="aa-inbox-thread-handover-error rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {handoverError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

<div className="aa-inbox-thread-messages aa-inbox-thread-messages--unified aa-r14a2-thread-messages space-y-3 bg-gray-50 p-4">
            {!selectedConversation ? (
              <p className="text-sm text-gray-500">Selecione uma conversa para visualizar o histórico.</p>
            ) : !aaR21gDisableInboxSkeletonUi && loadingThread && messages.length === 0 ? (
              <div className="flex items-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando mensagens...
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-gray-500">Sem mensagens nesta conversa.</p>
            ) : (
              messages.map((message, index) => {
                const outbound = isOutbound(message);
                const aaR19bBMessageText = extractText(message);
                const aaR24cBR3bMediaInfo = aaR24cBR3bMedia(message);
                const aaR19bBTemplate = aaR19bBParseHistoricalTemplateText(aaR19bBMessageText);
                const senderLabel = getSenderLabel(message);

                return (
                  <div
                    key={getMessageKey(message, index)}
                    className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`aa-r14a2-message-bubble ${outbound ? 'aa-r14a2-message-bubble--outbound' : 'aa-r14a2-message-bubble--inbound'} max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        outbound ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                      } ${message?.optimistic ? 'opacity-80' : ''}`}
                    >
                      <div
                        className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
                          outbound ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {senderLabel}
                      </div>

                      <p className="whitespace-pre-wrap break-words">
                        {
                    aaR24cBR3bMediaInfo ? (
                      <span className={`aa-r24c-b-r3b-media-card aa-r24c-b-r3b-media-card--${aaR24cBR3bMediaInfo.type}`}>
                        <span className="aa-r24c-b-r3b-media-icon" aria-hidden="true">
                          {aaR24cBR3bMediaInfo.icon}
                        </span>
                        <span className="aa-r24c-b-r3b-media-copy">
                          <strong>{aaR24cBR3bMediaInfo.label}</strong>
                          <span>{aaR24cBR3bMediaInfo.description}</span>
                          {aaR24cBR3bMediaInfo.extra ? <small>{aaR24cBR3bMediaInfo.extra}</small> : null}
                        </span>
                        {aaR24dCBR2HasPreview(message) ? <AaR24dCBR2MediaPreview message={message} /> : null}
                        {aaR24eCR2HasNonImageMedia(message) ? <AaR24eCR2NonImageMediaRenderer message={message} /> : null}
                      </span>
                    ) : aaR19bBTemplate ? (
                            <span className="aa-r19b-template-card" title={aaR19bBTemplate.raw}>
                              <span className="aa-r19b-template-card__eyebrow">Template WhatsApp</span>
                              <span className="aa-r19b-template-card__title">{aaR19bBTemplate.title}</span>
                              <span className="aa-r19b-template-card__description">{aaR19bBTemplate.description}</span>
                              <span className="aa-r19b-template-card__meta">{aaR19bBTemplateMetaFallback(aaR19bBTemplate)}</span>
                            </span>
                          ) : (
                            aaR19bBMessageText || '[mensagem sem texto]'
                          )}
                      </p>

                      <p
                        className={`mt-1 text-[10px] ${
                          outbound ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {message?.created_at ? formatDateTime(message.created_at) : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            
            
            <div ref={bottomRef} />

          </div>

          
            {aaR15a3LabelError ? (
              <div className="aa-r15a3-label-error">{aaR15a3LabelError}</div>
            ) : null}

<form onSubmit={onSend} className="aa-premium-surface border-0 bg-transparent px-3 py-2 aa-inbox-thread-composer aa-inbox-thread-composer--dense aa-r14a2-thread-composer aa-r14a3b-thread-composer aa-r14a4-thread-composer" data-aa-marker="__AUTOATENDE_C16H_R3B_INBOX_SAFE_APPEND__">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva a resposta da conversa"
                className="aa-r14a2-reply-input w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button type="submit"
                
                disabled={sending || !draft.trim() || !selectedConversation}
                className="aa-inbox-reply-btn aa-r14a2-reply-btn inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Responder
              </button>
            </div>
          </form>
        </section>
      </div>
      </div>
      {showReassignModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Reatribuir responsável</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Escolha quem ficará responsável pela conversa humana atual.
                </p>
              </div>
              <button type="button"
                
                onClick={() => {
                  if (reassignBusy) return;
                  setShowReassignModal(false);
                  setReassignError('');
                }}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-900"
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Conversa selecionada
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {selectedConversation?.contact_name || selectedConversation?.contact_number || 'Contato sem identificação'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Contato: {selectedConversation?.contact_number || selectedConversation?.contact_phone || '-'}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Novo responsável
                </label>
                <select
                  value={reassignAgentId}
                  onChange={(event) => setReassignAgentId(event.target.value)}
                  disabled={reassignBusy}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400"
                >
                  <option value="">Selecionar agente</option>
                  {assignableAgentOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </select>
              </div>

              {reassignError ? (
                <div className="rounded-xl border border-red-900/60 bg-red-950/60 px-4 py-3 text-sm text-red-200">
                  {reassignError}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button"
                  
                  onClick={() => {
                    if (reassignBusy) return;
                    setShowReassignModal(false);
                    setReassignError('');
                  }}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
                >
                  Cancelar
                </button>
                <button type="button"
                  
                  onClick={handleConfirmReassign}
                  disabled={reassignBusy || !reassignAgentId}
                  className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reassignBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar responsável'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="aa-footer-hero order-last" data-aa-marker="__AUTOATENDE_C7E_R4F_INBOX_HERO_BOTTOM__">
        <div className="aa-footer-hero-eyebrow">Operação comercial e atendimento</div>
        <div className="aa-footer-hero-row">
          <div className="aa-footer-hero-copy">
            <h2 className="aa-footer-hero-title">Inbox operacional</h2>
            <p className="aa-footer-hero-subtitle">Central operacional mais limpa para assumir, responder e acompanhar conversas sem excesso de texto no topo da tela.</p>
          </div>
          <div className="aa-footer-hero-chips">
            <span className="aa-footer-hero-chip">Leitura clara</span>
            <span className="aa-footer-hero-chip">Assunção rápida</span>
            <span className="aa-footer-hero-chip">Contexto preservado</span>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Inbox;

// __AUTOATENDE_R14I_R1_INBOX_EXPLICIT_HOOKS__

// __AUTOATENDE_V4_R14A_R2C_INBOX_COMPOSER_FINAL_REFINEMENT__

// __AUTOATENDE_V4_R14A_R3B_INBOX_STABLE_TRANSITION_NO_PANEL_TEARDOWN__

// __AUTOATENDE_V4_R14A_R4_INBOX_REMOVE_COMPOSER_CHAT_SEAM__

// __AUTOATENDE_V4_R15A_R3_INBOX_LABELS_MINIMAL_UI__

// __AUTOATENDE_V4_R15A_R3B_FIX_LABEL_SELECT_INTERACTION__

// __AUTOATENDE_V4_R15A_R3C_FIX_INBOX_BLACK_SCREEN_REMOVE_INVALID_TOP_HOOK__

// __AUTOATENDE_V4_R15A_R3D_FIX_INBOX_BLACK_SCREEN_SESSION_TDZ__

// __AUTOATENDE_V4_R15A_R3E_FIX_SELECTED_CONVERSATION_BEFORE_LABEL_HANDLER__

// __AUTOATENDE_V4_R15A_R3F_FIX_LABEL_CONTACT_RESOLUTION__


/* __AUTOATENDE_V4_R17A_B1_INBOX_24H_WINDOW_FEEDBACK__ */
/* __AUTOATENDE_V4_R17A_B1_FIX_MOUNT_AWARE_PUBLISH__ */
function aaR17aB1Text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function aaR17aB1Show24hWindowNotice(payload = {}) {
  if (typeof document === 'undefined') return;

  const details = payload && typeof payload === 'object' ? payload.details || {} : {};
  const message = aaR17aB1Text(
    payload?.message,
    'A janela de atendimento de 24h está fechada. Use um template aprovado para retomar a conversa.'
  );

  const existing = document.querySelector('[data-aa-r17a-b1-window-notice="true"]');
  if (existing) existing.remove();

  const notice = document.createElement('div');
  notice.className = 'aa-r17a-b1-window-notice';
  notice.setAttribute('data-aa-r17a-b1-window-notice', 'true');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const eyebrow = document.createElement('div');
  eyebrow.className = 'aa-r17a-b1-window-notice__eyebrow';
  eyebrow.textContent = 'Envio manual bloqueado';

  const title = document.createElement('div');
  title.className = 'aa-r17a-b1-window-notice__title';
  title.textContent = 'Janela de 24h fechada';

  const body = document.createElement('div');
  body.className = 'aa-r17a-b1-window-notice__body';
  body.textContent = message;

  const meta = document.createElement('div');
  meta.className = 'aa-r17a-b1-window-notice__meta';

  const hours = details.hours_since_last_inbound;
  const expiresAt = aaR17aB1Text(details.window_expires_at, '');

  if (hours !== null && hours !== undefined && hours !== '') {
    meta.textContent = `Último contato do cliente há ${hours}h. Para reabrir, escolha um template aprovado.`;
  } else if (expiresAt) {
    meta.textContent = `A janela expirou em ${expiresAt}. Para reabrir, escolha um template aprovado.`;
  } else {
    meta.textContent = 'Para reabrir a conversa, use a área de templates aprovados.';
  }

  const actions = document.createElement('div');
  actions.className = 'aa-r17a-b1-window-notice__actions';

  const templatesLink = document.createElement('a');
  templatesLink.className = 'aa-r17a-b1-window-notice__button aa-r17a-b1-window-notice__button--primary';
  templatesLink.href = '/configuracoes/aquisicao/templates';
  templatesLink.textContent = 'Ver templates';

  const closeButton = document.createElement('button');
  closeButton.className = 'aa-r17a-b1-window-notice__button aa-r17a-b1-window-notice__button--ghost';
  closeButton.type = 'button';
  closeButton.textContent = 'Entendi';
  closeButton.addEventListener('click', () => notice.remove());

  actions.appendChild(templatesLink);
  actions.appendChild(closeButton);

  notice.appendChild(eyebrow);
  notice.appendChild(title);
  notice.appendChild(body);
  notice.appendChild(meta);
  notice.appendChild(actions);

  document.body.appendChild(notice);

  window.clearTimeout(window.__aaR17aB1WindowNoticeTimer);
  window.__aaR17aB1WindowNoticeTimer = window.setTimeout(() => {
    const current = document.querySelector('[data-aa-r17a-b1-window-notice="true"]');
    if (current) current.remove();
  }, 9000);
}

function aaR17aB1IsInboxManualSendRequest(input, init) {
  try {
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const urlValue = typeof input === 'string' ? input : input?.url;

    if (method !== 'POST' || !urlValue) return false;

    const url = new URL(urlValue, window.location.origin);

    return /^\/api\/inbox\/conversations\/[^/]+\/messages$/.test(url.pathname);
  } catch (_) {
    return false;
  }
}

function aaR17aB1MaybeHandleManualSendResponse(input, init, response) {
  if (
    typeof window === 'undefined' ||
    !response ||
    response.status !== 409 ||
    !aaR17aB1IsInboxManualSendRequest(input, init)
  ) {
    return;
  }

  response.clone().json()
    .then((payload) => {
      const code = payload?.code || payload?.details?.code;

      if (code === 'WHATSAPP_24H_WINDOW_CLOSED') {
        aaR17aB1Show24hWindowNotice(payload);
      }
    })
    .catch(() => {});
}

if (typeof window !== 'undefined' && !window.__aaR17aB1InboxFetchPatched) {
  window.__aaR17aB1InboxFetchPatched = true;

  const aaR17aB1OriginalFetch = window.fetch.bind(window);

  window.fetch = async function aaR17aB1InboxFetchWith24hFeedback(input, init) {
    const response = await aaR17aB1OriginalFetch(input, init);
    aaR17aB1MaybeHandleManualSendResponse(input, init, response);
    return response;
  };
}
/* END __AUTOATENDE_V4_R17A_B1_INBOX_24H_WINDOW_FEEDBACK__ */

