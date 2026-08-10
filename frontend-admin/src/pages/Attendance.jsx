/* __AUTOATENDE_C7F_R2_BUTTON_SEMANTICS__ */
/* __AUTOATENDE_C7D_R1_ATTENDANCE_READ_MODEL_SYNC__ */
/* __AUTOATENDE_C7B_R3_ROLLBACK_ATTENDANCE_REASSIGN__ */
/* __AUTOATENDE_C7B_R3_AGENT_REASSIGN_UI__ */
/* __AUTOATENDE_C7B_R2_ATTENDANCE_POST_ACTION_SYNC__ */
/* __AUTOATENDE_C7B_R1_ATTENDANCE_STABILIZATION__ */
/* __AUTOATENDE_C7B_HUMAN_OPS_FOUNDATION__ */
/* __AUTOATENDE_C5A3_HF2_R1_ATTENDANCE_SWEEP__ */
// __AUTOATENDE_C3D4_ATTENDANCE_OWNERSHIP__
// __AUTOATENDE_C3D3_ATTENDANCE_SEMANTICS__
// __AUTOATENDE_C3D2_ATTENDANCE_WORKSPACE__
// __AUTOATENDE_C3D1_ATTENDANCE_SURFACE__
/* __AUTOATENDE_C3FIX_ATTENDANCE_QUEUE_REFRAME__ */
import React, { useEffect, useState, useMemo } from 'react';

// __AUTOATENDE_V4_R15A_R5C_ATTENDANCE_LABEL_CHIP__
const aaR15a5AttendanceLabelNames = {
  novo_lead: 'Novo lead',
  aguardando_cliente: 'Aguardando cliente',
  aguardando_equipe: 'Aguardando equipe',
  resolvido: 'Resolvido',
  urgente: 'Urgente',
  comercial: 'Comercial',
  suporte: 'Suporte',
  financeiro: 'Financeiro'
};

const aaR15a5NormalizeLabels = (value) => {
  if (!value) return [];

  let labels = value;

  if (typeof labels === 'string') {
    try {
      labels = JSON.parse(labels);
    } catch {
      labels = labels ? [labels] : [];
    }
  }

  if (!Array.isArray(labels)) return [];

  return labels
    .map((item) => {
      if (typeof item === 'string') return item;
      return item?.key || item?.value || item?.id || item?.slug || '';
    })
    .map((label) => String(label).trim())
    .filter(Boolean);
};

const aaR15a5PrimaryLabel = (source) => {
  const labels = aaR15a5NormalizeLabels(
    source?.labels ??
    source?.state?.labels ??
    source?.conversation_state?.labels ??
    source?.conversationState?.labels ??
    source?.operational_state?.labels ??
    source?.metadata?.labels ??
    source?.meta?.labels ??
    []
  );

  return labels[0] || '';
};

const aaR15a5AttendanceLabelChip = (source) => {
  const key = aaR15a5PrimaryLabel(source);
  if (!key) return null;

  return (
    <span className="aa-r15a5-attendance-label-chip" title="Etiqueta da conversa">
      {aaR15a5AttendanceLabelNames[key] || key}
    </span>
  );
};

import { useAuth } from '../context/AuthContext';
import { User, Bot, RefreshCw } from 'lucide-react';
import OperationsHero from '../components/ops/OperationsHero';


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
const getAttendanceFilterLabel = (filter = 'human') => {
  if (filter === 'mine') return 'Minhas';
  if (filter === 'unassigned') return 'Sem responsável';
  if (filter === 'bot') return 'Bot';
  if (filter === 'all') return 'Todas';
  return 'Humano';
};

const buildAttendanceEmptyState = (filter = 'human', totalRows = 0) => {
  if (!totalRows) {
    return {
      title: 'Nenhuma conversa operacional disponível',
      description: 'Quando novas conversas entrarem no fluxo, esta fila ficará pronta para handover e acompanhamento.',
      actionLabel: 'Recarregar fila',
      resetFilter: false,
    };
  }

  if (filter === 'mine') {
    return {
      title: 'Nenhuma conversa atribuída a você',
      description: 'Neste momento, você não possui ownership humana ativa nesta fila.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  if (filter === 'human') {
    return {
      title: 'Fila humana vazia agora',
      description: 'Não há handovers ativos neste momento. A operação humana está limpa.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  if (filter === 'unassigned') {
    return {
      title: 'Nenhuma conversa sem responsável',
      description: 'Todas as conversas humanas visíveis já possuem owner definido.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  if (filter === 'bot') {
    return {
      title: 'Nenhuma conversa em modo bot neste recorte',
      description: 'O filtro atual não retornou conversas automatizadas na fila operacional.',
      actionLabel: 'Mostrar todas',
      resetFilter: true,
    };
  }

  return {
    title: 'Nenhuma conversa disponível neste filtro',
    description: 'Amplie o recorte operacional para voltar a enxergar a fila completa.',
    actionLabel: 'Mostrar todas',
    resetFilter: true,
  };
};

const OperationalEmptyStateRow = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="mx-auto my-4 max-w-3xl rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-5 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="text-left">
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
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClasses}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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

const formatOperationalSyncTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR');
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




/* __AUTOATENDE_C4B1_HUMAN_QUEUE_MATURITY__ */
const getQueueOwnerId = (state = {}) =>
  state?.assigned_user_id ||
  state?.assigned_agent_id ||
  state?.owner_user_id ||
  null;

const buildAttendanceQueueMetrics = (rows = [], states = {}, currentUserId = null) => {
  const items = Array.isArray(rows) ? rows : [];

  return items.reduce(
    (acc, item) => {
      const state = states?.[item?.contact] || { mode: 'bot' };
      const isHuman = String(state?.mode || 'bot').toLowerCase() === 'human';
      const ownerId = getQueueOwnerId(state);
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

const buildOrderedAttendanceRows = ({
  conversations = [],
  states = {},
  currentUserId = null,
  queueFilter = 'human',
  queueSearch = '',
}) => {
  const items = Array.isArray(conversations) ? [...conversations] : [];
  const needle = String(queueSearch || '').trim().toLowerCase();

  const filtered = items.filter((item) => {
    const state = states?.[item?.contact] || { mode: 'bot' };
    const isHuman = String(state?.mode || 'bot').toLowerCase() === 'human';
    const ownerId = getQueueOwnerId(state);
    const isMine = Boolean(ownerId && currentUserId && ownerId === currentUserId);
    const isUnassigned = isHuman && !ownerId;

    const matchesFilter =
      queueFilter === 'all' ? true :
      queueFilter === 'human' ? isHuman :
      queueFilter === 'mine' ? isMine :
      queueFilter === 'unassigned' ? isUnassigned :
      queueFilter === 'bot' ? !isHuman :
      true;

    if (!matchesFilter) return false;

    if (!needle) return true;

    const haystack = [
      item?.contact,
      item?.conversationId,
      item?.raw?.contact_name,
      item?.raw?.contact_number,
      item?.raw?.last_message_preview,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });

  filtered.sort((left, right) => {
    const leftState = states?.[left?.contact] || { mode: 'bot' };
    const rightState = states?.[right?.contact] || { mode: 'bot' };

    const leftHuman = String(leftState?.mode || 'bot').toLowerCase() === 'human';
    const rightHuman = String(rightState?.mode || 'bot').toLowerCase() === 'human';

    const leftOwner = getQueueOwnerId(leftState);
    const rightOwner = getQueueOwnerId(rightState);

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

    return 0;
  });

  return filtered;
};


/* __AUTOATENDE_C4A2A_FRONT_OWNER_BIND__ */
const sanitizeOwnerPayload = (payload = {}) => {
  const next = { ...(payload || {}) };
  if (
    !next.agent_id ||
    next.agent_id === 'agent_default' ||
    next.agent_id === 'authenticated_user'
  ) {
    delete next.agent_id;
  }
  return next;
};

const resolveOwnerLabel = (conversation) => {
  const raw =
    conversation?.assigned_user?.name ||
    conversation?.assigned_user?.full_name ||
    conversation?.assigned_user?.email ||
    conversation?.owner?.name ||
    conversation?.owner?.email ||
    conversation?.assigned_agent?.name ||
    conversation?.assigned_agent?.email ||
    conversation?.assigned_user_id ||
    conversation?.assigned_agent_id ||
    null;

  if (!raw || raw === 'agent_default' || raw === 'authenticated_user') {
    return 'Você';
  }

  return raw;
};

/* __AUTOATENDE_C3B1_ATTENDANCE_REFRAME__ */
const pickContact = (conversation) => {
  if (!conversation || typeof conversation !== 'object') return null;

  return (
    conversation.contact ||
    conversation.contact_number ||
    conversation.contactNumber ||
    conversation.customer_phone ||
    conversation.customerPhone ||
    conversation.phone ||
    conversation.phone_number ||
    conversation.phoneNumber ||
    conversation.from_number ||
    conversation.from ||
    conversation.wa_id ||
    null
  );
};

const pickConversationId = (conversation) => {
  if (!conversation || typeof conversation !== 'object') return null;

  return (
    conversation.id ||
    conversation.conversation_id ||
    conversation.conversationId ||
    null
  );
};

const buildOptimisticAttendanceState = (targetMode, ownerId = null) => ({
  mode: targetMode === 'bot' ? 'bot' : 'human',
  assigned_agent_id: targetMode === 'bot' ? null : (ownerId || null)
});

const normalizeResolvedAttendanceMode = (value) =>
  String(value || '').trim().toLowerCase() === 'human' ? 'human' : 'bot';

const normalizeAttendanceStatePayload = (payload = {}) => {
  const mode = normalizeResolvedAttendanceMode(payload?.mode);
  const assignedAgentId =
    payload?.assigned_agent_id ??
    payload?.assignedAgentId ??
    payload?.assigned_user_id ??
    payload?.assignedUserId ??
    payload?.owner_user_id ??
    payload?.ownerUserId ??
    payload?.assigned_user?.id ??
    payload?.assignedUser?.id ??
    payload?.assigned_agent?.id ??
    payload?.assignedAgent?.id ??
    null;

  const ownerLabel =
    payload?.owner_label ||
    payload?.ownerLabel ||
    payload?.assigned_user?.name ||
    payload?.assigned_user?.full_name ||
    payload?.assigned_user?.email ||
    payload?.assignedUser?.name ||
    payload?.assignedUser?.full_name ||
    payload?.assignedUser?.email ||
    payload?.assigned_agent?.name ||
    payload?.assigned_agent?.full_name ||
    payload?.assigned_agent?.email ||
    payload?.assignedAgent?.name ||
    payload?.assignedAgent?.full_name ||
    payload?.assignedAgent?.email ||
    payload?.owner?.name ||
    payload?.owner?.full_name ||
    payload?.owner?.email ||
    null;

  return {
    mode,
    assigned_agent_id: assignedAgentId || null,
    owner_label: ownerLabel || null
  };
};

const buildFallbackAttendanceStateFromConversation = (conversation = {}) => {
  if (!conversation || typeof conversation !== 'object') return null;

  const fallback = normalizeAttendanceStatePayload({
    mode:
      conversation?.mode ||
      conversation?.raw?.mode ||
      conversation?.state?.mode ||
      'bot',
    assigned_agent_id:
      conversation?.assigned_agent_id ||
      conversation?.assignedAgentId ||
      conversation?.assigned_user_id ||
      conversation?.assignedUserId ||
      conversation?.owner_user_id ||
      conversation?.ownerUserId ||
      conversation?.assigned_user?.id ||
      conversation?.assignedUser?.id ||
      conversation?.assigned_agent?.id ||
      conversation?.assignedAgent?.id ||
      null,
    owner_label:
      conversation?.owner_label ||
      conversation?.ownerLabel ||
      conversation?.assigned_user?.name ||
      conversation?.assigned_user?.full_name ||
      conversation?.assigned_user?.email ||
      conversation?.assignedUser?.name ||
      conversation?.assignedUser?.full_name ||
      conversation?.assignedUser?.email ||
      conversation?.assigned_agent?.name ||
      conversation?.assigned_agent?.full_name ||
      conversation?.assigned_agent?.email ||
      conversation?.assignedAgent?.name ||
      conversation?.assignedAgent?.full_name ||
      conversation?.assignedAgent?.email ||
      conversation?.owner?.name ||
      conversation?.owner?.full_name ||
      conversation?.owner?.email ||
      null
  });

  if (
    fallback.mode === 'bot' &&
    !fallback.assigned_agent_id &&
    !fallback.owner_label
  ) {
    return { mode: 'bot', assigned_agent_id: null, owner_label: null };
  }

  return fallback;
};

const chooseAttendancePreferredState = (liveState = null, fallbackState = null) => {
  const live = liveState ? normalizeAttendanceStatePayload(liveState) : null;
  const fallback = fallbackState ? normalizeAttendanceStatePayload(fallbackState) : null;

  if (!live) return fallback || { mode: 'bot', assigned_agent_id: null, owner_label: null };
  if (!fallback) return live;

  const liveLooksDefaultBot =
    live.mode === 'bot' &&
    !live.assigned_agent_id &&
    !live.owner_label;

  const fallbackLooksHuman =
    fallback.mode === 'human' ||
    Boolean(fallback.assigned_agent_id) ||
    Boolean(fallback.owner_label);

  if (liveLooksDefaultBot && fallbackLooksHuman) {
    return fallback;
  }

  return live;
};

const buildAttendanceEffectiveStates = (rows = [], liveStates = {}) =>
  (Array.isArray(rows) ? rows : []).reduce((acc, item) => {
    const contact = item?.contact;
    if (!contact) return acc;

    const fallbackState = buildFallbackAttendanceStateFromConversation(item?.raw || {});
    const liveState = liveStates?.[contact] || null;

    acc[contact] = chooseAttendancePreferredState(liveState, fallbackState) || {
      mode: 'bot',
      assigned_agent_id: null,
      owner_label: null
    };

    return acc;
  }, {});


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

/* __AUTOATENDE_ATTENDANCE_CONTACT_AVATAR_V1__ */
function AaR25cR2dContactAvatar({
  contact,
  conversationId,
  accessToken = '',
  version = 0,
  variant = 'default',
}) {
  const fallbackPhotoUrl =
    aaR27cR3SafeContactPhotoUrl(contact);

  const [resolvedPhotoUrl, setResolvedPhotoUrl] =
    useState(fallbackPhotoUrl);

  const [photoFailed, setPhotoFailed] =
    useState(false);

  const initials =
    aaR27cR3ContactAvatarInitials(contact);

  useEffect(() => {
    let active = true;
    let generatedObjectUrl = '';
    const controller = new AbortController();

    setPhotoFailed(false);
    setResolvedPhotoUrl(fallbackPhotoUrl);

    const normalizedConversationId =
      String(conversationId || '').trim();

    const normalizedAccessToken =
      String(accessToken || '').trim();

    if (
      !normalizedConversationId ||
      !normalizedAccessToken
    ) {
      return () => {
        active = false;
        controller.abort();
      };
    }

    const loadPersistentAvatar = async () => {
      try {
        const endpoint =
          `/api/inbox/conversations/` +
          `${encodeURIComponent(normalizedConversationId)}` +
          `/avatar?surface=attendance&v=${encodeURIComponent(version)}`;

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${normalizedAccessToken}`,
          },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (response.status === 404) {
          if (active) {
            setResolvedPhotoUrl(fallbackPhotoUrl);
            setPhotoFailed(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(
            `ATTENDANCE_AVATAR_HTTP_${response.status}`
          );
        }

        const blob = await response.blob();

        if (!blob.type.startsWith('image/')) {
          throw new Error(
            'ATTENDANCE_AVATAR_INVALID_CONTENT_TYPE'
          );
        }

        generatedObjectUrl =
          URL.createObjectURL(blob);

        if (active) {
          setResolvedPhotoUrl(generatedObjectUrl);
          setPhotoFailed(false);
        }
      } catch (error) {
        if (
          error?.name !== 'AbortError' &&
          active
        ) {
          setResolvedPhotoUrl(fallbackPhotoUrl);
          setPhotoFailed(false);
        }
      }
    };

    loadPersistentAvatar();

    return () => {
      active = false;
      controller.abort();

      if (generatedObjectUrl) {
        URL.revokeObjectURL(
          generatedObjectUrl
        );
      }
    };
  }, [
    accessToken,
    conversationId,
    fallbackPhotoUrl,
    version,
  ]);

  const photoUrl =
    photoFailed
      ? ''
      : String(resolvedPhotoUrl || '').trim();

  const className = [
    'aa-r25c-r2d-contact-avatar',
    'aa-r27c-r3-contact-avatar',
    `aa-r25c-r2d-contact-avatar--${variant}`,
    photoUrl
      ? 'aa-r27c-r3-contact-avatar--has-photo'
      : 'aa-r27c-r3-contact-avatar--no-photo',
  ].filter(Boolean).join(' ');

  return (
    <span
      className={className}
      aria-label={
        photoUrl
          ? 'Foto do contato'
          : 'Contato sem foto'
      }
      data-aa-attendance-contact-avatar={
        '__AUTOATENDE_ATTENDANCE_CONTACT_AVATAR_V1__'
      }
    >
      {photoUrl ? (
        <img
          className="aa-r27c-r3-contact-avatar__image"
          src={photoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setPhotoFailed(true);
          }}
        />
      ) : null}

      <span
        className="aa-r27c-r3-contact-avatar__fallback"
        aria-hidden="true"
      >
        <svg
          className="aa-r27c-r3-contact-avatar__icon"
          viewBox="0 0 24 24"
          focusable="false"
          aria-hidden="true"
        >
          <path d="M12 12.2c2.25 0 4.05-1.8 4.05-4.05S14.25 4.1 12 4.1 7.95 5.9 7.95 8.15 9.75 12.2 12 12.2Zm0 1.85c-3.2 0-6.05 1.64-7.67 4.12-.36.55.04 1.28.7 1.28h13.94c.66 0 1.06-.73.7-1.28C18.05 15.69 15.2 14.05 12 14.05Z" />
        </svg>

        {initials ? (
          <span className="aa-r27c-r3-contact-avatar__initials">
            {initials}
          </span>
        ) : null}
      </span>
    </span>
  );
}
/* END __AUTOATENDE_ATTENDANCE_CONTACT_AVATAR_V1__ */


// __AUTOATENDE_V4_R25E_R2B_CONTACT_NAME_ENDPOINT_INLINE_AUTH_ATTENDANCE_UI_PATCH_FIX_PYTHON__
const aaR25eR2bNormalizeNameInput = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// __AUTOATENDE_V4_R26F_REPLACE_PROMPT_WITH_PREMIUM_CONTACT_NAME_MODAL_FRONTEND_ONLY__
const aaR26fOpenContactNameModal = (initialName) => new Promise((resolve) => {
  if (typeof document === 'undefined') {
    resolve(null);
    return;
  }

  const initial = aaR25eR2bNormalizeNameInput(initialName);
  const overlay = document.createElement('div');
  overlay.className = 'aa-r26f-contact-name-modal-overlay';
  overlay.setAttribute('role', 'presentation');

  overlay.innerHTML = `
    <div class="aa-r26f-contact-name-modal" role="dialog" aria-modal="true" aria-labelledby="aa-r26f-contact-name-title">
      <div class="aa-r26f-contact-name-modal__eyebrow">Contato</div>
      <h2 id="aa-r26f-contact-name-title" class="aa-r26f-contact-name-modal__title">Editar nome do contato</h2>
      <p class="aa-r26f-contact-name-modal__copy">Use um nome claro para a equipe identificar esta conversa no atendimento.</p>
      <label class="aa-r26f-contact-name-modal__label" for="aa-r26f-contact-name-input">Nome exibido</label>
      <input id="aa-r26f-contact-name-input" class="aa-r26f-contact-name-modal__input" type="text" maxlength="80" autocomplete="off" />
      <div class="aa-r26f-contact-name-modal__error" aria-live="polite"></div>
      <div class="aa-r26f-contact-name-modal__actions">
        <button type="button" class="aa-r26f-contact-name-modal__button aa-r26f-contact-name-modal__button--ghost" data-action="cancel">Cancelar</button>
        <button type="button" class="aa-r26f-contact-name-modal__button aa-r26f-contact-name-modal__button--primary" data-action="save">Salvar</button>
      </div>
    </div>
  `;

  const input = overlay.querySelector('#aa-r26f-contact-name-input');
  const error = overlay.querySelector('.aa-r26f-contact-name-modal__error');
  const cancelButton = overlay.querySelector('[data-action="cancel"]');
  const saveButton = overlay.querySelector('[data-action="save"]');

  let settled = false;

  const cleanup = (value) => {
    if (settled) return;
    settled = true;
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    resolve(value);
  };

  const setError = (message) => {
    if (error) error.textContent = message || '';
  };

  const submit = () => {
    const nextName = aaR25eR2bNormalizeNameInput(input?.value || '');

    if (!nextName) {
      setError('Informe um nome para o contato.');
      input?.focus();
      return;
    }

    if (nextName.length < 2 || nextName.length > 80) {
      setError('O nome deve ter entre 2 e 80 caracteres.');
      input?.focus();
      return;
    }

    cleanup(nextName);
  };

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanup(null);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) cleanup(null);
  });

  cancelButton?.addEventListener('click', () => cleanup(null));
  saveButton?.addEventListener('click', submit);
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlay);

  if (input) {
    input.value = initial;
    input.focus();
    input.select();
  }
});



const aaR25eR2bGetAccessToken = () => {
  try {
    for (const key of Object.keys(window.localStorage || {})) {
      if (!key.includes('auth-token')) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const token =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token;

      if (token) return token;
    }
  } catch (error) {
    console.warn('[R25E-R2B] Nao foi possivel ler token local para editar contato', error);
  }

  return '';
};

async function aaR25eR2bEditContactName({ conversationId, currentName }) {
  const current = aaR25eR2bNormalizeNameInput(currentName);
  const nextName = aaR25eR2bNormalizeNameInput(
    await aaR26fOpenContactNameModal(current)
  );

  if (!nextName || nextName === current) return;

  if (nextName.length < 2 || nextName.length > 80) {
    window.alert('O nome deve ter entre 2 e 80 caracteres.');
    return;
  }

  const token = aaR25eR2bGetAccessToken();

  try {
    const response = await fetch(`/api/inbox/conversations/${conversationId}/contact-name`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ contact_name: nextName }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      const message =
        payload?.message ||
        payload?.error ||
        'Nao foi possivel atualizar o nome do contato.';
      window.alert(message);
      return;
    }

    window.location.reload();
  } catch (error) {
    console.error('[R25E-R2B] Erro ao editar nome do contato', error);
    window.alert('Nao foi possivel atualizar o nome do contato agora.');
  }
}



// __AUTOATENDE_V4_R25F_B_R1_ATTENDANCE_DISPLAY_CONTACT_NAME_FRONTEND_ONLY_FIXED_DIST_SMOKE__


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

/* __AUTOATENDE_CONTACT_INTERNAL_NOTES_ATTENDANCE_V1__ */
const AA_ATTENDANCE_INTERNAL_NOTE_MARKER =
  '__AUTOATENDE_CONTACT_INTERNAL_NOTES_ATTENDANCE_V1__';

const aaAttendanceNoteEscapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const aaAttendanceNoteInitials = (value) => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.length
    ? parts.map((part) => part.charAt(0)).join('').toUpperCase()
    : 'C';
};

const aaAttendanceNoteReadJson = async (response) =>
  response.json().catch(() => ({}));

const aaAttendanceNoteFormatDate = (value) => {
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

const aaOpenAttendanceInternalNoteModal = ({
  conversationId,
  contact,
  contactDisplayName,
  triggerElement,
}) => {
  if (typeof document === 'undefined') return;

  const previous = document.querySelector(
    '[data-aa-contact-internal-note-attendance-modal]'
  );

  if (previous) {
    previous.querySelector('textarea')?.focus();
    return;
  }

  const id = String(conversationId || '').trim();
  const token = aaR25eR2bGetAccessToken();

  if (!id) {
    window.alert('Não foi possível identificar esta conversa.');
    return;
  }

  if (!token) {
    window.alert('Sua sessão expirou. Entre novamente para continuar.');
    return;
  }

  const name =
    aaR25eR2bNormalizeNameInput(
      contactDisplayName || contact || 'Contato'
    ) || 'Contato';

  const phone = String(contact || '').trim() || 'Telefone não informado';
  const initials = aaAttendanceNoteInitials(name);

  const overlay = document.createElement('div');
  overlay.className = 'aa-attendance-note-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.setAttribute(
    'data-aa-contact-internal-note-attendance-modal',
    AA_ATTENDANCE_INTERNAL_NOTE_MARKER
  );

  overlay.innerHTML = `
    <section
      class="aa-attendance-note-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aa-attendance-note-title"
      aria-describedby="aa-attendance-note-copy"
    >
      <header class="aa-attendance-note-header">
        <div>
          <span class="aa-attendance-note-eyebrow">Atendimento</span>
          <h2 id="aa-attendance-note-title">Observação interna</h2>
          <p id="aa-attendance-note-copy">
            Registre contexto para a equipe. Esta informação nunca é enviada pelo WhatsApp.
          </p>
        </div>

        <button
          type="button"
          class="aa-attendance-note-close"
          data-action="close"
          aria-label="Fechar observação interna"
          title="Fechar"
        >×</button>
      </header>

      <div class="aa-attendance-note-contact">
        <span class="aa-attendance-note-avatar">
          <img alt="" hidden data-role="avatar-image" />
          <span data-role="avatar-fallback">
            ${aaAttendanceNoteEscapeHtml(initials)}
          </span>
        </span>

        <span class="aa-attendance-note-contact-copy">
          <strong>${aaAttendanceNoteEscapeHtml(name)}</strong>
          <small>${aaAttendanceNoteEscapeHtml(phone)}</small>
        </span>

        <span class="aa-attendance-note-private">Privada</span>
      </div>

      <div class="aa-attendance-note-body">
        <div class="aa-attendance-note-loading" data-role="loading" role="status">
          Carregando observação…
        </div>

        <div class="aa-attendance-note-editor" data-role="editor" hidden>
          <label class="aa-attendance-note-label" for="aa-attendance-note-input">
            Contexto da equipe
          </label>

          <textarea
            id="aa-attendance-note-input"
            class="aa-attendance-note-textarea"
            maxlength="4000"
            rows="7"
            placeholder="Ex.: prefere contato pela manhã, solicitou retorno na sexta-feira ou demonstrou interesse no plano intermediário."
          ></textarea>

          <div class="aa-attendance-note-meta">
            <span data-role="state">Sem observação</span>
            <span data-role="counter">0/4.000</span>
          </div>

          <small class="aa-attendance-note-updated" data-role="updated" hidden></small>

          <div
            class="aa-attendance-note-message"
            data-role="message"
            aria-live="polite"
            hidden
          ></div>

          <footer class="aa-attendance-note-actions">
            <button
              type="button"
              class="aa-attendance-note-button aa-attendance-note-button--remove"
              data-action="remove"
              disabled
            >Remover</button>

            <div>
              <button
                type="button"
                class="aa-attendance-note-button aa-attendance-note-button--ghost"
                data-action="restore"
                disabled
              >Desfazer</button>

              <button
                type="button"
                class="aa-attendance-note-button aa-attendance-note-button--primary"
                data-action="save"
                disabled
              >Salvar observação</button>
            </div>
          </footer>
        </div>
      </div>
    </section>
  `;

  const modal = overlay.querySelector('.aa-attendance-note-modal');
  const loading = overlay.querySelector('[data-role="loading"]');
  const editor = overlay.querySelector('[data-role="editor"]');
  const textarea = overlay.querySelector('textarea');
  const stateElement = overlay.querySelector('[data-role="state"]');
  const counterElement = overlay.querySelector('[data-role="counter"]');
  const updatedElement = overlay.querySelector('[data-role="updated"]');
  const messageElement = overlay.querySelector('[data-role="message"]');
  const closeButton = overlay.querySelector('[data-action="close"]');
  const saveButton = overlay.querySelector('[data-action="save"]');
  const restoreButton = overlay.querySelector('[data-action="restore"]');
  const removeButton = overlay.querySelector('[data-action="remove"]');
  const avatarImage = overlay.querySelector('[data-role="avatar-image"]');
  const avatarFallback = overlay.querySelector('[data-role="avatar-fallback"]');

  const previousOverflow = document.body.style.overflow;
  const endpoint =
    `/api/inbox/conversations/${encodeURIComponent(id)}/internal-note`;
  const avatarEndpoint =
    `/api/inbox/conversations/${encodeURIComponent(id)}/avatar`;

  let closed = false;
  let busy = '';
  let savedContent = '';
  let noteRecord = null;
  let requestSequence = 0;
  let activeController = null;
  let avatarController = null;
  let avatarObjectUrl = '';
  const internalNoteSyncSource =
    aaCreateContactInternalNoteSyncSource();
  let unsubscribeInternalNoteSync =
    () => {};

  const currentContent = () => String(textarea?.value || '').trim();
  const characterCount = () => Array.from(String(textarea?.value || '')).length;
  const exists = () => Boolean(noteRecord?.id || savedContent);
  const dirty = () => currentContent() !== savedContent;
  const mutationBusy = () => busy === 'saving' || busy === 'deleting';

  const setMessage = (message = '', kind = '') => {
    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = [
      'aa-attendance-note-message',
      kind ? `aa-attendance-note-message--${kind}` : '',
    ].filter(Boolean).join(' ');
    messageElement.hidden = !message;
  };

  const render = () => {
    const length = characterCount();
    const changed = dirty();
    const hasNote = exists();

    if (stateElement) {
      stateElement.textContent = changed
        ? 'Alterações não salvas'
        : hasNote
          ? 'Observação salva'
          : 'Sem observação';

      stateElement.classList.toggle('is-dirty', changed);
    }

    if (counterElement) {
      counterElement.textContent =
        `${length.toLocaleString('pt-BR')}/4.000`;

      counterElement.classList.toggle('is-warning', length >= 3600);
    }

    if (updatedElement) {
      const date = aaAttendanceNoteFormatDate(noteRecord?.updated_at);
      updatedElement.textContent = date
        ? `Última atualização: ${date}`
        : '';
      updatedElement.hidden = !date;
    }

    if (textarea) textarea.disabled = Boolean(busy);
    if (closeButton) closeButton.disabled = mutationBusy();

    if (restoreButton) {
      restoreButton.disabled = !changed || Boolean(busy);
    }

    if (removeButton) {
      removeButton.disabled = !hasNote || Boolean(busy);
      removeButton.textContent =
        busy === 'deleting' ? 'Removendo…' : 'Remover';
    }

    if (saveButton) {
      saveButton.disabled =
        !changed ||
        !currentContent() ||
        length > 4000 ||
        Boolean(busy);

      saveButton.textContent =
        busy === 'saving'
          ? 'Salvando…'
          : hasNote
            ? 'Salvar alterações'
            : 'Salvar observação';
    }
  };

  const setBusy = (next = '') => {
    busy = next;
    render();
  };

  const abortActive = () => {
    activeController?.abort();
    activeController = null;
  };

  const request = async (method, body = undefined, timeoutMs = 20000) => {
    abortActive();

    const controller = new AbortController();
    activeController = controller;
    const requestId = ++requestSequence;
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const payload = await aaAttendanceNoteReadJson(response);

      return {
        response,
        payload,
        requestId,
        controller,
      };
    } finally {
      window.clearTimeout(timeout);

      if (activeController === controller) {
        activeController = null;
      }
    }
  };

  const isCurrent = (result) =>
    Boolean(
      result &&
      !closed &&
      result.requestId === requestSequence &&
      !result.controller.signal.aborted
    );

  const showEditor = () => {
    if (loading) loading.hidden = true;
    if (editor) editor.hidden = false;
  };

  const loadAvatar = async () => {
    avatarController?.abort();
    avatarController = new AbortController();

    try {
      const response = await fetch(avatarEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: avatarController.signal,
      });

      if (!response.ok || closed) return;

      const blob = await response.blob();

      if (!blob?.size || closed || !avatarImage) return;

      avatarObjectUrl = URL.createObjectURL(blob);
      avatarImage.src = avatarObjectUrl;
      avatarImage.hidden = false;

      if (avatarFallback) avatarFallback.hidden = true;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn(
          '[CONTACT_INTERNAL_NOTE_ATTENDANCE] avatar load failed',
          error
        );
      }
    }
  };

  const load = async () => {
    setBusy('loading');
    setMessage('');

    try {
      const result = await request('GET', undefined, 15000);

      if (!result.response.ok) {
        throw new Error(
          result.payload?.message ||
          result.payload?.error ||
          `Falha ao carregar a observação (${result.response.status}).`
        );
      }

      if (!isCurrent(result)) return;

      noteRecord = result.payload?.note || null;
      savedContent = String(noteRecord?.content || '');

      if (textarea) textarea.value = savedContent;
      showEditor();
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!closed) {
          setMessage(
            'A solicitação demorou mais que o esperado. Tente novamente.',
            'error'
          );
          showEditor();
        }
        return;
      }

      if (!closed) {
        setMessage(
          error?.message ||
          'Não foi possível carregar a observação interna.',
          'error'
        );
        showEditor();
      }
    } finally {
      if (!closed) {
        setBusy('');
        render();
        window.setTimeout(() => textarea?.focus(), 30);
      }
    }
  };

  const save = async () => {
    if (busy) return;

    const content = currentContent();
    const length = Array.from(content).length;

    if (!content) {
      setMessage('Digite uma observação antes de salvar.', 'error');
      textarea?.focus();
      return;
    }

    if (length > 4000) {
      setMessage(
        'A observação deve ter no máximo 4.000 caracteres.',
        'error'
      );
      textarea?.focus();
      return;
    }

    setBusy('saving');
    setMessage('');

    try {
      const result = await request('PUT', { content });

      if (!result.response.ok) {
        throw new Error(
          result.payload?.message ||
          result.payload?.error ||
          `Falha ao salvar a observação (${result.response.status}).`
        );
      }

      if (!isCurrent(result)) return;

      noteRecord = result.payload?.note || { content };
      savedContent = String(noteRecord?.content || content);

      if (textarea) textarea.value = savedContent;

      aaPublishContactInternalNoteSync({
        conversationId: id,
        action: 'upsert',
        updatedAt:
          noteRecord?.updated_at ||
          noteRecord?.updatedAt ||
          null,
        source:
          internalNoteSyncSource,
      });

      setMessage(
        result.payload?.created
          ? 'Observação interna criada com sucesso.'
          : 'Observação interna atualizada com sucesso.',
        'success'
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!closed) {
          setMessage(
            'A solicitação demorou mais que o esperado. Confirme o conteúdo antes de tentar novamente.',
            'error'
          );
        }
        return;
      }

      if (!closed) {
        setMessage(
          error?.message ||
          'Não foi possível salvar a observação interna.',
          'error'
        );
      }
    } finally {
      if (!closed) {
        setBusy('');
        render();
      }
    }
  };

  const remove = async () => {
    if (busy || !exists()) return;

    const confirmed = window.confirm(
      dirty()
        ? 'Remover a observação salva e descartar as alterações não salvas?'
        : 'Remover a observação interna deste contato?'
    );

    if (!confirmed) return;

    setBusy('deleting');
    setMessage('');

    try {
      const result = await request('DELETE');

      if (!result.response.ok) {
        throw new Error(
          result.payload?.message ||
          result.payload?.error ||
          `Falha ao remover a observação (${result.response.status}).`
        );
      }

      if (!isCurrent(result)) return;

      noteRecord = null;
      savedContent = '';

      if (textarea) textarea.value = '';

      aaPublishContactInternalNoteSync({
        conversationId: id,
        action: 'remove',
        updatedAt: null,
        source:
          internalNoteSyncSource,
      });

      setMessage(
        result.payload?.note_removed
          ? 'Observação interna removida.'
          : 'Este contato já estava sem observação.',
        'success'
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!closed) {
          setMessage(
            'A solicitação demorou mais que o esperado. Confirme o estado antes de tentar novamente.',
            'error'
          );
        }
        return;
      }

      if (!closed) {
        setMessage(
          error?.message ||
          'Não foi possível remover a observação interna.',
          'error'
        );
      }
    } finally {
      if (!closed) {
        setBusy('');
        render();
      }
    }
  };

  const restore = () => {
    if (busy) return;

    if (textarea) textarea.value = savedContent;
    setMessage('');
    render();
    textarea?.focus();
  };

  const close = ({ force = false } = {}) => {
    if (closed) return;
    if (!force && mutationBusy()) return;

    if (
      !force &&
      dirty() &&
      !window.confirm(
        'Descartar as alterações não salvas da observação interna?'
      )
    ) {
      textarea?.focus();
      return;
    }

    closed = true;
    abortActive();
    avatarController?.abort();

    try {
      unsubscribeInternalNoteSync?.();
    } catch (_) {}

    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = previousOverflow;

    if (avatarObjectUrl) {
      URL.revokeObjectURL(avatarObjectUrl);
    }

    overlay.remove();
    triggerElement?.focus?.();
  };

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      save();
      return;
    }

    if (event.key !== 'Tab' || !modal) return;

    const focusable = Array.from(
      modal.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), select:not([disabled])'
      )
    ).filter((element) => !element.hidden);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  closeButton?.addEventListener('click', () => close());
  saveButton?.addEventListener('click', save);
  restoreButton?.addEventListener('click', restore);
  removeButton?.addEventListener('click', remove);

  textarea?.addEventListener('input', () => {
    setMessage('');
    render();
  });

  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  unsubscribeInternalNoteSync =
    aaSubscribeContactInternalNoteSync(
      (payload) => {
        if (
          closed ||
          payload?.conversationId !== id ||
          payload?.source ===
            internalNoteSyncSource
        ) {
          return;
        }

        if (
          mutationBusy() ||
          dirty()
        ) {
          setMessage(
            'A observação foi alterada em outra tela. Suas alterações locais foram preservadas; feche e reabra o modal para carregar a versão mais recente.',
            'error'
          );
          render();
          return;
        }

        setMessage('');
        load();
      }
    );

  render();
  loadAvatar();
  load();
};
/* END __AUTOATENDE_CONTACT_INTERNAL_NOTES_ATTENDANCE_V1__ */


const aaR25fB1FirstText = (...values) => {
  for (const value of values) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
};

const aaR25fB1AttendanceDisplayName = (raw, fallbackContact) => aaR25fB1FirstText(
  raw?.contact_name,
  raw?.contactName,
  raw?.profile_name,
  raw?.profileName,
  raw?.display_name,
  raw?.displayName,
  raw?.customer_name,
  raw?.customerName,
  raw?.name,
  fallbackContact
);


/* __AUTOATENDE_CONTACT_FOLLOWUP_ATTENDANCE_V1__ */
const AA_ATTENDANCE_FOLLOWUP_MARKER =
  '__AUTOATENDE_CONTACT_FOLLOWUP_ATTENDANCE_V1__';

const aaAttendanceFollowupExtract = (payload) => {
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
};

const aaAttendanceFollowupIsoToLocalInput = (value) => {
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
};

const aaAttendanceFollowupLocalInputToIso = (value) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const aaAttendanceFollowupResolveStatus = (followup) => {
  if (
    !followup ||
    String(followup?.status || 'pending') !== 'pending'
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
};

const aaOpenAttendanceFollowupModal = ({
  conversationId,
  contact,
  contactDisplayName,
  triggerElement,
}) => {
  if (typeof document === 'undefined') return;

  const previous = document.querySelector(
    '[data-aa-contact-followup-attendance-modal]'
  );

  if (previous) {
    previous
      .querySelector('input[type="datetime-local"]')
      ?.focus();
    return;
  }

  const id = String(conversationId || '').trim();
  const token = aaR25eR2bGetAccessToken();

  if (!id) {
    window.alert('Não foi possível identificar esta conversa.');
    return;
  }

  if (!token) {
    window.alert('Sua sessão expirou. Entre novamente para continuar.');
    return;
  }

  const name =
    aaR25eR2bNormalizeNameInput(
      contactDisplayName || contact || 'Contato'
    ) || 'Contato';

  const phone =
    String(contact || '').trim() ||
    'Telefone não informado';

  const initials = aaAttendanceNoteInitials(name);

  const overlay = document.createElement('div');
  overlay.className =
    'aa-attendance-note-overlay aa-attendance-followup-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.setAttribute(
    'data-aa-contact-followup-attendance-modal',
    AA_ATTENDANCE_FOLLOWUP_MARKER
  );

  overlay.innerHTML = `
    <section
      class="aa-attendance-note-modal aa-attendance-followup-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aa-attendance-followup-title"
      aria-describedby="aa-attendance-followup-copy"
    >
      <header class="aa-attendance-note-header">
        <div>
          <span class="aa-attendance-note-eyebrow">Atendimento</span>
          <h2 id="aa-attendance-followup-title">Retorno programado</h2>
          <p id="aa-attendance-followup-copy">
            Organize o próximo contato com data, horário e contexto. Nenhuma mensagem é enviada automaticamente.
          </p>
        </div>

        <button
          type="button"
          class="aa-attendance-note-close"
          data-action="close"
          aria-label="Fechar retorno programado"
          title="Fechar"
        >×</button>
      </header>

      <div class="aa-attendance-note-contact">
        <span class="aa-attendance-note-avatar">
          <img alt="" hidden data-role="avatar-image" />
          <span data-role="avatar-fallback">
            ${aaAttendanceNoteEscapeHtml(initials)}
          </span>
        </span>

        <span class="aa-attendance-note-contact-copy">
          <strong>${aaAttendanceNoteEscapeHtml(name)}</strong>
          <small>${aaAttendanceNoteEscapeHtml(phone)}</small>
        </span>

        <span
          class="aa-attendance-followup-status aa-attendance-followup-status--none"
          data-role="status"
        >Sem retorno</span>
      </div>

      <div class="aa-attendance-note-body">
        <div
          class="aa-attendance-followup-loading"
          data-role="loading"
          role="status"
        >
          Carregando retorno…
        </div>

        <div
          class="aa-attendance-followup-editor"
          data-role="editor"
          hidden
        >
          <label
            class="aa-attendance-note-label"
            for="aa-attendance-followup-due-at"
          >
            Data e horário
          </label>

          <input
            id="aa-attendance-followup-due-at"
            class="aa-attendance-followup-datetime"
            type="datetime-local"
            data-role="due-at"
            required
          />

          <label
            class="aa-attendance-note-label"
            for="aa-attendance-followup-summary"
          >
            Contexto do retorno <span>Opcional</span>
          </label>

          <textarea
            id="aa-attendance-followup-summary"
            class="aa-attendance-followup-summary"
            maxlength="500"
            rows="4"
            data-role="summary"
            placeholder="Ex.: confirmar quantidade, retomar proposta ou verificar aprovação do responsável."
          ></textarea>

          <div class="aa-attendance-note-meta">
            <span data-role="state">Sem retorno programado</span>
            <span data-role="counter">0/500</span>
          </div>

          <small
            class="aa-attendance-followup-scheduled"
            data-role="scheduled"
            hidden
          ></small>

          <div
            class="aa-attendance-note-message"
            data-role="message"
            aria-live="polite"
            hidden
          ></div>

          <footer class="aa-attendance-note-actions aa-attendance-followup-actions">
            <button
              type="button"
              class="aa-attendance-note-button aa-attendance-note-button--remove"
              data-action="cancel"
              disabled
            >Cancelar retorno</button>

            <div>
              <button
                type="button"
                class="aa-attendance-note-button aa-attendance-note-button--ghost"
                data-action="restore"
                disabled
              >Desfazer</button>

              <button
                type="button"
                class="aa-attendance-note-button aa-attendance-followup-button--complete"
                data-action="complete"
                disabled
              >Concluir</button>

              <button
                type="button"
                class="aa-attendance-note-button aa-attendance-note-button--primary"
                data-action="save"
                disabled
              >Programar retorno</button>
            </div>
          </footer>
        </div>
      </div>
    </section>
  `;

  const modal = overlay.querySelector(
    '.aa-attendance-followup-modal'
  );
  const loading = overlay.querySelector(
    '[data-role="loading"]'
  );
  const editor = overlay.querySelector(
    '[data-role="editor"]'
  );
  const dueAtInput = overlay.querySelector(
    '[data-role="due-at"]'
  );
  const summaryInput = overlay.querySelector(
    '[data-role="summary"]'
  );
  const stateElement = overlay.querySelector(
    '[data-role="state"]'
  );
  const counterElement = overlay.querySelector(
    '[data-role="counter"]'
  );
  const scheduledElement = overlay.querySelector(
    '[data-role="scheduled"]'
  );
  const statusElement = overlay.querySelector(
    '[data-role="status"]'
  );
  const messageElement = overlay.querySelector(
    '[data-role="message"]'
  );
  const closeButton = overlay.querySelector(
    '[data-action="close"]'
  );
  const saveButton = overlay.querySelector(
    '[data-action="save"]'
  );
  const restoreButton = overlay.querySelector(
    '[data-action="restore"]'
  );
  const cancelButton = overlay.querySelector(
    '[data-action="cancel"]'
  );
  const completeButton = overlay.querySelector(
    '[data-action="complete"]'
  );
  const avatarImage = overlay.querySelector(
    '[data-role="avatar-image"]'
  );
  const avatarFallback = overlay.querySelector(
    '[data-role="avatar-fallback"]'
  );

  const previousOverflow =
    document.body.style.overflow;
  const endpoint =
    `/api/inbox/conversations/${encodeURIComponent(id)}/followup`;
  const avatarEndpoint =
    `/api/inbox/conversations/${encodeURIComponent(id)}/avatar`;

  let closed = false;
  let busy = '';
  let savedDueAt = '';
  let savedSummary = '';
  let followupRecord = null;
  let requestSequence = 0;
  let activeController = null;
  let avatarController = null;
  let avatarObjectUrl = '';

  const currentDueAt = () =>
    String(dueAtInput?.value || '').trim();

  const currentSummary = () =>
    String(summaryInput?.value || '').trim();

  const summaryLength = () =>
    Array.from(String(summaryInput?.value || '')).length;

  const exists = () =>
    Boolean(
      followupRecord?.id &&
      String(followupRecord?.status || 'pending') ===
        'pending'
    );

  const dirty = () =>
    currentDueAt() !== savedDueAt ||
    currentSummary() !== savedSummary;

  const mutationBusy = () =>
    ['saving', 'canceling', 'completing'].includes(busy);

  const setMessage = (message = '', kind = '') => {
    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = [
      'aa-attendance-note-message',
      kind
        ? `aa-attendance-note-message--${kind}`
        : '',
    ].filter(Boolean).join(' ');
    messageElement.hidden = !message;
  };

  const render = () => {
    const length = summaryLength();
    const changed = dirty();
    const hasFollowup = exists();
    const visualStatus =
      aaAttendanceFollowupResolveStatus(
        followupRecord
      );

    if (stateElement) {
      stateElement.textContent = changed
        ? 'Alterações não salvas'
        : hasFollowup
          ? 'Retorno salvo'
          : 'Sem retorno programado';

      stateElement.classList.toggle(
        'is-dirty',
        changed
      );
    }

    if (counterElement) {
      counterElement.textContent =
        `${length.toLocaleString('pt-BR')}/500`;

      counterElement.classList.toggle(
        'is-warning',
        length >= 450
      );
    }

    if (statusElement) {
      statusElement.textContent =
        visualStatus.label;
      statusElement.className =
        `aa-attendance-followup-status aa-attendance-followup-status--${visualStatus.key}`;
    }

    if (scheduledElement) {
      const date =
        aaAttendanceNoteFormatDate(
          followupRecord?.due_at
        );

      scheduledElement.textContent = date
        ? `Agendado para: ${date}`
        : '';
      scheduledElement.hidden = !date;
    }

    if (dueAtInput) {
      dueAtInput.disabled = Boolean(busy);
    }

    if (summaryInput) {
      summaryInput.disabled = Boolean(busy);
    }

    if (closeButton) {
      closeButton.disabled = mutationBusy();
    }

    if (restoreButton) {
      restoreButton.disabled =
        !changed || Boolean(busy);
    }

    if (cancelButton) {
      cancelButton.disabled =
        !hasFollowup || Boolean(busy);
      cancelButton.textContent =
        busy === 'canceling'
          ? 'Cancelando…'
          : 'Cancelar retorno';
    }

    if (completeButton) {
      completeButton.disabled =
        !hasFollowup || Boolean(busy);
      completeButton.textContent =
        busy === 'completing'
          ? 'Concluindo…'
          : 'Concluir';
    }

    if (saveButton) {
      saveButton.disabled =
        !changed ||
        !currentDueAt() ||
        length > 500 ||
        Boolean(busy);

      saveButton.textContent =
        busy === 'saving'
          ? 'Salvando…'
          : hasFollowup
            ? 'Salvar alterações'
            : 'Programar retorno';
    }
  };

  const setBusy = (next = '') => {
    busy = next;
    render();
  };

  const abortActive = () => {
    activeController?.abort();
    activeController = null;
  };

  const request = async (
    method,
    body = undefined,
    suffix = '',
    timeoutMs = 20000
  ) => {
    abortActive();

    const controller = new AbortController();
    activeController = controller;
    const requestId = ++requestSequence;
    const timeout = window.setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      const response = await fetch(
        `${endpoint}${suffix}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body
              ? {
                  'Content-Type':
                    'application/json',
                }
              : {}),
          },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
          ...(body
            ? {
                body: JSON.stringify(body),
              }
            : {}),
        }
      );

      const payload =
        await aaAttendanceNoteReadJson(response);

      return {
        response,
        payload,
        requestId,
        controller,
      };
    } finally {
      window.clearTimeout(timeout);

      if (activeController === controller) {
        activeController = null;
      }
    }
  };

  const isCurrent = (result) =>
    Boolean(
      result &&
      !closed &&
      result.requestId === requestSequence &&
      !result.controller.signal.aborted
    );

  const showEditor = () => {
    if (loading) loading.hidden = true;
    if (editor) editor.hidden = false;
  };

  const setFromFollowup = (followup) => {
    followupRecord = followup;

    const localDueAt =
      aaAttendanceFollowupIsoToLocalInput(
        followup?.due_at
      );
    const summary =
      String(followup?.summary || '');

    savedDueAt = localDueAt;
    savedSummary = summary;

    if (dueAtInput) {
      dueAtInput.value = localDueAt;
    }

    if (summaryInput) {
      summaryInput.value = summary;
    }
  };

  const clearFollowup = () => {
    followupRecord = null;
    savedDueAt = '';
    savedSummary = '';

    if (dueAtInput) dueAtInput.value = '';
    if (summaryInput) summaryInput.value = '';
  };

  const loadAvatar = async () => {
    avatarController?.abort();
    avatarController = new AbortController();

    try {
      const response = await fetch(
        avatarEndpoint,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: avatarController.signal,
        }
      );

      if (
        !response.ok ||
        closed
      ) {
        return;
      }

      const blob = await response.blob();

      if (
        !blob?.size ||
        closed ||
        !avatarImage
      ) {
        return;
      }

      avatarObjectUrl =
        URL.createObjectURL(blob);
      avatarImage.src = avatarObjectUrl;
      avatarImage.hidden = false;

      if (avatarFallback) {
        avatarFallback.hidden = true;
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn(
          '[CONTACT_FOLLOWUP_ATTENDANCE] avatar load failed',
          error
        );
      }
    }
  };

  const load = async () => {
    setBusy('loading');
    setMessage('');

    try {
      const result =
        await request('GET', undefined, '', 15000);

      if (!result.response.ok) {
        throw new Error(
          result.payload?.message ||
          result.payload?.error ||
          `Falha ao carregar o retorno (${result.response.status}).`
        );
      }

      if (!isCurrent(result)) return;

      setFromFollowup(
        aaAttendanceFollowupExtract(
          result.payload
        )
      );
      showEditor();
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!closed) {
          setMessage(
            'A solicitação demorou mais que o esperado. Tente novamente.',
            'error'
          );
          showEditor();
        }
        return;
      }

      if (!closed) {
        clearFollowup();
        setMessage(
          error?.message ||
          'Não foi possível carregar o retorno programado.',
          'error'
        );
        showEditor();
      }
    } finally {
      if (!closed) {
        setBusy('');
        render();
        window.setTimeout(
          () => dueAtInput?.focus(),
          30
        );
      }
    }
  };

  const save = async () => {
    if (busy) return;

    const dueAtIso =
      aaAttendanceFollowupLocalInputToIso(
        currentDueAt()
      );
    const summary = currentSummary();
    const length =
      Array.from(summary).length;

    if (!dueAtIso) {
      setMessage(
        'Informe uma data e um horário válidos para o retorno.',
        'error'
      );
      dueAtInput?.focus();
      return;
    }

    if (length > 500) {
      setMessage(
        'O contexto do retorno deve ter no máximo 500 caracteres.',
        'error'
      );
      summaryInput?.focus();
      return;
    }

    setBusy('saving');
    setMessage('');

    try {
      const result = await request(
        'PUT',
        {
          due_at: dueAtIso,
          summary,
        }
      );

      if (!result.response.ok) {
        throw new Error(
          result.payload?.message ||
          result.payload?.error ||
          `Falha ao salvar o retorno (${result.response.status}).`
        );
      }

      if (!isCurrent(result)) return;

      const followup =
        aaAttendanceFollowupExtract(
          result.payload
        );

      if (!followup?.id) {
        throw new Error(
          'A API não retornou o registro do retorno salvo.'
        );
      }

      setFromFollowup(followup);
      setMessage(
        result.payload?.created
          ? 'Retorno programado com sucesso.'
          : 'Retorno atualizado com sucesso.',
        'success'
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!closed) {
          setMessage(
            'A solicitação demorou mais que o esperado. Confirme o conteúdo antes de tentar novamente.',
            'error'
          );
        }
        return;
      }

      if (!closed) {
        setMessage(
          error?.message ||
          'Não foi possível salvar o retorno programado.',
          'error'
        );
      }
    } finally {
      if (!closed) {
        setBusy('');
        render();
      }
    }
  };

  const cancel = async () => {
    if (busy || !exists()) return;

    const confirmed = window.confirm(
      dirty()
        ? 'Cancelar este retorno? As alterações não salvas também serão descartadas.'
        : 'Cancelar este retorno programado? O histórico será preservado.'
    );

    if (!confirmed) return;

    setBusy('canceling');
    setMessage('');

    try {
      const result =
        await request('DELETE');

      if (!result.response.ok) {
        throw new Error(
          result.payload?.message ||
          result.payload?.error ||
          `Falha ao cancelar o retorno (${result.response.status}).`
        );
      }

      if (!isCurrent(result)) return;

      clearFollowup();
      setMessage(
        result.payload?.canceled === false
          ? 'Este contato já estava sem retorno pendente.'
          : 'Retorno cancelado. O histórico foi preservado.',
        'success'
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!closed) {
          setMessage(
            'A solicitação demorou mais que o esperado. Confirme o estado antes de tentar novamente.',
            'error'
          );
        }
        return;
      }

      if (!closed) {
        setMessage(
          error?.message ||
          'Não foi possível cancelar o retorno programado.',
          'error'
        );
      }
    } finally {
      if (!closed) {
        setBusy('');
        render();
      }
    }
  };

  const complete = async () => {
    if (busy || !exists()) return;

    const confirmed = window.confirm(
      dirty()
        ? 'Concluir este retorno? As alterações não salvas também serão descartadas.'
        : 'Marcar este retorno como concluído? O histórico será preservado.'
    );

    if (!confirmed) return;

    setBusy('completing');
    setMessage('');

    try {
      const result = await request(
        'POST',
        undefined,
        '/complete'
      );

      if (!result.response.ok) {
        throw new Error(
          result.payload?.message ||
          result.payload?.error ||
          `Falha ao concluir o retorno (${result.response.status}).`
        );
      }

      if (!isCurrent(result)) return;

      clearFollowup();
      setMessage(
        result.payload?.completed === false
          ? 'Este contato já estava sem retorno pendente.'
          : 'Retorno concluído. O histórico foi preservado.',
        'success'
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (!closed) {
          setMessage(
            'A solicitação demorou mais que o esperado. Confirme o estado antes de tentar novamente.',
            'error'
          );
        }
        return;
      }

      if (!closed) {
        setMessage(
          error?.message ||
          'Não foi possível concluir o retorno programado.',
          'error'
        );
      }
    } finally {
      if (!closed) {
        setBusy('');
        render();
      }
    }
  };

  const restore = () => {
    if (busy) return;

    if (dueAtInput) {
      dueAtInput.value = savedDueAt;
    }

    if (summaryInput) {
      summaryInput.value = savedSummary;
    }

    setMessage('');
    render();
    dueAtInput?.focus();
  };

  const close = ({ force = false } = {}) => {
    if (closed) return;
    if (!force && mutationBusy()) return;

    if (
      !force &&
      dirty() &&
      !window.confirm(
        'Descartar as alterações não salvas do retorno programado?'
      )
    ) {
      dueAtInput?.focus();
      return;
    }

    closed = true;
    abortActive();
    avatarController?.abort();

    document.removeEventListener(
      'keydown',
      onKeyDown
    );
    window.removeEventListener(
      'beforeunload',
      onBeforeUnload
    );
    document.body.style.overflow =
      previousOverflow;

    if (avatarObjectUrl) {
      URL.revokeObjectURL(
        avatarObjectUrl
      );
    }

    overlay.remove();
    triggerElement?.focus?.();
  };

  function onBeforeUnload(event) {
    if (!dirty()) return;

    event.preventDefault();
    event.returnValue = '';
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      save();
      return;
    }

    if (event.key !== 'Tab' || !modal) {
      return;
    }

    const focusable = Array.from(
      modal.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], select:not([disabled])'
      )
    ).filter((element) => !element.hidden);

    if (!focusable.length) return;

    const first = focusable[0];
    const last =
      focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  overlay.addEventListener(
    'click',
    (event) => {
      if (event.target === overlay) {
        close();
      }
    }
  );

  closeButton?.addEventListener(
    'click',
    () => close()
  );
  saveButton?.addEventListener(
    'click',
    save
  );
  restoreButton?.addEventListener(
    'click',
    restore
  );
  cancelButton?.addEventListener(
    'click',
    cancel
  );
  completeButton?.addEventListener(
    'click',
    complete
  );

  dueAtInput?.addEventListener(
    'input',
    () => {
      setMessage('');
      render();
    }
  );

  summaryInput?.addEventListener(
    'input',
    () => {
      setMessage('');
      render();
    }
  );

  document.addEventListener(
    'keydown',
    onKeyDown
  );
  window.addEventListener(
    'beforeunload',
    onBeforeUnload
  );
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  render();
  loadAvatar();
  load();
};
/* END __AUTOATENDE_CONTACT_FOLLOWUP_ATTENDANCE_V1__ */

const Attendance = () => {

  /* __AUTOATENDE_C7F_R1_REFRESH_HARDENING__ */
  const __aaC7fR1SafeSetQueueSourceRows = (...args) => {
    try {
      if (typeof setQueueSourceRows === 'function') {
        return setQueueSourceRows(...args);
      }
    } catch (_) {}
    return undefined;
  };


  const { session } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState({});

  const [avatarSyncVersions, setAvatarSyncVersions] =
    useState({});

  useEffect(() => {
    return aaSubscribeContactAvatarSync(
      (payload) => {
        setAvatarSyncVersions(
          (current) => {
            if (
              current?.[payload.conversationId] ===
              payload.version
            ) {
              return current;
            }

            return {
              ...current,
              [payload.conversationId]:
                payload.version,
            };
          }
        );
      }
    );
  }, []);

  

  const [agentDirectory, setAgentDirectory] = useState({});
  const [queueFilter, setQueueFilter] = useState('human');
  const [queueSearch, setQueueSearch] = useState('');
  const [surfaceError, setSurfaceError] = useState('');
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState('');
  const [pendingActions, setPendingActions] = useState({}); /* __AUTOATENDE_C7E_R3_FRONTEND_PENDING_ACTION_GUARD_FIX__ */

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
        console.warn('Failed to load attendance agent directory', error);
      }
    })();
  }, [session?.access_token]);
const headers = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const fetchContactsAndStates = async () => {
    if (!session?.access_token) return;

    try {
      if (!queueSourceRows?.length) setLoading(true);
      setSurfaceError('');

      const resConv = await fetch('/api/inbox/conversations', { headers });
      const convPayload = await resConv.json();

      if (!resConv.ok) {
        throw new Error(convPayload?.error || 'Falha ao carregar conversas.');
      }

      const conversations = Array.isArray(convPayload?.data)
        ? convPayload.data
        : Array.isArray(convPayload)
          ? convPayload
          : [];

      const mappedRows = conversations
        .map((conversation) => {
          const contact = pickContact(conversation);
          const conversationId = pickConversationId(conversation);

          if (!contact) return null;

          return {
            contact,
            conversationId,
            raw: conversation
          };
        })
        .filter(Boolean);

      setRows(mappedRows);

      const statesMap = mappedRows.reduce((acc, { contact, raw }) => {
        if (!contact) return acc;
        acc[contact] =
          buildFallbackAttendanceStateFromConversation(raw) || {
            mode: 'bot',
            assigned_agent_id: null,
            owner_label: null
          };
        return acc;
      }, {});

      /* __AUTOATENDE_C7E_R3_FRONTEND_STATE_FANOUT_REMOVAL_R2__
         Fan-out inicial de /api/attendance/state desabilitado.
         A lista /api/inbox/conversations já chega com overlay autoritativo.
      */
      if (false) await Promise.all(
        mappedRows.map(async ({ contact }) => {
          try {
            const resState = await fetch(
              `/api/attendance/state?contact=${encodeURIComponent(contact)}`,
              { headers }
            );
            const dataState = await resState.json().catch(() => ({}));

            if (resState.ok) {
              const candidate =
                dataState?.success && dataState?.data
                  ? dataState.data
                  : dataState?.data && typeof dataState.data === 'object'
                    ? dataState.data
                    : dataState && typeof dataState === 'object' && dataState?.mode
                      ? dataState
                      : null;

              if (candidate) {
                statesMap[contact] = chooseAttendancePreferredState(
                  normalizeAttendanceStatePayload(candidate),
                  statesMap[contact]
                );
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch state for ${contact}`, e);
          }
        })
      );

      setStates(statesMap);
      setLastSuccessfulSyncAt(new Date().toISOString());


      setLastSuccessfulSyncAt(new Date().toISOString());
    } catch (error) {
      console.error('Error loading attendance:', error);
      setSurfaceError(buildOperationalSurfaceErrorMessage(error, 'Não foi possível carregar a fila humana agora.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactsAndStates();
  }, [session?.access_token]);

  
  const currentUserId = session?.user?.id || null;

  const queueSourceRows =
    typeof rows !== 'undefined'
      ? rows
      : typeof conversations !== 'undefined'
        ? conversations
        : [];

  const effectiveStates = useMemo(
    () => buildAttendanceEffectiveStates(queueSourceRows, states),
    [queueSourceRows, states]
  );


  const queueMetrics = useMemo(
    () => buildAttendanceQueueMetrics(queueSourceRows, effectiveStates, currentUserId),
    [queueSourceRows, effectiveStates, currentUserId]
  );

  /* __AUTOATENDE_C8B_R2E_AGENT_PANEL_MEMO__ */
  const operationalAgentPanel = useMemo(() => {
    const items = Array.isArray(queueSourceRows) ? queueSourceRows : [];
    const rosterMap = new Map();

    let assigned = 0;
    let mine = 0;
    let unassigned = 0;

    const firstDefined = (...values) => {
      for (const value of values) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        return value;
      }
      return null;
    };

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const contact = item?.contact;
      const fallbackState =
        buildFallbackAttendanceStateFromConversation(item?.raw || {}) || {
          mode: 'bot',
          assigned_agent_id: null,
          owner_label: null
        };

      const state = (contact && effectiveStates?.[contact]) ? effectiveStates[contact] : fallbackState;
      const mode = String(state?.mode || 'bot').trim().toLowerCase();
      const isHuman = mode === 'human';

      if (!isHuman) continue;

      const ownerId = firstDefined(
        state?.assigned_user_id,
        state?.assigned_agent_id,
        state?.owner_user_id
      );

      const ownerLabel =
        firstDefined(
          state?.owner_label,
          ownerId ? agentDirectory?.[ownerId]?.name : null,
          ownerId ? agentDirectory?.[ownerId]?.email : null
        ) || (ownerId && currentUserId && ownerId === currentUserId ? 'Você' : null);

      if (ownerId) {
        assigned += 1;
        if (currentUserId && ownerId === currentUserId) mine += 1;

        const existing = rosterMap.get(ownerId) || {
          owner_id: ownerId,
          owner_name: ownerId === currentUserId ? 'Você' : (ownerLabel || 'Agente'),
          conversation_count: 0,
          human_count: 0,
          is_me: Boolean(currentUserId && ownerId === currentUserId)
        };

        existing.conversation_count += 1;
        existing.human_count += 1;
        if (!existing.owner_name && ownerLabel) {
          existing.owner_name = ownerLabel;
        }

        rosterMap.set(ownerId, existing);
      } else {
        unassigned += 1;
      }
    }

    const roster = Array.from(rosterMap.values()).sort((a, b) => {
      if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
      if ((b.conversation_count || 0) !== (a.conversation_count || 0)) {
        return (b.conversation_count || 0) - (a.conversation_count || 0);
      }
      return String(a.owner_name || '').localeCompare(String(b.owner_name || ''));
    });

    return {
      assigned,
      mine,
      unassigned,
      activeAgents: roster.length,
      roster
    };
  }, [queueSourceRows, effectiveStates, currentUserId, agentDirectory]);

  const orderedConversations = useMemo(
    () =>
      buildOrderedAttendanceRows({
        conversations: queueSourceRows,
        states: effectiveStates,
        currentUserId,
        queueFilter,
        queueSearch,
      }),
    [queueSourceRows, effectiveStates, currentUserId, queueFilter, queueSearch]
  );


  const attendanceEmptyState = useMemo(
    () => buildAttendanceEmptyState(queueFilter, queueSourceRows.length),
    [queueFilter, queueSourceRows.length]
  );
const handleTransfer = async (contact, mode, agentId = null) => {
    if (!contact) return;
    if (pendingActions?.[contact]) return;

    const normalizedAgentId = mode === 'bot' ? null : (agentId || null);
    const optimisticOwnerId = mode === 'bot' ? null : (normalizedAgentId || currentUserId || null);
    const optimisticState = buildOptimisticAttendanceState(mode, optimisticOwnerId);

    setPendingActions((prev) => ({
      ...prev,
      [contact]: true
    }));

    try {
      setSurfaceError('');

      const endpoint =
        mode === 'bot'
          ? '/api/attendance/return/bot'
          : normalizedAgentId
            ? '/api/attendance/transfer/agent'
            : '/api/attendance/transfer/human';

      const body = {
        contact,
        ...(normalizedAgentId && { agent_id: normalizedAgentId })
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      });

      const response = await res.json().catch(() => null);
      const errorMessage = String(response?.error || response?.message || '').trim();
      const isRateLimitNoise = /too many requests/i.test(errorMessage);

      if (!res.ok && !isRateLimitNoise) {
        setSurfaceError(errorMessage || 'Não foi possível concluir a operação agora.');
      }

      setStates((prev) => ({
        ...prev,
        [contact]: optimisticState
      }));

      __aaC7fR1SafeSetQueueSourceRows((prev) =>
        Array.isArray(prev)
          ? prev.map((item) => {
              if (item?.contact !== contact) return item;

              return {
                ...item,
                mode,
                assigned_agent_id: optimisticOwnerId,
                owner_label:
                  mode === 'bot'
                    ? null
                    : resolveFriendlyOwnerLabel(
                        { mode: 'human', assigned_agent_id: optimisticOwnerId },
                        agentDirectory,
                        session
                      ),
                raw: {
                  ...(item?.raw || {}),
                  mode,
                  assigned_agent_id: optimisticOwnerId,
                  assignedAgentId: optimisticOwnerId,
                  assigned_user_id: optimisticOwnerId,
                  assignedUserId: optimisticOwnerId
                }
              };
            })
          : prev
      );

      setLastSuccessfulSyncAt(new Date().toISOString());

      try {
        await fetchContactsAndStates();
      } catch (syncError) {
        console.warn('Attendance post-action queue refresh warning', syncError);
      }
    } catch (e) {
      console.error(e);
      try {
        await fetchContactsAndStates();
      } catch (refreshError) {
        console.warn('Attendance fallback refresh warning', refreshError);
      }
      setSurfaceError('A ação foi enviada. Caso a fila não reflita imediatamente, use Atualizar operação.');
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[contact];
        return next;
      });
    }
  }; /* __AUTOATENDE_C7E_R4D_ATTENDANCE_SAFE_HANDLE_TRANSFER__ */

  if (loading) {
    return <div className="p-10 text-center">Carregando atendimentos...</div>;
  }

  return (
    <div data-aa-page="attendance" className="aa-attendance-surface aa-premium-empty-surface flex flex-col gap-6">

      <section className="aa-footer-hero aa-attendance-footer-hero--legacy order-last" data-aa-marker="__AUTOATENDE_C7E_R4D_ATTENDANCE_FOOTER_HERO__">
        <div className="aa-footer-hero-eyebrow">Operação comercial e atendimento</div>
        <div className="aa-footer-hero-row" style={{ display: 'none' }}>
          {false && (
<div className="aa-footer-hero-copy">
            <h2 className="aa-footer-hero-title">Operação humana</h2>
            <p className="aa-footer-hero-subtitle">Fila operacional com leitura mais limpa, menos ruído visual no topo e transição mais clara entre BOT e atendimento humano.</p>
          </div>
)}
          {false && (
<div className="aa-footer-hero-chips">
            <span className="aa-footer-hero-chip">Fila sincronizada</span>
            <span className="aa-footer-hero-chip">Contexto preservado</span>
            <span className="aa-footer-hero-chip">Operação premium</span>
          </div>
)}
        </div>
      </section>

<div className="aa-ops-workspace aa-attendance-workspace">
      <div className="aa-attendance-topbar aa-attendance-topbar--compact flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Atendimento</h2>
          <p className="aa-ops-section-support text-gray-500">Acompanhamento e handover humano</p>

        <div className="aa-attendance-advisory aa-attendance-advisory--compact aa-premium-surface mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span className="aa-ops-section-advisory">Use o Inbox como central de resposta.</span>
          e handover rápido entre Assistente IA e Humano.
        </div>
        </div>
        <button type="button"
          onClick={fetchContactsAndStates}
          className="aa-attendance-refresh-btn p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

          {(surfaceError || lastSuccessfulSyncAt) ? (
            <div className="mb-4 space-y-3" style={{ display: 'none' }}>
              {surfaceError ? (
                <OperationalSurfaceBanner
                  tone="error"
                  title="Fila humana com atenção"
                  description={surfaceError}
                  actionLabel="Recarregar fila"
                  onAction={fetchContactsAndStates}
                />
              ) : null}

              {!surfaceError && lastSuccessfulSyncAt ? (
                <OperationalSurfaceBanner
                  tone="success"
                  title="Fila sincronizada"
                  description={`Última sincronização estável: ${formatOperationalSyncTime(lastSuccessfulSyncAt)}`}
                />
              ) : null}
            </div>
          ) : null}

          <div className="aa-attendance-kpi-grid aa-attendance-kpi-grid--compact mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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


          {/* __AUTOATENDE_C8B_R2E_AGENT_PANEL_UI__ */}
          <div className="aa-attendance-admin-panel aa-attendance-admin-panel--supportive mb-4 rounded-2xl border border-emerald-200/20 bg-white/5 p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Gestão administrativa de agentes
                </div>
                {false && (
<div className="mt-1 text-lg font-bold text-white" style={{ display: 'none' }}>
                  Ownership operacional em tempo real
                </div>
)}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200/20 px-3 py-1 text-xs text-emerald-100">
                  Atribuídas {operationalAgentPanel.assigned}
                </span>
                <span className="rounded-full border border-emerald-200/20 px-3 py-1 text-xs text-emerald-100">
                  Minhas {operationalAgentPanel.mine}
                </span>
                <span className="rounded-full border border-emerald-200/20 px-3 py-1 text-xs text-emerald-100">
                  Sem responsável {operationalAgentPanel.unassigned}
                </span>
                <span className="rounded-full border border-emerald-200/20 px-3 py-1 text-xs text-emerald-100">
                  Agentes ativos {operationalAgentPanel.activeAgents}
                </span>
              </div>
            </div>

            {operationalAgentPanel.roster.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {operationalAgentPanel.roster.slice(0, 6).map((agent) => (
                  <div
                    key={agent.owner_id}
                    className="rounded-xl border border-emerald-200/15 bg-black/10 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">
                        {agent.owner_name || 'Agente'}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300">
                        {agent.is_me ? 'você' : 'agente'}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-emerald-100/90">
                      <span>Total {agent.conversation_count || 0}</span>
                      <span>Humano {agent.human_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-emerald-100/80">
                Ainda não há conversas humanas atribuídas a agentes nesta visualização.
              </div>
            )}
          </div>

          <div className="aa-attendance-toolbar aa-attendance-toolbar--compact mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
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

            <div className="aa-attendance-search-wrap w-full xl:max-w-sm">
              <input
                type="text"
                value={queueSearch}
                onChange={(event) => setQueueSearch(event.target.value)}
                placeholder="Buscar contato, telefone ou conversa"
                className="aa-attendance-searchbox w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          
          <div className="aa-attendance-filter-strip aa-attendance-filter-strip--compact mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Filtro ativo · {getAttendanceFilterLabel(queueFilter)}
            </p>
          </div>

          <div className="aa-attendance-table-shell aa-attendance-table-shell--dominant aa-premium-surface bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="aa-attendance-table aa-attendance-table--dominant aa-premium-ops-table min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contato
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Conversa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Modo Atual
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Agente
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="aa-attendance-table-body bg-white divide-y divide-gray-200">
            {orderedConversations.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-6 text-center text-gray-500">
                    <OperationalEmptyStateRow
                      title={attendanceEmptyState.title}
                      description={attendanceEmptyState.description}
                      actionLabel={attendanceEmptyState.actionLabel}
                      onAction={() => {
                        if (attendanceEmptyState.resetFilter) {
                          setQueueFilter('all');
                          return;
                        }
                        fetchContactsAndStates();
                      }}
                    />
                  </td>
              </tr>
            ) : (
              orderedConversations.map(({ contact, conversationId, raw }) => {
                const state =
                  effectiveStates[contact] ||
                  buildFallbackAttendanceStateFromConversation(raw) || {
                    mode: 'bot',
                    assigned_agent_id: null,
                    owner_label: null
                  };
                const isHuman = state.mode === 'human';
                          const contactDisplayName = aaR25fB1AttendanceDisplayName(raw, contact);

                return (
                  <tr key={`${conversationId || 'no-id'}:${contact}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <div className="aa-r25c-r2d-contact-cell aa-r25c-r2d-contact-cell--attendance">
                                <AaR25cR2dContactAvatar
                                  contact={{ ...(raw || {}), contact, contact_phone: contact, contact_number: contact }}
                                  conversationId={conversationId}
                                  accessToken={session?.access_token || ''}
                                  version={avatarSyncVersions?.[conversationId] || 0}
                                  variant="attendance-list"
                                />
                                <div className="aa-r25c-r2d-contact-cell-main">
                                  <div className="aa-r25e-r2b-contact-name-row">
                                    <span className="aa-r25c-r2d-contact-cell-name aa-r25f-b1-contact-display-name">{contactDisplayName}</span>
                                    <button
                                      type="button"
                                      className="aa-r25e-r2b-edit-contact-name"
                                      title="Editar nome do contato"
                                      aria-label="Editar nome do contato"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        aaR25eR2bEditContactName({ conversationId, currentName: contactDisplayName });
                                      }}
                                    >
                                      Editar
                                    </button>

                                    <button
                                      type="button"
                                      className="aa-attendance-note-trigger"
                                      title="Abrir observação interna"
                                      aria-label={`Abrir observação interna de ${contactDisplayName}`}
                                      disabled={!conversationId}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();

                                        aaOpenAttendanceInternalNoteModal({
                                          conversationId,
                                          contact,
                                          contactDisplayName,
                                          triggerElement: event.currentTarget,
                                        });
                                      }}
                                    >
                                      Observação
                                    </button>

                                    <button
                                      type="button"
                                      className="aa-attendance-followup-trigger"
                                      title="Abrir retorno programado"
                                      aria-label={`Abrir retorno programado de ${contactDisplayName}`}
                                      data-aa-contact-followup-attendance-trigger
                                      disabled={!conversationId}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();

                                        aaOpenAttendanceFollowupModal({
                                          conversationId,
                                          contact,
                                          contactDisplayName,
                                          triggerElement: event.currentTarget,
                                        });
                                      }}
                                    >
                                      Retorno
                                    </button>
                                  </div>
                                  {aaR15a5AttendanceLabelChip(raw)}
                                </div>
                              </div>
                            </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {conversationId || 'Sem ID'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isHuman ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {isHuman ? <User className="w-3 h-3 mr-1" /> : <Bot className="w-3 h-3 mr-1" />}
                        {String(state.mode || 'bot').toUpperCase()}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {resolveFriendlyOwnerLabel(state, agentDirectory, session)}
                    </td>

                    <td className="aa-attendance-action-cell px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isHuman ? (
                        <button type="button"
                          
                          disabled={Boolean(pendingActions[contact])}
                          onClick={() => handleTransfer(contact, 'bot')}
                          className={`text-indigo-600 hover:text-indigo-900 inline-flex items-center ${pendingActions[contact] ? 'opacity-60 pointer-events-none' : ''}`}
                        >
                          <Bot className="w-4 h-4 mr-1" /> Retornar ao Bot
                        </button>
                      ) : (
                        <button type="button"
                          
                          disabled={Boolean(pendingActions[contact])}
                          onClick={() => handleTransfer(contact, 'human', currentUserId || null)}
                          className={`text-indigo-600 hover:text-indigo-900 inline-flex items-center ${pendingActions[contact] ? 'opacity-60 pointer-events-none' : ''}`}
                        >
                          <User className="w-4 h-4 mr-1" /> Assumir no humano
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
};

export default Attendance;
