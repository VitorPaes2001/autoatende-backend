const express = require('express');
const inboxController = require('../controllers/inbox.controller');
const inboxService = require('../services/inbox.service');
const supabase = require('../config/supabase');

const router = express.Router();

function resolveCompanyId(req) {
  return (
    req.user?.company_id ||
    req.user?.companyId ||
    req.company_id ||
    req.companyId ||
    null
  );
}

/* __AUTOATENDE_C7E_R2C_INBOX_READ_AUTHORITY_PROJECTION__ */
function aaNormalizeConversationContactRead(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) return digits;

  return raw;
}

function aaCollectConversationContactsRead(node, bucket = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) aaCollectConversationContactsRead(item, bucket);
    return bucket;
  }

  if (!node || typeof node !== 'object') return bucket;

  const contact = aaNormalizeConversationContactRead(
    node.contact ??
    node.contact_phone ??
    node.contactPhone ??
    node.phone ??
    node.phone_number ??
    node.phoneNumber ??
    node.customer_phone ??
    node.customerPhone ??
    node.chat_id ??
    node.chatId ??
    node.remoteJid ??
    node.remote_jid ??
    node.contact_number
  );

  if (contact) bucket.add(contact);

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      aaCollectConversationContactsRead(value, bucket);
    }
  }

  return bucket;
}

async function aaFetchConversationStatesIndexRead(companyId, contacts = []) {
  const normalizedContacts = Array.from(new Set(
    (contacts || [])
      .map((value) => aaNormalizeConversationContactRead(value))
      .filter(Boolean)
  ));

  if (!companyId || normalizedContacts.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('conversation_states')
    .select('contact, mode, assigned_agent_id, labels, updated_at')
    .eq('company_id', companyId)
    .in('contact', normalizedContacts);

  if (error) {
    console.error('[C7E_R2C] error_fetching_conversation_states_for_inbox_projection', error);
    return {};
  }

  const index = {};
  for (const row of data || []) {
    const contact = aaNormalizeConversationContactRead(row?.contact);
    if (!contact) continue;

    index[contact] = {
      contact,
      mode: row?.mode === 'human' ? 'human' : 'bot',
      assigned_agent_id: row?.assigned_agent_id ?? null,
      labels: Array.isArray(row?.labels) ? row.labels : [],
      updated_at: row?.updated_at || null
    };
  }

  return index;
}

function aaApplyConversationStateProjectionRead(node, stateIndex = {}) {
  if (Array.isArray(node)) {
    return node.map((item) => aaApplyConversationStateProjectionRead(item, stateIndex));
  }

  if (!node || typeof node !== 'object') {
    return node;
  }

  const cloned = { ...node };

  const contact = aaNormalizeConversationContactRead(
    cloned.contact ??
    cloned.contact_phone ??
    cloned.contactPhone ??
    cloned.phone ??
    cloned.phone_number ??
    cloned.phoneNumber ??
    cloned.customer_phone ??
    cloned.customerPhone ??
    cloned.chat_id ??
    cloned.chatId ??
    cloned.remoteJid ??
    cloned.remote_jid ??
    cloned.contact_number
  );

  if (contact && stateIndex[contact]) {
    const state = stateIndex[contact];
    const assignedId = state.assigned_agent_id ?? null;

    cloned.mode = state.mode;
    cloned.assigned_agent_id = assignedId;
    cloned.labels = Array.isArray(state.labels) ? state.labels : [];
    cloned.assigned_user_id = assignedId;
    cloned.owner_id = assignedId;
    cloned.ownerId = assignedId;
    cloned.agent_id = assignedId;
    cloned.agentId = assignedId;
    cloned.user_id = assignedId;
    cloned.userId = assignedId;
    cloned.is_human = state.mode === 'human';
    cloned.is_bot = state.mode !== 'human';
    cloned.is_unassigned = state.mode === 'human' && !assignedId;
  }

  for (const [key, value] of Object.entries(cloned)) {
    if (value && typeof value === 'object') {
      cloned[key] = aaApplyConversationStateProjectionRead(value, stateIndex);
    }
  }

  return cloned;
}

function aaInstallInboxOperationalStateProjectionRead(req, res, next) {
  if (res.__aaInboxOperationalStateProjectionInstalled) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = async function patchedJson(body) {
    try {
      const companyId = resolveCompanyId(req);
      const contacts = Array.from(aaCollectConversationContactsRead(body, new Set()));
      const stateIndex = await aaFetchConversationStatesIndexRead(companyId, contacts);
      const projected = aaApplyConversationStateProjectionRead(body, stateIndex);
      const aliased = aaApplyOwnerAliasesRead(projected);
      return originalJson(aliased);
    } catch (error) {
      console.error('[C7E_R2C] inbox_operational_state_projection_failed', error);
      return originalJson(aaApplyOwnerAliasesRead(body));
    }
  };

  res.__aaInboxOperationalStateProjectionInstalled = true;
  next();
}

router.use(aaInstallInboxOperationalStateProjectionRead);

// __AUTOATENDE_C8A_R2_OWNER_READ_PROJECTION__
function aaFirstDefinedRead(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return null;
}

function aaApplyOwnerAliasesRead(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;

  const keys = Object.keys(node);
  const ownerishKeys = new Set([
    'assigned_user_id',
    'assigned_user_name',
    'assignedAgentId',
    'assignedAgentName',
    'assigned_agent_id',
    'assigned_agent_name',
    'ownerId',
    'owner_id',
    'ownerName',
    'owner_name',
    'agentId',
    'agent_id',
    'agentName',
    'agent_name',
    'userId',
    'user_id',
    'userName',
    'user_name',
    'responsible_user_id',
    'responsible_user_name',
    'responsavel_id',
    'responsavel_nome'
  ]);

  const looksConversationLike =
    'contact' in node ||
    'contact_phone' in node ||
    'phone' in node ||
    'phone_number' in node ||
    'chat_id' in node ||
    'conversation_contact' in node ||
    'current_mode' in node ||
    'mode' in node ||
    'status' in node ||
    keys.some((k) => ownerishKeys.has(k));

  if (!looksConversationLike) return node;

  const ownerId = aaFirstDefinedRead(
    node.assigned_user_id,
    node.assignedAgentId,
    node.assigned_agent_id,
    node.ownerId,
    node.owner_id,
    node.agentId,
    node.agent_id,
    node.userId,
    node.user_id,
    node.responsible_user_id,
    node.responsavel_id
  );

  const ownerName = aaFirstDefinedRead(
    node.assigned_user_name,
    node.assignedAgentName,
    node.assigned_agent_name,
    node.ownerName,
    node.owner_name,
    node.agentName,
    node.agent_name,
    node.userName,
    node.user_name,
    node.responsible_user_name,
    node.responsavel_nome
  );

  node.assigned_user_id = ownerId;
  node.assignedAgentId = ownerId;
  node.assigned_agent_id = ownerId;
  node.ownerId = ownerId;
  node.owner_id = ownerId;
  node.agentId = ownerId;
  node.agent_id = ownerId;
  node.userId = ownerId;
  node.user_id = ownerId;
  node.responsible_user_id = ownerId;
  node.responsavel_id = ownerId;
  node.resolved_owner_id = ownerId;

  node.assigned_user_name = ownerName;
  node.assignedAgentName = ownerName;
  node.assigned_agent_name = ownerName;
  node.ownerName = ownerName;
  node.owner_name = ownerName;
  node.agentName = ownerName;
  node.agent_name = ownerName;
  node.userName = ownerName;
  node.user_name = ownerName;
  node.responsible_user_name = ownerName;
  node.responsavel_nome = ownerName;
  node.resolved_owner_name = ownerName;

  return node;
}

function aaNormalizeOwnerPayloadRead(payload, seen = new WeakSet()) {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object') return payload;
  if (seen.has(payload)) return payload;
  seen.add(payload);

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] = aaNormalizeOwnerPayloadRead(payload[i], seen);
    }
    return payload;
  }

  aaApplyOwnerAliasesRead(payload);

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value && typeof value === 'object') {
      payload[key] = aaNormalizeOwnerPayloadRead(value, seen);
    }
  }

  return payload;
}

function responseOwnerProjectionMiddleware(scope) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const originalJson = res.json.bind(res);

    res.json = (payload) => {
      try {
        const normalized = aaNormalizeOwnerPayloadRead(payload);
        return originalJson(normalized);
      } catch (error) {
        console.error('[C8A_R2_OWNER_READ_PROJECTION][ERROR]', 'scope=' + scope, error?.message || error);
        return originalJson(payload);
      }
    };

    return next();
  };
}

// __AUTOATENDE_C8A_R4_OWNER_FLAGS_PROJECTION__
function aaFirstDefinedOwnerFlags(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return null;
}

function aaResolveCurrentUserIdOwnerFlags(req) {
  return aaFirstDefinedOwnerFlags(
    req?.user?.id,
    req?.user?.user_id,
    req?.user?.userId,
    req?.auth?.id,
    req?.auth?.user_id,
    req?.auth?.userId
  );
}

function aaApplyOwnerFlagsProjection(node, currentUserId) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;

  const ownerId = aaFirstDefinedOwnerFlags(
    node.resolved_owner_id,
    node.assigned_user_id,
    node.assignedAgentId,
    node.assigned_agent_id,
    node.ownerId,
    node.owner_id,
    node.agentId,
    node.agent_id,
    node.userId,
    node.user_id,
    node.responsible_user_id,
    node.responsavel_id
  );

  const ownerName = aaFirstDefinedOwnerFlags(
    node.resolved_owner_name,
    node.assigned_user_name,
    node.assignedAgentName,
    node.assigned_agent_name,
    node.ownerName,
    node.owner_name,
    node.agentName,
    node.agent_name,
    node.userName,
    node.user_name,
    node.responsible_user_name,
    node.responsavel_nome
  );

  const looksConversationLike =
    'contact' in node ||
    'contact_phone' in node ||
    'phone' in node ||
    'phone_number' in node ||
    'chat_id' in node ||
    'conversation_contact' in node ||
    'current_mode' in node ||
    'mode' in node ||
    'status' in node ||
    ownerId !== null ||
    ownerName !== null;

  if (!looksConversationLike) return node;

  const normalizedOwnerId = ownerId === null ? null : String(ownerId).trim();
  const normalizedOwnerName = ownerName === null ? null : String(ownerName).trim();
  const normalizedCurrentUserId = currentUserId === null ? null : String(currentUserId).trim();

  const hasOwner = normalizedOwnerId !== null && normalizedOwnerId !== '';
  const isAssignedToMe = hasOwner && normalizedCurrentUserId !== null && normalizedOwnerId === normalizedCurrentUserId;
  const isUnassigned = !hasOwner;
  const ownerScope = isAssignedToMe ? 'mine' : (hasOwner ? 'assigned' : 'unassigned');

  node.resolved_owner_id = hasOwner ? normalizedOwnerId : null;
  node.resolved_owner_name = normalizedOwnerName;
  node.has_owner = hasOwner;
  node.is_unassigned = isUnassigned;
  node.is_assigned_to_me = isAssignedToMe;
  node.owner_scope = ownerScope;

  return node;
}

function aaNormalizeOwnerFlagsPayload(payload, currentUserId, seen = new WeakSet()) {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== 'object') return payload;
  if (seen.has(payload)) return payload;
  seen.add(payload);

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] = aaNormalizeOwnerFlagsPayload(payload[i], currentUserId, seen);
    }
    return payload;
  }

  aaApplyOwnerFlagsProjection(payload, currentUserId);

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value && typeof value === 'object') {
      payload[key] = aaNormalizeOwnerFlagsPayload(value, currentUserId, seen);
    }
  }

  return payload;
}

function responseOwnerFlagsProjectionMiddleware(scope) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const originalJson = res.json.bind(res);

    res.json = (payload) => {
      try {
        const currentUserId = aaResolveCurrentUserIdOwnerFlags(req);
        const normalized = aaNormalizeOwnerFlagsPayload(payload, currentUserId);
        return originalJson(normalized);
      } catch (error) {
        console.error('[C8A_R4_OWNER_FLAGS][ERROR]', 'scope=' + scope, error?.message || error);
        return originalJson(payload);
      }
    };

    return next();
  };
}

// __AUTOATENDE_C8B_R1_OPERATIONAL_AGENT_ROSTER_PROJECTION__
function aaFirstDefinedOperationalRoster(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return null;
}

function aaResolveCurrentUserIdOperationalRoster(req) {
  return aaFirstDefinedOperationalRoster(
    req?.user?.id,
    req?.user?.user_id,
    req?.user?.userId,
    req?.auth?.id,
    req?.auth?.user_id,
    req?.auth?.userId
  );
}

function aaLooksConversationLikeOperationalRoster(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;

  return (
    'contact' in node ||
    'contact_phone' in node ||
    'phone' in node ||
    'phone_number' in node ||
    'chat_id' in node ||
    'conversation_contact' in node ||
    'current_mode' in node ||
    'mode' in node ||
    'status' in node ||
    'resolved_owner_id' in node ||
    'assigned_user_id' in node ||
    'assignedAgentId' in node ||
    'assigned_agent_id' in node ||
    'ownerId' in node ||
    'owner_id' in node ||
    'agentId' in node ||
    'agent_id' in node ||
    'userId' in node ||
    'user_id' in node
  );
}

function aaResolveConversationModeOperationalRoster(node) {
  const rawMode = aaFirstDefinedOperationalRoster(
    node.current_mode,
    node.mode,
    node.conversation_mode,
    node.attendance_mode,
    node.status
  );

  if (rawMode === null) return null;
  const mode = String(rawMode).trim().toLowerCase();

  if (mode.includes('human') || mode.includes('humano')) return 'human';
  if (mode.includes('bot')) return 'bot';
  return mode;
}

function aaResolveOwnerIdOperationalRoster(node) {
  const ownerId = aaFirstDefinedOperationalRoster(
    node.resolved_owner_id,
    node.assigned_user_id,
    node.assignedAgentId,
    node.assigned_agent_id,
    node.ownerId,
    node.owner_id,
    node.agentId,
    node.agent_id,
    node.userId,
    node.user_id,
    node.responsible_user_id,
    node.responsavel_id
  );
  return ownerId === null ? null : String(ownerId).trim();
}

function aaResolveOwnerNameOperationalRoster(node) {
  const ownerName = aaFirstDefinedOperationalRoster(
    node.resolved_owner_name,
    node.assigned_user_name,
    node.assignedAgentName,
    node.assigned_agent_name,
    node.ownerName,
    node.owner_name,
    node.agentName,
    node.agent_name,
    node.userName,
    node.user_name,
    node.responsible_user_name,
    node.responsavel_nome
  );
  return ownerName === null ? null : String(ownerName).trim();
}

function aaCollectConversationNodesOperationalRoster(payload, bucket, seen = new WeakSet()) {
  if (payload === null || payload === undefined) return;
  if (typeof payload !== 'object') return;
  if (seen.has(payload)) return;
  seen.add(payload);

  if (Array.isArray(payload)) {
    for (const item of payload) {
      aaCollectConversationNodesOperationalRoster(item, bucket, seen);
    }
    return;
  }

  if (aaLooksConversationLikeOperationalRoster(payload)) {
    bucket.push(payload);
  }

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value && typeof value === 'object') {
      aaCollectConversationNodesOperationalRoster(value, bucket, seen);
    }
  }
}

function aaBuildOperationalRosterProjection(payload, currentUserId) {
  const conversations = [];
  aaCollectConversationNodesOperationalRoster(payload, conversations);

  const normalizedCurrentUserId = currentUserId === null || currentUserId === undefined
    ? null
    : String(currentUserId).trim();

  const ownerMap = new Map();

  let totalConversations = 0;
  let humanConversations = 0;
  let botConversations = 0;
  let assignedConversations = 0;
  let unassignedConversations = 0;
  let mineConversations = 0;

  for (const conversation of conversations) {
    totalConversations += 1;

    const ownerId = aaResolveOwnerIdOperationalRoster(conversation);
    const ownerName = aaResolveOwnerNameOperationalRoster(conversation);
    const mode = aaResolveConversationModeOperationalRoster(conversation);

    if (mode === 'human') humanConversations += 1;
    if (mode === 'bot') botConversations += 1;

    const hasOwner = ownerId !== null && ownerId !== '';
    const isMine = hasOwner && normalizedCurrentUserId !== null && ownerId === normalizedCurrentUserId;

    if (hasOwner) assignedConversations += 1;
    else unassignedConversations += 1;

    if (isMine) mineConversations += 1;

    if (hasOwner) {
      const existing = ownerMap.get(ownerId) || {
        owner_id: ownerId,
        owner_name: ownerName,
        conversation_count: 0,
        human_count: 0,
        bot_count: 0,
        is_me: false
      };

      existing.conversation_count += 1;
      if (mode === 'human') existing.human_count += 1;
      if (mode === 'bot') existing.bot_count += 1;
      if (!existing.owner_name && ownerName) existing.owner_name = ownerName;
      if (isMine) existing.is_me = true;

      ownerMap.set(ownerId, existing);
    }
  }

  const roster = Array.from(ownerMap.values()).sort((a, b) => {
    if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
    if (b.conversation_count !== a.conversation_count) return b.conversation_count - a.conversation_count;
    return String(a.owner_name || '').localeCompare(String(b.owner_name || ''));
  });

  return {
    has_operational_agent_roster: true,
    operational_ownership_summary: {
      total_conversations: totalConversations,
      human_conversations: humanConversations,
      bot_conversations: botConversations,
      assigned_conversations: assignedConversations,
      unassigned_conversations: unassignedConversations,
      my_conversations: mineConversations,
      unique_owner_count: roster.length
    },
    operational_agent_roster: roster
  };
}

function responseOperationalRosterProjectionMiddleware(scope) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const originalJson = res.json.bind(res);

    res.json = (payload) => {
      try {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          return originalJson(payload);
        }

        const currentUserId = aaResolveCurrentUserIdOperationalRoster(req);
        const projection = aaBuildOperationalRosterProjection(payload, currentUserId);

        payload.has_operational_agent_roster = projection.has_operational_agent_roster;
        payload.operational_ownership_summary = projection.operational_ownership_summary;
        payload.operational_agent_roster = projection.operational_agent_roster;

        return originalJson(payload);
      } catch (error) {
        console.error('[C8B_R1_OPERATIONAL_ROSTER][ERROR]', 'scope=' + scope, error?.message || error);
        return originalJson(payload);
      }
    };

    return next();
  };
}





router.use(responseOwnerProjectionMiddleware('inbox'));

router.use(responseOwnerFlagsProjectionMiddleware('inbox'));

router.use(responseOperationalRosterProjectionMiddleware('inbox'));



router.get('/conversations', inboxController.getConversations);
router.get('/conversations/:id/messages', inboxController.getMessages);

router.get('/summary', async (req, res) => {
  try {
    const companyId =
      req.user?.company_id ||
      req.user?.companyId ||
      req.companyId ||
      req.query?.companyId ||
      null;

    if (!companyId) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHORIZED_COMPANY_CONTEXT_MISSING'
      });
    }

    const rows = await inboxService.listConversations(companyId, '');
    const conversations = Array.isArray(rows) ? rows : [];

    let total_count = 0;
    let open_count = 0;
    let human_count = 0;
    let bot_count = 0;
    let human_assigned_count = 0;
    let human_unassigned_count = 0;

    for (const row of conversations) {
      total_count += 1;

      const rawMode = String(row?.mode || '').trim().toLowerCase();
      const mode = rawMode === 'human' ? 'human' : 'bot';

      const assignedId =
        row?.assigned_agent_id ??
        row?.assigned_user_id ??
        null;

      const status = String(row?.status || 'open').trim().toLowerCase();

      if (status === 'open') open_count += 1;
      if (mode === 'human') human_count += 1;
      if (mode === 'bot') bot_count += 1;

      if (mode === 'human') {
        if (assignedId) human_assigned_count += 1;
        else human_unassigned_count += 1;
      }
    }

    return res.status(200).json({
      ok: true,
      semantics: {
        kind: 'operational_pending_mvp',
        badge_field: 'human_unassigned_count',
        unread_supported: false
      },
      counts: {
        total_count,
        open_count,
        human_count,
        bot_count,
        human_assigned_count,
        human_unassigned_count
      },
      badge_count: human_unassigned_count,
      marker: '__AUTOATENDE_V4_R4A_INBOX_NOTIFICATION_SUMMARY_ENDPOINT__'
    });
  } catch (error) {
    console.error('[V4_R4A] inbox summary failed', error);
    return res.status(500).json({
      ok: false,
      error: 'INBOX_SUMMARY_FAILED'
    });
  }
});


router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const rawText =
      req.body?.text ??
      req.body?.message ??
      req.body?.content ??
      '';

    const body = String(rawText || '').trim();
    if (!body) {
      return res.status(400).json({
        error: 'MESSAGE_TEXT_REQUIRED'
      });
    }

    const companyId = resolveCompanyId(req);
    if (!companyId) {
      return res.status(400).json({
        error: 'COMPANY_ID_NOT_RESOLVED'
      });
    }

    
    /* __AUTOATENDE_V4_R16E_C3D_FIX_MANUAL_SEND_ROUTE_PAYLOAD_VARIABLE___NORMALIZE */
    const aaR16eC3dManualMessageContent = String(
      req.body?.text ??
      req.body?.message ??
      req.body?.content ??
      ''
    ).trim();

const result = await inboxService.sendTextMessageAndPersist({
      /* __AUTOATENDE_V4_R16E_C3D_FIX_MANUAL_SEND_ROUTE_PAYLOAD_VARIABLE__ */
      content: aaR16eC3dManualMessageContent,
      text: aaR16eC3dManualMessageContent,
      companyId,
      conversationId,
      body,
      senderType: 'human',
      metadata: {
        source: 'inbox_manual_send',
        agent_id: req.user?.id || req.userId || null
      }
    });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/conversations/:id/assign', inboxController.assignConversation);
router.post('/conversations/:id/mode', inboxController.changeMode);

// __AUTOATENDE_V4_R13C_INBOX_TEMPLATE_REAL_RENDER_CATALOG__
// Endpoint read-only para o Inbox renderizar templates como mensagem real.
// Usa catálogo interno/Supabase via serviço backend. Não envia mensagem e não altera banco.
try {
  const { loadTemplateCatalog } = require('../services/inboxTemplateCatalog.service');

  router.get('/template-render-catalog', async (req, res) => {
    try {
      const catalog = await loadTemplateCatalog();

      res.json({
        ok: true,
        source: 'inbox-template-render-catalog',
        ...catalog
      });
    } catch (err) {
      console.error('[R13C_TEMPLATE_CATALOG_ERROR]', err && (err.stack || err.message || err));
      res.status(500).json({
        ok: false,
        error: 'INBOX_TEMPLATE_CATALOG_ERROR',
        message: err?.message || 'Não foi possível carregar catálogo de templates.'
      });
    }
  });
} catch (err) {
  console.error('[R13C_TEMPLATE_CATALOG_BOOT_ERROR]', err && (err.stack || err.message || err));
}




// __AUTOATENDE_V4_R24D_C_B_R2_MEDIA_PROXY_PREVIEW_FIXED_DIST_SMOKE__
const aaR24dCBR2Axios = require('axios');
const aaR24dCBR2Supabase = require('../config/supabase');

function aaR24dCBR2ParseMaybe(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return null;
  }
}

function aaR24dCBR2MediaPayload(messageRow) {
  const raw = aaR24dCBR2ParseMaybe(messageRow?.raw) || {};
  const meta = aaR24dCBR2ParseMaybe(messageRow?.meta) || {};
  const type = String(messageRow?.message_type || meta?.type || raw?.type || '').toLowerCase();

  if (!['image', 'audio', 'video', 'document', 'sticker'].includes(type)) {
    return { type, raw, meta, mediaObject: null, mediaId: null, rawUrl: null };
  }

  const mediaObject = raw?.[type] && typeof raw[type] === 'object' ? raw[type] : null;
  const mediaId = meta?.media_id || mediaObject?.id || null;
  const rawUrl = mediaObject?.url || null;

  return { type, raw, meta, mediaObject, mediaId, rawUrl };
}

function aaR24dCBR2UserCompanyId(req) {
  return (
    req.companyId ||
    req.company_id ||
    req.clientId ||
    req.client_id ||
    req.company?.id ||
    req.company?.company_id ||
    req.profile?.company_id ||
    req.profile?.client_id ||
    req.user?.company_id ||
    req.user?.companyId ||
    req.user?.client_id ||
    req.user?.clientId ||
    req.auth?.company_id ||
    req.auth?.client_id ||
    null
  );
}

async function aaR24dCBR2ResolveCompanyId(req) {
  const direct = aaR24dCBR2UserCompanyId(req);
  if (direct) return direct;

  const userId = req.user?.id || req.user?.sub || req.auth?.uid || req.auth?.sub || req.jwt?.sub || null;
  if (!userId) return null;

  const attempts = [
    { table: 'profiles', column: 'id' },
    { table: 'profiles', column: 'user_id' },
    { table: 'users', column: 'id' },
  ];

  for (const item of attempts) {
    try {
      const { data, error } = await aaR24dCBR2Supabase
        .from(item.table)
        .select('company_id, client_id')
        .eq(item.column, userId)
        .limit(1);

      if (error || !Array.isArray(data) || !data[0]) continue;
      return data[0].company_id || data[0].client_id || null;
    } catch (_) {}
  }

  return null;
}

async function aaR24dCBR2FindWhatsappToken(companyId) {
  const { data, error } = await aaR24dCBR2Supabase
    .from('whatsapp_accounts')
    .select('*')
    .limit(20);

  if (error) {
    throw new Error('WHATSAPP_ACCOUNT_LOOKUP_FAILED');
  }

  const rows = Array.isArray(data) ? data : [];

  const preferred = rows.find((row) => {
    if (!row?.access_token) return false;
    return (
      (companyId && row.company_id === companyId) ||
      (companyId && row.client_id === companyId) ||
      (companyId && row.companyId === companyId) ||
      (companyId && row.clientId === companyId)
    );
  });

  const fallback = rows.find((row) => row?.access_token);

  return preferred || fallback || null;
}

async function aaR24dCBR2GraphMediaUrl(mediaId, accessToken) {
  if (!mediaId || !accessToken) return null;

  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(mediaId)}`;

  const response = await aaR24dCBR2Axios.get(url, {
    timeout: 12000,
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status >= 200 && response.status < 300 && response.data?.url) {
    return {
      url: response.data.url,
      mimeType: response.data.mime_type || null,
      fileSize: response.data.file_size || null,
      sha256: response.data.sha256 || null,
      status: response.status,
    };
  }

  return {
    url: null,
    mimeType: null,
    fileSize: null,
    sha256: null,
    status: response.status,
  };
}

async function aaR24dCBR2DownloadMedia(downloadUrl, accessToken) {
  if (!downloadUrl || !accessToken) {
    return { response: null, error: 'MISSING_DOWNLOAD_URL_OR_TOKEN' };
  }

  try {
    const response = await aaR24dCBR2Axios.get(downloadUrl, {
      responseType: 'stream',
      timeout: 20000,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'AutoAtendeAI-media-proxy/1.0',
      },
    });

    return { response, error: null };
  } catch (err) {
    return { response: null, error: err?.code || err?.message || 'DOWNLOAD_FAILED' };
  }
}

router.get('/messages/:messageId/media', async (req, res) => {
  try {
    const messageId = String(req.params.messageId || '').trim();

    if (!messageId) {
      return res.status(400).json({ error: 'MESSAGE_ID_REQUIRED' });
    }

    if (!req.user && !req.auth && !req.company && !req.profile) {
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const requesterCompanyId = await aaR24dCBR2ResolveCompanyId(req);

    const { data: messageRows, error: messageError } = await aaR24dCBR2Supabase
      .from('inbox_messages')
      .select('id, company_id, conversation_id, direction, sender_type, message_type, content, raw, meta, provider_message_id, wa_message_id, created_at')
      .eq('id', messageId)
      .limit(1);

    if (messageError) {
      return res.status(500).json({ error: 'MEDIA_MESSAGE_LOOKUP_FAILED' });
    }

    const message = Array.isArray(messageRows) ? messageRows[0] : null;

    if (!message) {
      return res.status(404).json({ error: 'MEDIA_MESSAGE_NOT_FOUND' });
    }

    if (!requesterCompanyId) {
      return res.status(403).json({ error: 'COMPANY_SCOPE_REQUIRED' });
    }

    if (message.company_id && String(message.company_id) !== String(requesterCompanyId)) {
      return res.status(404).json({ error: 'MEDIA_MESSAGE_NOT_FOUND' });
    }

    const media = aaR24dCBR2MediaPayload(message);

    if (!media.mediaId && !media.rawUrl) {
      return res.status(404).json({ error: 'MEDIA_NOT_AVAILABLE' });
    }

    const account = await aaR24dCBR2FindWhatsappToken(message.company_id || requesterCompanyId);

    if (!account?.access_token) {
      return res.status(503).json({ error: 'WHATSAPP_ACCESS_TOKEN_NOT_AVAILABLE' });
    }

    let downloadUrl = media.rawUrl || null;
    let graphInfo = null;

    if (media.mediaId) {
      graphInfo = await aaR24dCBR2GraphMediaUrl(media.mediaId, account.access_token);
      if (graphInfo?.url) {
        downloadUrl = graphInfo.url;
      }
    }

    let download = await aaR24dCBR2DownloadMedia(downloadUrl, account.access_token);

    if ((!download.response || download.response.status === 401 || download.response.status === 403) && media.rawUrl && graphInfo?.url && graphInfo.url !== media.rawUrl) {
      download = await aaR24dCBR2DownloadMedia(media.rawUrl, account.access_token);
    }

    if (!download.response) {
      return res.status(502).json({ error: 'MEDIA_DOWNLOAD_FAILED', reason: download.error || 'download_error' });
    }

    if (download.response.status < 200 || download.response.status >= 300) {
      return res.status(download.response.status === 404 ? 404 : 502).json({
        error: 'MEDIA_DOWNLOAD_FAILED',
        status: download.response.status,
      });
    }

    const contentType =
      download.response.headers['content-type'] ||
      graphInfo?.mimeType ||
      media.meta?.mime_type ||
      media.mediaObject?.mime_type ||
      'application/octet-stream';

    const contentLength = download.response.headers['content-length'];

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');

    return download.response.data.pipe(res);
  } catch (err) {
    console.error('[R24D-C-B-R2 media proxy]', err?.message || err);
    return res.status(500).json({ error: 'MEDIA_PROXY_FAILED' });
  }
});



// __AUTOATENDE_V4_R25E_R2B_CONTACT_NAME_ENDPOINT_INLINE_AUTH_ATTENDANCE_UI_PATCH_FIX_PYTHON__
function aaR25eR2bNormalizeContactName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function aaR25eR2bResolveCompanyId(req) {
  try {
    if (typeof resolveCompanyId === 'function') {
      const resolved = await Promise.resolve(resolveCompanyId(req));
      if (resolved) return resolved;
    }
  } catch (error) {
    console.warn('[R25E-R2B] resolveCompanyId fallback acionado', error?.message || error);
  }

  return (
    req?.user?.company_id ||
    req?.user?.companyId ||
    req?.auth?.company_id ||
    req?.auth?.companyId ||
    req?.profile?.company_id ||
    req?.profile?.companyId ||
    req?.company?.id ||
    req?.company_id ||
    req?.companyId ||
    null
  );
}

router.patch('/conversations/:id/contact-name', async (req, res) => {
  try {
    if (!req.user && !req.auth && !req.company && !req.profile) {
      return res.status(401).json({
        success: false,
        error: 'AUTH_REQUIRED',
        message: 'Autenticacao obrigatoria.',
      });
    }

    const conversationId = String(req.params.id || '').trim();
    const companyId = await aaR25eR2bResolveCompanyId(req);
    const nextName = aaR25eR2bNormalizeContactName(
      req.body?.contact_name ?? req.body?.contactName ?? req.body?.name
    );

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'CONVERSATION_ID_REQUIRED',
        message: 'ID da conversa e obrigatorio.',
      });
    }

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: 'COMPANY_CONTEXT_REQUIRED',
        message: 'Contexto da empresa nao encontrado.',
      });
    }

    if (nextName.length < 2 || nextName.length > 80) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_CONTACT_NAME',
        message: 'O nome deve ter entre 2 e 80 caracteres.',
      });
    }

    const { data: existingRows, error: findError } = await supabase
      .from('inbox_conversations')
      .select('id, company_id, contact_phone, contact_number, contact_name')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .limit(1);

    if (findError) {
      console.error('[R25E-R2B] contact name lookup error', findError);
      return res.status(500).json({
        success: false,
        error: 'CONTACT_NAME_LOOKUP_FAILED',
        message: 'Nao foi possivel localizar a conversa.',
      });
    }

    const existingConversation = Array.isArray(existingRows) ? existingRows[0] : null;

    if (!existingConversation) {
      return res.status(404).json({
        success: false,
        error: 'CONVERSATION_NOT_FOUND',
        message: 'Conversa nao encontrada para esta empresa.',
      });
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('inbox_conversations')
      .update({ contact_name: nextName })
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .select('id, company_id, contact_phone, contact_number, contact_name')
      .limit(1);

    if (updateError) {
      console.error('[R25E-R2B] contact name update error', updateError);
      return res.status(500).json({
        success: false,
        error: 'CONTACT_NAME_UPDATE_FAILED',
        message: 'Nao foi possivel atualizar o nome do contato.',
      });
    }

    const updatedConversation = Array.isArray(updatedRows) && updatedRows[0]
      ? updatedRows[0]
      : { ...existingConversation, contact_name: nextName };

    return res.json({
      success: true,
      conversation: updatedConversation,
    });
  } catch (error) {
    console.error('[R25E-R2B] unexpected contact name update error', error);
    return res.status(500).json({
      success: false,
      error: 'CONTACT_NAME_UPDATE_UNEXPECTED_ERROR',
      message: 'Erro inesperado ao atualizar o nome do contato.',
    });
  }
});



/* __AUTOATENDE_OUTBOUND_MEDIA_PHASE2D_R2__ */
const aaOutboundMediaMulter = require('multer');
const aaOutboundMediaFs = require('fs');
const aaOutboundMediaPath = require('path');
const aaOutboundMediaCrypto = require('crypto');

const {
  sendOutboundMedia: aaSendOutboundMediaR2
} = require('../services/inboxMediaOutbound.service');

const {
  normalizeVoiceRecording:
    aaNormalizeVoiceRecording
} = require('../services/voiceRecording.service');

/* __AUTOATENDE_VOICE_BACKEND_PHASE4B1__ */

const AA_OUTBOUND_MEDIA_TMP_DIR =
  process.env.OUTBOUND_MEDIA_TMP_DIR ||
  '/app/data/outbound-media-tmp';

aaOutboundMediaFs.mkdirSync(
  AA_OUTBOUND_MEDIA_TMP_DIR,
  {
    recursive: true,
    mode: 0o750
  }
);

/* __AUTOATENDE_AUDIO_ATTACHMENT_PHASE4A__ */
const AA_OUTBOUND_MEDIA_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',

  'video/mp4',
  'video/3gpp',

  'audio/aac',
  'audio/amr',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',

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
]);

const aaOutboundMediaStorage =
  aaOutboundMediaMulter.diskStorage({
    destination: (
      req,
      file,
      callback
    ) => {
      callback(
        null,
        AA_OUTBOUND_MEDIA_TMP_DIR
      );
    },

    filename: (
      req,
      file,
      callback
    ) => {
      const extension =
        aaOutboundMediaPath
          .extname(file.originalname || '')
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, '')
          .slice(0, 12);

      callback(
        null,
        [
          Date.now(),
          aaOutboundMediaCrypto
            .randomBytes(12)
            .toString('hex'),
          extension
        ].join('-')
      );
    }
  });

const aaOutboundMediaUpload =
  aaOutboundMediaMulter({
    storage: aaOutboundMediaStorage,

    limits: {
      files: 1,
      fileSize: 95 * 1024 * 1024,
      fields: 8,
      fieldSize: 128 * 1024
    },

    fileFilter: (
      req,
      file,
      callback
    ) => {
      let mime = String(
        file?.mimetype || ''
      )
        .trim()
        .toLowerCase()
        .split(';')[0]
        .trim();

      const extension =
        aaOutboundMediaPath
          .extname(
            file?.originalname || ''
          )
          .trim()
          .toLowerCase();

      const mimeAliases = {
        'audio/mp3': 'audio/mpeg',
        'audio/x-mp3': 'audio/mpeg',
        'audio/x-m4a': 'audio/mp4',
        'audio/x-aac': 'audio/aac',
        'audio/x-amr': 'audio/amr',
        'application/ogg': 'audio/ogg'
      };

      const extensionMimes = {
        '.aac': 'audio/aac',
        '.amr': 'audio/amr',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg'
      };

      const aliasedMime =
        mimeAliases[mime] ||
        null;

      const extensionMime =
        (
          !mime ||
          mime ===
            'application/octet-stream'
        )
          ? extensionMimes[extension] ||
            null
          : null;

      const normalizedMime =
        aliasedMime ||
        extensionMime ||
        mime;

      if (
        normalizedMime &&
        normalizedMime !== mime
      ) {
        file.mimetype =
          normalizedMime;

        mime = normalizedMime;
      }

      if (
        !AA_OUTBOUND_MEDIA_ALLOWED_MIMES
          .has(mime)
      ) {
        const error = new Error(
          'Formato de arquivo não permitido.'
        );

        error.code =
          'MEDIA_TYPE_NOT_ALLOWED';

        error.statusCode = 415;

        return callback(error);
      }

      return callback(null, true);
    }
  });

function aaOutboundMediaCleanup(file) {
  const filePath =
    file?.path || null;

  if (!filePath) {
    return;
  }

  try {
    aaOutboundMediaFs.unlinkSync(
      filePath
    );
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(
        '[OUTBOUND_MEDIA_R2] temp cleanup warning:',
        error?.message || error
      );
    }
  }
}

function aaOutboundMediaErrorResponse(
  res,
  error
) {
  const multerTooLarge =
    error?.code === 'LIMIT_FILE_SIZE';

  const status = multerTooLarge
    ? 413
    : Number(
        error?.statusCode ||
        error?.status ||
        error?.response?.status ||
        500
      );

  const safeStatus =
    status >= 400 &&
    status < 600
      ? status
      : 500;

  const code = multerTooLarge
    ? 'MEDIA_FILE_TOO_LARGE'
    : error?.code ||
      'OUTBOUND_MEDIA_FAILED';

  const message = multerTooLarge
    ? 'O arquivo excede o limite permitido.'
    : error?.message ||
      'Não foi possível enviar o arquivo.';

  return res.status(safeStatus).json({
    success: false,
    code,
    message,
    details:
      error?.details ||
      error?.response?.data ||
      null
  });
}

router.post(
  '/conversations/:id/media',
  (req, res) => {
    aaOutboundMediaUpload.single('file')(
      req,
      res,
      async (uploadError) => {
        if (uploadError) {
          aaOutboundMediaCleanup(
            req.file
          );

          return aaOutboundMediaErrorResponse(
            res,
            uploadError
          );
        }

        let aaNormalizedVoiceFile =
          null;

        try {
          const companyId =
            resolveCompanyId(req);

          if (!companyId) {
            const error = new Error(
              'Empresa não identificada.'
            );

            error.code =
              'COMPANY_ID_NOT_RESOLVED';

            error.statusCode = 400;

            throw error;
          }

          if (!req.file) {
            const error = new Error(
              'Selecione um arquivo.'
            );

            error.code =
              'MEDIA_FILE_REQUIRED';

            error.statusCode = 400;

            throw error;
          }

          const aaVoiceRecording =
            [
              '1',
              'true',
              'yes',
              'on'
            ].includes(
              String(
                req.body
                  ?.voice_recording ||
                ''
              )
                .trim()
                .toLowerCase()
            );

          if (
            aaVoiceRecording &&
            Number(req.file.size || 0) >
              16 * 1024 * 1024
          ) {
            const error = new Error(
              'A gravação excede o limite permitido de 16 MB.'
            );

            error.code =
              'VOICE_FILE_TOO_LARGE';

            error.statusCode = 413;

            throw error;
          }

          if (aaVoiceRecording) {
            aaNormalizedVoiceFile =
              await aaNormalizeVoiceRecording(
                req.file
              );
          }

          const aaEffectiveOutboundFile =
            aaNormalizedVoiceFile ||
            req.file;

          const result =
            await aaSendOutboundMediaR2({
              companyId,
              conversationId:
                String(
                  req.params.id || ''
                ).trim(),
              file:
                aaEffectiveOutboundFile,
              caption:
                req.body?.caption || '',
              actorUserId:
                req.user?.id ||
                req.userId ||
                null,
              voiceRecording:
                aaVoiceRecording,
              voiceDurationSeconds:
                aaNormalizedVoiceFile
                  ?.durationSeconds ||
                null
            });

          return res.status(201).json({
            success: true,
            data: result
          });
        } catch (error) {
          console.error(
            '[OUTBOUND_MEDIA_R2] route failed',
            {
              code:
                error?.code || null,
              message:
                error?.message || null,
              status:
                error?.statusCode ||
                error?.status ||
                null
            }
          );

          return aaOutboundMediaErrorResponse(
            res,
            error
          );
        } finally {
          aaOutboundMediaCleanup(
            aaNormalizedVoiceFile
          );

          aaOutboundMediaCleanup(
            req.file
          );
        }
      }
    );
  }
);
/* END __AUTOATENDE_OUTBOUND_MEDIA_PHASE2D_R2__ */



/* __AUTOATENDE_CONTACT_AVATAR_BACKEND_V1__ */

const AA_CONTACT_AVATAR_BUCKET =
  'contact-avatars';

const AA_CONTACT_AVATAR_MAX_BYTES =
  5 * 1024 * 1024;

const AA_CONTACT_AVATAR_ALLOWED_MIMES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

const aaContactAvatarUpload =
  aaOutboundMediaMulter({
    storage:
      aaOutboundMediaMulter.memoryStorage(),

    limits: {
      fileSize:
        AA_CONTACT_AVATAR_MAX_BYTES,
      files: 1,
    },
  });

function aaContactAvatarHasAuth(req) {
  return Boolean(
    req?.user ||
    req?.auth ||
    req?.company ||
    req?.profile
  );
}

function aaContactAvatarRequireAuth(
  req,
  res,
  next
) {
  if (!aaContactAvatarHasAuth(req)) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: 'Autenticação obrigatória.',
    });
  }

  return next();
}

async function aaContactAvatarResolveCompanyId(
  req
) {
  try {
    const resolved =
      await Promise.resolve(
        resolveCompanyId(req)
      );

    if (resolved) {
      return String(resolved).trim();
    }
  } catch (error) {
    console.warn(
      '[CONTACT_AVATAR] company resolver warning',
      error?.message || error
    );
  }

  const fallback =
    req?.user?.company_id ||
    req?.user?.companyId ||
    req?.auth?.company_id ||
    req?.auth?.companyId ||
    req?.profile?.company_id ||
    req?.profile?.companyId ||
    req?.company?.id ||
    req?.company_id ||
    req?.companyId ||
    null;

  return fallback
    ? String(fallback).trim()
    : '';
}

function aaContactAvatarNormalizeId(
  value
) {
  return String(value || '').trim();
}

function aaContactAvatarObjectPath({
  companyId,
  conversationId,
}) {
  return (
    `${encodeURIComponent(companyId)}/` +
    `${encodeURIComponent(conversationId)}`
  );
}

function aaContactAvatarNormalizeDeclaredMime(
  value
) {
  const mime =
    String(value || '')
      .trim()
      .toLowerCase();

  if (mime === 'image/jpg') {
    return 'image/jpeg';
  }

  return mime;
}

function aaContactAvatarDetectMime(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 12
  ) {
    return null;
  }

  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.subarray(0, 4).toString('ascii')
      === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii')
      === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

async function aaContactAvatarFindConversation({
  companyId,
  conversationId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from('inbox_conversations')
      .select(
        [
          'id',
          'company_id',
          'contact_name',
          'contact_number',
          'contact_phone',
        ].join(',')
      )
      .eq('company_id', companyId)
      .eq('id', conversationId)
      .maybeSingle();

  if (error) {
    const lookupError =
      new Error(
        'CONTACT_AVATAR_CONVERSATION_LOOKUP_FAILED'
      );

    lookupError.code =
      'CONTACT_AVATAR_CONVERSATION_LOOKUP_FAILED';

    lookupError.statusCode = 500;
    lookupError.cause = error;

    throw lookupError;
  }

  return data || null;
}

function aaContactAvatarErrorResponse(
  res,
  error
) {
  const code =
    String(
      error?.code ||
      error?.message ||
      'CONTACT_AVATAR_ERROR'
    );

  if (
    code === 'LIMIT_FILE_SIZE'
  ) {
    return res.status(413).json({
      success: false,
      error: 'CONTACT_AVATAR_TOO_LARGE',
      message:
        'A foto deve ter no máximo 5 MB.',
    });
  }

  const statusCode =
    Number(error?.statusCode) ||
    500;

  return res.status(statusCode).json({
    success: false,
    error: code,
    message:
      statusCode >= 500
        ? 'Não foi possível processar a foto do contato.'
        : error?.publicMessage ||
          error?.message ||
          'Não foi possível processar a foto.',
  });
}

router.get(
  '/conversations/:id/avatar',
  aaContactAvatarRequireAuth,
  async (req, res) => {
    try {
      const conversationId =
        aaContactAvatarNormalizeId(
          req.params.id
        );

      const companyId =
        await aaContactAvatarResolveCompanyId(
          req
        );

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error:
            'CONVERSATION_ID_REQUIRED',
        });
      }

      if (!companyId) {
        return res.status(403).json({
          success: false,
          error:
            'COMPANY_CONTEXT_REQUIRED',
        });
      }

      const conversation =
        await aaContactAvatarFindConversation({
          companyId,
          conversationId,
        });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error:
            'CONVERSATION_NOT_FOUND',
        });
      }

      const objectPath =
        aaContactAvatarObjectPath({
          companyId,
          conversationId,
        });

      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            AA_CONTACT_AVATAR_BUCKET
          )
          .download(objectPath);

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error:
            'CONTACT_AVATAR_NOT_FOUND',
        });
      }

      const arrayBuffer =
        await data.arrayBuffer();

      const buffer =
        Buffer.from(arrayBuffer);

      const mime =
        aaContactAvatarDetectMime(buffer) ||
        data.type ||
        'application/octet-stream';

      res.setHeader(
        'Content-Type',
        mime
      );

      res.setHeader(
        'Content-Length',
        String(buffer.length)
      );

      res.setHeader(
        'Cache-Control',
        'private, max-age=300'
      );

      res.setHeader(
        'X-Content-Type-Options',
        'nosniff'
      );

      return res.status(200).send(buffer);
    } catch (error) {
      console.error(
        '[CONTACT_AVATAR] read failed',
        error
      );

      return aaContactAvatarErrorResponse(
        res,
        error
      );
    }
  }
);

router.post(
  '/conversations/:id/avatar',
  aaContactAvatarRequireAuth,
  (req, res) => {
    aaContactAvatarUpload.single('file')(
      req,
      res,
      async (uploadError) => {
        if (uploadError) {
          return aaContactAvatarErrorResponse(
            res,
            uploadError
          );
        }

        try {
          const conversationId =
            aaContactAvatarNormalizeId(
              req.params.id
            );

          const companyId =
            await aaContactAvatarResolveCompanyId(
              req
            );

          if (!conversationId) {
            return res.status(400).json({
              success: false,
              error:
                'CONVERSATION_ID_REQUIRED',
            });
          }

          if (!companyId) {
            return res.status(403).json({
              success: false,
              error:
                'COMPANY_CONTEXT_REQUIRED',
            });
          }

          if (!req.file?.buffer) {
            return res.status(400).json({
              success: false,
              error:
                'CONTACT_AVATAR_FILE_REQUIRED',
              message:
                'Selecione uma imagem.',
            });
          }

          const declaredMime =
            aaContactAvatarNormalizeDeclaredMime(
              req.file.mimetype
            );

          const detectedMime =
            aaContactAvatarDetectMime(
              req.file.buffer
            );

          if (
            !AA_CONTACT_AVATAR_ALLOWED_MIMES
              .has(declaredMime) ||
            !AA_CONTACT_AVATAR_ALLOWED_MIMES
              .has(detectedMime)
          ) {
            return res.status(415).json({
              success: false,
              error:
                'CONTACT_AVATAR_UNSUPPORTED_TYPE',
              message:
                'Use uma imagem JPEG, PNG ou WebP.',
            });
          }

          if (
            declaredMime !== detectedMime
          ) {
            return res.status(415).json({
              success: false,
              error:
                'CONTACT_AVATAR_MIME_MISMATCH',
              message:
                'O conteúdo do arquivo não corresponde ao tipo informado.',
            });
          }

          const conversation =
            await aaContactAvatarFindConversation({
              companyId,
              conversationId,
            });

          if (!conversation) {
            return res.status(404).json({
              success: false,
              error:
                'CONVERSATION_NOT_FOUND',
            });
          }

          const objectPath =
            aaContactAvatarObjectPath({
              companyId,
              conversationId,
            });

          const {
            error: storageError,
          } =
            await supabase.storage
              .from(
                AA_CONTACT_AVATAR_BUCKET
              )
              .upload(
                objectPath,
                req.file.buffer,
                {
                  contentType:
                    detectedMime,
                  cacheControl: '300',
                  upsert: true,
                }
              );

          if (storageError) {
            const error =
              new Error(
                'CONTACT_AVATAR_UPLOAD_FAILED'
              );

            error.code =
              'CONTACT_AVATAR_UPLOAD_FAILED';

            error.statusCode = 500;
            error.cause = storageError;

            throw error;
          }

          return res.status(201).json({
            success: true,
            avatar: {
              conversation_id:
                conversationId,

              endpoint:
                `/api/inbox/conversations/` +
                `${encodeURIComponent(conversationId)}` +
                `/avatar?v=${Date.now()}`,

              mime_type:
                detectedMime,

              size_bytes:
                req.file.buffer.length,
            },
          });
        } catch (error) {
          console.error(
            '[CONTACT_AVATAR] upload failed',
            error
          );

          return aaContactAvatarErrorResponse(
            res,
            error
          );
        }
      }
    );
  }
);

router.delete(
  '/conversations/:id/avatar',
  aaContactAvatarRequireAuth,
  async (req, res) => {
    try {
      const conversationId =
        aaContactAvatarNormalizeId(
          req.params.id
        );

      const companyId =
        await aaContactAvatarResolveCompanyId(
          req
        );

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error:
            'CONVERSATION_ID_REQUIRED',
        });
      }

      if (!companyId) {
        return res.status(403).json({
          success: false,
          error:
            'COMPANY_CONTEXT_REQUIRED',
        });
      }

      const conversation =
        await aaContactAvatarFindConversation({
          companyId,
          conversationId,
        });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error:
            'CONVERSATION_NOT_FOUND',
        });
      }

      const objectPath =
        aaContactAvatarObjectPath({
          companyId,
          conversationId,
        });

      const {
        error: removeError,
      } =
        await supabase.storage
          .from(
            AA_CONTACT_AVATAR_BUCKET
          )
          .remove([objectPath]);

      if (removeError) {
        const error =
          new Error(
            'CONTACT_AVATAR_DELETE_FAILED'
          );

        error.code =
          'CONTACT_AVATAR_DELETE_FAILED';

        error.statusCode = 500;
        error.cause = removeError;

        throw error;
      }

      return res.json({
        success: true,
        conversation_id:
          conversationId,
        avatar_removed: true,
      });
    } catch (error) {
      console.error(
        '[CONTACT_AVATAR] delete failed',
        error
      );

      return aaContactAvatarErrorResponse(
        res,
        error
      );
    }
  }
);

/* END __AUTOATENDE_CONTACT_AVATAR_BACKEND_V1__ */

/* __AUTOATENDE_CONTACT_INTERNAL_NOTES_BACKEND_V1__ */
const AA_CONTACT_INTERNAL_NOTES_MAX_LENGTH = 4000;

const AA_CONTACT_INTERNAL_NOTES_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function aaContactInternalNotesHasAuth(req) {
  return Boolean(
    req?.user ||
    req?.auth ||
    req?.company ||
    req?.profile
  );
}

function aaContactInternalNotesRequireAuth(
  req,
  res,
  next
) {
  if (!aaContactInternalNotesHasAuth(req)) {
    return res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: 'Autenticação obrigatória.',
    });
  }

  return next();
}

async function aaContactInternalNotesResolveCompanyId(
  req
) {
  try {
    const resolved =
      await Promise.resolve(
        resolveCompanyId(req)
      );

    if (resolved) {
      return String(resolved).trim();
    }
  } catch (error) {
    console.warn(
      '[CONTACT_INTERNAL_NOTES] company resolver warning',
      error?.message || error
    );
  }

  const fallback =
    req?.user?.company_id ||
    req?.user?.companyId ||
    req?.auth?.company_id ||
    req?.auth?.companyId ||
    req?.profile?.company_id ||
    req?.profile?.companyId ||
    req?.company?.id ||
    req?.company_id ||
    req?.companyId ||
    null;

  return fallback
    ? String(fallback).trim()
    : '';
}

function aaContactInternalNotesResolveActorUserId(
  req
) {
  const candidate =
    req?.user?.id ||
    req?.user?.user_id ||
    req?.user?.userId ||
    req?.auth?.id ||
    req?.auth?.user_id ||
    req?.auth?.userId ||
    req?.profile?.id ||
    req?.userId ||
    null;

  const normalized =
    String(candidate || '').trim();

  return AA_CONTACT_INTERNAL_NOTES_UUID_RE
    .test(normalized)
      ? normalized
      : null;
}

function aaContactInternalNotesNormalizeConversationId(
  value
) {
  return String(value || '').trim();
}

function aaContactInternalNotesNormalizeContent(
  value
) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function aaContactInternalNotesContentLength(
  value
) {
  return Array.from(
    String(value || '')
  ).length;
}

function aaContactInternalNotesCreateError({
  code,
  statusCode = 500,
  publicMessage,
  cause,
}) {
  const error =
    new Error(code);

  error.code = code;
  error.statusCode = statusCode;
  error.publicMessage =
    publicMessage || code;
  error.cause = cause;

  return error;
}

async function aaContactInternalNotesFindConversation({
  companyId,
  conversationId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from('inbox_conversations')
      .select(
        [
          'id',
          'company_id',
          'contact_name',
          'contact_number',
          'contact_phone',
        ].join(',')
      )
      .eq('company_id', companyId)
      .eq('id', conversationId)
      .maybeSingle();

  if (error) {
    throw aaContactInternalNotesCreateError({
      code:
        'CONTACT_INTERNAL_NOTE_CONVERSATION_LOOKUP_FAILED',
      statusCode: 500,
      publicMessage:
        'Não foi possível localizar a conversa.',
      cause: error,
    });
  }

  return data || null;
}

async function aaContactInternalNotesFindNote({
  companyId,
  conversationId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from('contact_internal_notes')
      .select(
        [
          'id',
          'company_id',
          'conversation_id',
          'content',
          'created_by',
          'updated_by',
          'created_at',
          'updated_at',
        ].join(',')
      )
      .eq('company_id', companyId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

  if (error) {
    throw aaContactInternalNotesCreateError({
      code:
        'CONTACT_INTERNAL_NOTE_LOOKUP_FAILED',
      statusCode: 500,
      publicMessage:
        'Não foi possível carregar a observação interna.',
      cause: error,
    });
  }

  return data || null;
}

function aaContactInternalNotesPublicNote(
  row
) {
  if (!row) {
    return null;
  }

  return {
    id:
      row.id || null,

    conversation_id:
      row.conversation_id || null,

    content:
      String(row.content || ''),

    created_by:
      row.created_by || null,

    updated_by:
      row.updated_by || null,

    created_at:
      row.created_at || null,

    updated_at:
      row.updated_at || null,
  };
}

function aaContactInternalNotesErrorResponse(
  res,
  error
) {
  const code =
    String(
      error?.code ||
      error?.message ||
      'CONTACT_INTERNAL_NOTE_ERROR'
    );

  const statusCode =
    Number(error?.statusCode) ||
    500;

  if (statusCode >= 500) {
    console.error(
      '[CONTACT_INTERNAL_NOTES] request failed',
      {
        code,
        cause:
          error?.cause?.code ||
          error?.cause?.message ||
          null,
      }
    );
  }

  return res.status(statusCode).json({
    success: false,
    error: code,
    message:
      statusCode >= 500
        ? 'Não foi possível processar a observação interna.'
        : error?.publicMessage ||
          error?.message ||
          'Não foi possível processar a observação interna.',
  });
}

async function aaContactInternalNotesResolveScope(
  req
) {
  const conversationId =
    aaContactInternalNotesNormalizeConversationId(
      req.params.id
    );

  const companyId =
    await aaContactInternalNotesResolveCompanyId(
      req
    );

  if (!conversationId) {
    throw aaContactInternalNotesCreateError({
      code: 'CONVERSATION_ID_REQUIRED',
      statusCode: 400,
      publicMessage:
        'ID da conversa é obrigatório.',
    });
  }

  if (
    !AA_CONTACT_INTERNAL_NOTES_UUID_RE
      .test(conversationId)
  ) {
    throw aaContactInternalNotesCreateError({
      code: 'INVALID_CONVERSATION_ID',
      statusCode: 400,
      publicMessage:
        'ID da conversa inválido.',
    });
  }

  if (!companyId) {
    throw aaContactInternalNotesCreateError({
      code: 'COMPANY_CONTEXT_REQUIRED',
      statusCode: 403,
      publicMessage:
        'Contexto da empresa não encontrado.',
    });
  }

  const conversation =
    await aaContactInternalNotesFindConversation({
      companyId,
      conversationId,
    });

  if (!conversation) {
    throw aaContactInternalNotesCreateError({
      code: 'CONVERSATION_NOT_FOUND',
      statusCode: 404,
      publicMessage:
        'Conversa não encontrada para esta empresa.',
    });
  }

  return {
    companyId,
    conversationId,
    conversation,
  };
}

router.get(
  '/conversations/:id/internal-note',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const {
        companyId,
        conversationId,
      } =
        await aaContactInternalNotesResolveScope(
          req
        );

      const note =
        await aaContactInternalNotesFindNote({
          companyId,
          conversationId,
        });

      return res.status(200).json({
        success: true,
        conversation_id:
          conversationId,
        note:
          aaContactInternalNotesPublicNote(
            note
          ),
      });
    } catch (error) {
      return aaContactInternalNotesErrorResponse(
        res,
        error
      );
    }
  }
);

router.put(
  '/conversations/:id/internal-note',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const {
        companyId,
        conversationId,
      } =
        await aaContactInternalNotesResolveScope(
          req
        );

      const content =
        aaContactInternalNotesNormalizeContent(
          req.body?.content ??
          req.body?.note ??
          req.body?.internal_note ??
          req.body?.internalNote
        );

      const contentLength =
        aaContactInternalNotesContentLength(
          content
        );

      if (!content) {
        throw aaContactInternalNotesCreateError({
          code:
            'CONTACT_INTERNAL_NOTE_CONTENT_REQUIRED',
          statusCode: 400,
          publicMessage:
            'Digite uma observação antes de salvar.',
        });
      }

      if (
        contentLength >
        AA_CONTACT_INTERNAL_NOTES_MAX_LENGTH
      ) {
        throw aaContactInternalNotesCreateError({
          code:
            'CONTACT_INTERNAL_NOTE_TOO_LONG',
          statusCode: 400,
          publicMessage:
            'A observação deve ter no máximo 4.000 caracteres.',
        });
      }

      const actorUserId =
        aaContactInternalNotesResolveActorUserId(
          req
        );

      const existing =
        await aaContactInternalNotesFindNote({
          companyId,
          conversationId,
        });

      let savedNote = null;
      let created = false;

      if (existing) {
        const {
          data,
          error,
        } =
          await supabase
            .from('contact_internal_notes')
            .update({
              content,
              updated_by:
                actorUserId,
            })
            .eq('id', existing.id)
            .eq('company_id', companyId)
            .eq(
              'conversation_id',
              conversationId
            )
            .select(
              [
                'id',
                'company_id',
                'conversation_id',
                'content',
                'created_by',
                'updated_by',
                'created_at',
                'updated_at',
              ].join(',')
            )
            .single();

        if (error) {
          throw aaContactInternalNotesCreateError({
            code:
              'CONTACT_INTERNAL_NOTE_UPDATE_FAILED',
            statusCode: 500,
            publicMessage:
              'Não foi possível atualizar a observação interna.',
            cause: error,
          });
        }

        savedNote = data;
      } else {
        const {
          data,
          error,
        } =
          await supabase
            .from('contact_internal_notes')
            .insert({
              company_id:
                companyId,
              conversation_id:
                conversationId,
              content,
              created_by:
                actorUserId,
              updated_by:
                actorUserId,
            })
            .select(
              [
                'id',
                'company_id',
                'conversation_id',
                'content',
                'created_by',
                'updated_by',
                'created_at',
                'updated_at',
              ].join(',')
            )
            .single();

        if (
          error &&
          String(error.code || '') === '23505'
        ) {
          const {
            data: retryData,
            error: retryError,
          } =
            await supabase
              .from('contact_internal_notes')
              .update({
                content,
                updated_by:
                  actorUserId,
              })
              .eq('company_id', companyId)
              .eq(
                'conversation_id',
                conversationId
              )
              .select(
                [
                  'id',
                  'company_id',
                  'conversation_id',
                  'content',
                  'created_by',
                  'updated_by',
                  'created_at',
                  'updated_at',
                ].join(',')
              )
              .single();

          if (retryError) {
            throw aaContactInternalNotesCreateError({
              code:
                'CONTACT_INTERNAL_NOTE_UPSERT_RETRY_FAILED',
              statusCode: 500,
              publicMessage:
                'Não foi possível salvar a observação interna.',
              cause: retryError,
            });
          }

          savedNote = retryData;
        } else if (error) {
          throw aaContactInternalNotesCreateError({
            code:
              'CONTACT_INTERNAL_NOTE_CREATE_FAILED',
            statusCode: 500,
            publicMessage:
              'Não foi possível criar a observação interna.',
            cause: error,
          });
        } else {
          savedNote = data;
          created = true;
        }
      }

      return res
        .status(created ? 201 : 200)
        .json({
          success: true,
          created,
          conversation_id:
            conversationId,
          note:
            aaContactInternalNotesPublicNote(
              savedNote
            ),
        });
    } catch (error) {
      return aaContactInternalNotesErrorResponse(
        res,
        error
      );
    }
  }
);

router.delete(
  '/conversations/:id/internal-note',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const {
        companyId,
        conversationId,
      } =
        await aaContactInternalNotesResolveScope(
          req
        );

      const {
        data,
        error,
      } =
        await supabase
          .from('contact_internal_notes')
          .delete()
          .eq('company_id', companyId)
          .eq(
            'conversation_id',
            conversationId
          )
          .select('id');

      if (error) {
        throw aaContactInternalNotesCreateError({
          code:
            'CONTACT_INTERNAL_NOTE_DELETE_FAILED',
          statusCode: 500,
          publicMessage:
            'Não foi possível remover a observação interna.',
          cause: error,
        });
      }

      return res.status(200).json({
        success: true,
        conversation_id:
          conversationId,
        note_removed:
          Array.isArray(data) &&
          data.length > 0,
      });
    } catch (error) {
      return aaContactInternalNotesErrorResponse(
        res,
        error
      );
    }
  }
);
/* END __AUTOATENDE_CONTACT_INTERNAL_NOTES_BACKEND_V1__ */


/* __AUTOATENDE_CONTACT_FOLLOWUP_BACKEND_V1__ */
const AA_CONTACT_FOLLOWUP_TABLE =
  'contact_followups';

const AA_CONTACT_FOLLOWUP_SELECT = [
  'id',
  'company_id',
  'conversation_id',
  'due_at',
  'summary',
  'status',
  'created_by',
  'updated_by',
  'completed_at',
  'completed_by',
  'created_at',
  'updated_at',
].join(',');

function aaContactFollowupCreateError({
  code,
  statusCode = 500,
  publicMessage,
  cause,
}) {
  const error =
    new Error(code);

  error.code = code;
  error.statusCode = statusCode;
  error.publicMessage =
    publicMessage || code;
  error.cause = cause;

  return error;
}

function aaContactFollowupErrorResponse(
  res,
  error
) {
  const code =
    String(
      error?.code ||
      error?.message ||
      'CONTACT_FOLLOWUP_ERROR'
    );

  const statusCode =
    Number(error?.statusCode) ||
    500;

  if (statusCode >= 500) {
    console.error(
      '[CONTACT_FOLLOWUP] request failed',
      {
        code,
        cause:
          error?.cause?.code ||
          error?.cause?.message ||
          error?.message ||
          null,
      }
    );
  }

  return res
    .status(statusCode)
    .json({
      success: false,
      error: code,
      message:
        statusCode >= 500
          ? 'Não foi possível processar o retorno programado.'
          : error?.publicMessage ||
            error?.message ||
            'Não foi possível processar o retorno programado.',
    });
}

function aaContactFollowupNormalizeSummary(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value)
      .replace(/\r\n?/g, '\n')
      .trim();

  return normalized || null;
}

function aaContactFollowupSummaryLength(
  value
) {
  return Array.from(
    String(value || '')
  ).length;
}

function aaContactFollowupNormalizeDueAt(
  value
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    throw aaContactFollowupCreateError({
      code:
        'CONTACT_FOLLOWUP_DUE_AT_REQUIRED',
      statusCode: 400,
      publicMessage:
        'Informe a data e o horário do retorno.',
    });
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    throw aaContactFollowupCreateError({
      code:
        'CONTACT_FOLLOWUP_DUE_AT_INVALID',
      statusCode: 400,
      publicMessage:
        'A data e o horário informados são inválidos.',
    });
  }

  return parsed.toISOString();
}

async function aaContactFollowupResolveScope(
  req
) {
  const {
    companyId,
    conversationId,
    conversation,
  } =
    await aaContactInternalNotesResolveScope(
      req
    );

  return {
    companyId,
    conversationId,
    conversation,
    actorUserId:
      aaContactInternalNotesResolveActorUserId(
        req
      ),
  };
}

async function aaContactFollowupFindPending({
  companyId,
  conversationId,
}) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        AA_CONTACT_FOLLOWUP_TABLE
      )
      .select(
        AA_CONTACT_FOLLOWUP_SELECT
      )
      .eq(
        'company_id',
        companyId
      )
      .eq(
        'conversation_id',
        conversationId
      )
      .eq(
        'status',
        'pending'
      )
      .order(
        'due_at',
        {
          ascending: true,
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw aaContactFollowupCreateError({
      code:
        'CONTACT_FOLLOWUP_LOOKUP_FAILED',
      statusCode: 500,
      publicMessage:
        'Não foi possível carregar o retorno programado.',
      cause: error,
    });
  }

  return data || null;
}

function aaContactFollowupPublic(
  row
) {
  if (!row) {
    return null;
  }

  return {
    id:
      row.id || null,

    conversation_id:
      row.conversation_id || null,

    due_at:
      row.due_at || null,

    summary:
      row.summary || null,

    status:
      row.status || null,

    created_by:
      row.created_by || null,

    updated_by:
      row.updated_by || null,

    completed_at:
      row.completed_at || null,

    completed_by:
      row.completed_by || null,

    created_at:
      row.created_at || null,

    updated_at:
      row.updated_at || null,
  };
}

router.get(
  '/conversations/:id/followup',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const scope =
        await aaContactFollowupResolveScope(
          req
        );

      const followup =
        await aaContactFollowupFindPending(
          scope
        );

      return res
        .status(200)
        .json({
          success: true,
          conversation_id:
            scope.conversationId,
          followup:
            aaContactFollowupPublic(
              followup
            ),
        });
    } catch (error) {
      return aaContactFollowupErrorResponse(
        res,
        error
      );
    }
  }
);

router.put(
  '/conversations/:id/followup',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const scope =
        await aaContactFollowupResolveScope(
          req
        );

      const dueAt =
        aaContactFollowupNormalizeDueAt(
          req.body?.due_at ??
          req.body?.dueAt ??
          req.body?.scheduled_at ??
          req.body?.scheduledAt
        );

      const summary =
        aaContactFollowupNormalizeSummary(
          req.body?.summary ??
          req.body?.description ??
          req.body?.context ??
          req.body?.note
        );

      if (
        aaContactFollowupSummaryLength(
          summary
        ) > 500
      ) {
        throw aaContactFollowupCreateError({
          code:
            'CONTACT_FOLLOWUP_SUMMARY_TOO_LONG',
          statusCode: 400,
          publicMessage:
            'O contexto do retorno deve ter no máximo 500 caracteres.',
        });
      }

      const existing =
        await aaContactFollowupFindPending(
          scope
        );

      let saved = null;
      let created = false;

      if (existing?.id) {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              AA_CONTACT_FOLLOWUP_TABLE
            )
            .update({
              due_at:
                dueAt,
              summary:
                summary,
              updated_by:
                scope.actorUserId,
            })
            .eq(
              'id',
              existing.id
            )
            .eq(
              'company_id',
              scope.companyId
            )
            .eq(
              'conversation_id',
              scope.conversationId
            )
            .eq(
              'status',
              'pending'
            )
            .select(
              AA_CONTACT_FOLLOWUP_SELECT
            )
            .single();

        if (error) {
          throw aaContactFollowupCreateError({
            code:
              'CONTACT_FOLLOWUP_UPDATE_FAILED',
            statusCode: 500,
            publicMessage:
              'Não foi possível atualizar o retorno programado.',
            cause: error,
          });
        }

        saved = data;
      } else {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              AA_CONTACT_FOLLOWUP_TABLE
            )
            .insert({
              company_id:
                scope.companyId,
              conversation_id:
                scope.conversationId,
              due_at:
                dueAt,
              summary:
                summary,
              status:
                'pending',
              created_by:
                scope.actorUserId,
              updated_by:
                scope.actorUserId,
            })
            .select(
              AA_CONTACT_FOLLOWUP_SELECT
            )
            .single();

        if (
          error &&
          String(error.code || '') ===
            '23505'
        ) {
          const raced =
            await aaContactFollowupFindPending(
              scope
            );

          if (!raced?.id) {
            throw aaContactFollowupCreateError({
              code:
                'CONTACT_FOLLOWUP_UPSERT_CONFLICT',
              statusCode: 409,
              publicMessage:
                'O retorno foi alterado por outra operação. Tente novamente.',
              cause: error,
            });
          }

          const {
            data: retryData,
            error: retryError,
          } =
            await supabase
              .from(
                AA_CONTACT_FOLLOWUP_TABLE
              )
              .update({
                due_at:
                  dueAt,
                summary:
                  summary,
                updated_by:
                  scope.actorUserId,
              })
              .eq(
                'id',
                raced.id
              )
              .eq(
                'company_id',
                scope.companyId
              )
              .eq(
                'conversation_id',
                scope.conversationId
              )
              .eq(
                'status',
                'pending'
              )
              .select(
                AA_CONTACT_FOLLOWUP_SELECT
              )
              .single();

          if (retryError) {
            throw aaContactFollowupCreateError({
              code:
                'CONTACT_FOLLOWUP_UPSERT_RETRY_FAILED',
              statusCode: 500,
              publicMessage:
                'Não foi possível salvar o retorno programado.',
              cause: retryError,
            });
          }

          saved = retryData;
        } else if (error) {
          throw aaContactFollowupCreateError({
            code:
              'CONTACT_FOLLOWUP_CREATE_FAILED',
            statusCode: 500,
            publicMessage:
              'Não foi possível criar o retorno programado.',
            cause: error,
          });
        } else {
          saved = data;
          created = true;
        }
      }

      return res
        .status(created ? 201 : 200)
        .json({
          success: true,
          created,
          conversation_id:
            scope.conversationId,
          followup:
            aaContactFollowupPublic(
              saved
            ),
        });
    } catch (error) {
      return aaContactFollowupErrorResponse(
        res,
        error
      );
    }
  }
);

router.delete(
  '/conversations/:id/followup',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const scope =
        await aaContactFollowupResolveScope(
          req
        );

      const {
        data,
        error,
      } =
        await supabase
          .from(
            AA_CONTACT_FOLLOWUP_TABLE
          )
          .update({
            status:
              'canceled',
            updated_by:
              scope.actorUserId,
            completed_at:
              null,
            completed_by:
              null,
          })
          .eq(
            'company_id',
            scope.companyId
          )
          .eq(
            'conversation_id',
            scope.conversationId
          )
          .eq(
            'status',
            'pending'
          )
          .select(
            AA_CONTACT_FOLLOWUP_SELECT
          )
          .maybeSingle();

      if (error) {
        throw aaContactFollowupCreateError({
          code:
            'CONTACT_FOLLOWUP_CANCEL_FAILED',
          statusCode: 500,
          publicMessage:
            'Não foi possível cancelar o retorno programado.',
          cause: error,
        });
      }

      return res
        .status(200)
        .json({
          success: true,
          conversation_id:
            scope.conversationId,
          canceled:
            Boolean(data),
          followup:
            aaContactFollowupPublic(
              data
            ),
        });
    } catch (error) {
      return aaContactFollowupErrorResponse(
        res,
        error
      );
    }
  }
);

router.post(
  '/conversations/:id/followup/complete',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const scope =
        await aaContactFollowupResolveScope(
          req
        );

      const completedAt =
        new Date().toISOString();

      const {
        data,
        error,
      } =
        await supabase
          .from(
            AA_CONTACT_FOLLOWUP_TABLE
          )
          .update({
            status:
              'completed',
            completed_at:
              completedAt,
            completed_by:
              scope.actorUserId,
            updated_by:
              scope.actorUserId,
          })
          .eq(
            'company_id',
            scope.companyId
          )
          .eq(
            'conversation_id',
            scope.conversationId
          )
          .eq(
            'status',
            'pending'
          )
          .select(
            AA_CONTACT_FOLLOWUP_SELECT
          )
          .maybeSingle();

      if (error) {
        throw aaContactFollowupCreateError({
          code:
            'CONTACT_FOLLOWUP_COMPLETE_FAILED',
          statusCode: 500,
          publicMessage:
            'Não foi possível concluir o retorno programado.',
          cause: error,
        });
      }

      if (!data) {
        throw aaContactFollowupCreateError({
          code:
            'PENDING_FOLLOWUP_NOT_FOUND',
          statusCode: 404,
          publicMessage:
            'Nenhum retorno pendente foi encontrado para concluir.',
        });
      }

      return res
        .status(200)
        .json({
          success: true,
          completed: true,
          conversation_id:
            scope.conversationId,
          followup:
            aaContactFollowupPublic(
              data
            ),
        });
    } catch (error) {
      return aaContactFollowupErrorResponse(
        res,
        error
      );
    }
  }
);

/* __AUTOATENDE_CONTACT_FOLLOWUP_QUEUE_V1__ */
const AA_CONTACT_FOLLOWUP_QUEUE_MAX_LIMIT = 250;

function aaContactFollowupQueuePickString(source, keys = []) {
  for (const key of keys) {
    const value = source?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (value !== null && value !== undefined && typeof value !== 'object') {
      const text = String(value).trim();

      if (text) {
        return text;
      }
    }
  }

  return '';
}

function aaContactFollowupQueueConversationId(source) {
  return aaContactFollowupQueuePickString(source, [
    'id',
    'conversation_id',
    'conversationId',
    'raw_id',
  ]);
}

function aaContactFollowupQueueContactPayload(conversation = {}) {
  const raw = conversation?.raw || {};

  return {
    id: aaContactFollowupQueueConversationId(conversation),
    contact:
      aaContactFollowupQueuePickString(conversation, [
        'contact',
        'phone',
        'number',
        'remoteJid',
        'jid',
      ]) ||
      aaContactFollowupQueuePickString(raw, [
        'contact',
        'phone',
        'number',
        'remoteJid',
        'jid',
      ]),
    name:
      aaContactFollowupQueuePickString(conversation, [
        'contact_name',
        'contactName',
        'display_name',
        'displayName',
        'name',
        'pushName',
        'title',
      ]) ||
      aaContactFollowupQueuePickString(raw, [
        'contact_name',
        'contactName',
        'display_name',
        'displayName',
        'name',
        'pushName',
        'title',
      ]),
    avatar_url:
      aaContactFollowupQueuePickString(conversation, [
        'avatar_url',
        'avatarUrl',
        'profile_picture_url',
        'profilePictureUrl',
      ]) ||
      aaContactFollowupQueuePickString(raw, [
        'avatar_url',
        'avatarUrl',
        'profile_picture_url',
        'profilePictureUrl',
      ]),
    mode:
      aaContactFollowupQueuePickString(conversation, [
        'mode',
        'attendance_mode',
        'attendanceMode',
      ]) ||
      aaContactFollowupQueuePickString(raw, [
        'mode',
        'attendance_mode',
        'attendanceMode',
      ]),
    label:
      aaContactFollowupQueuePickString(conversation, [
        'label',
        'tag',
        'category',
      ]) ||
      aaContactFollowupQueuePickString(raw, [
        'label',
        'tag',
        'category',
      ]),
    updated_at:
      aaContactFollowupQueuePickString(conversation, [
        'updated_at',
        'updatedAt',
        'last_message_at',
        'lastMessageAt',
      ]) ||
      aaContactFollowupQueuePickString(raw, [
        'updated_at',
        'updatedAt',
        'last_message_at',
        'lastMessageAt',
      ]),
  };
}

function aaContactFollowupQueueBucket(row, now) {
  const due = new Date(row?.due_at);

  if (Number.isNaN(due.getTime())) {
    return 'later';
  }

  if (due.getTime() < now.getTime()) {
    return 'overdue';
  }

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (due.getTime() <= todayEnd.getTime()) {
    return 'today';
  }

  const next7End = new Date(now);
  next7End.setDate(next7End.getDate() + 7);
  next7End.setHours(23, 59, 59, 999);

  if (due.getTime() <= next7End.getTime()) {
    return 'next7';
  }

  return 'later';
}

/* __AUTOATENDE_PHASE6B5B_REAL_DAILY_INDICATORS_V2__:BEGIN */
function aa6b5bV2SafeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function aa6b5bV2GetSupabaseClient() {
  try {
    if (typeof supabase !== 'undefined' && supabase && typeof supabase.from === 'function') return supabase;
  } catch (_) {}

  try {
    if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin && typeof supabaseAdmin.from === 'function') return supabaseAdmin;
  } catch (_) {}

  try {
    if (typeof db !== 'undefined' && db && typeof db.from === 'function') return db;
  } catch (_) {}

  return null;
}

function aa6b5bV2PickString(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';

  for (const key of keys) {
    const value = obj[key];

    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);

    if (value && typeof value === 'object') {
      const nested = aa6b5bV2PickString(value, ['id', 'uuid', 'company_id', 'companyId', 'contact', 'phone', 'number']);
      if (nested) return nested;
    }
  }

  return '';
}

function aa6b5bV2ResolveCompanyId(req, payload) {
  const fromReq =
    aa6b5bV2PickString(req, ['companyId', 'company_id']) ||
    aa6b5bV2PickString(req?.company, ['id', 'company_id', 'companyId']) ||
    aa6b5bV2PickString(req?.user, ['company_id', 'companyId', 'company', 'tenant_id', 'tenantId']) ||
    aa6b5bV2PickString(req?.auth, ['company_id', 'companyId', 'tenant_id', 'tenantId']) ||
    aa6b5bV2PickString(req?.session, ['company_id', 'companyId']);

  if (fromReq) return fromReq;

  const candidates = [];

  if (Array.isArray(payload)) candidates.push(...payload);

  if (payload && typeof payload === 'object') {
    for (const key of ['items', 'rows', 'data', 'followups', 'queue', 'contacts', 'results']) {
      if (Array.isArray(payload[key])) candidates.push(...payload[key]);
    }
  }

  for (const row of candidates) {
    const value =
      aa6b5bV2PickString(row, ['company_id', 'companyId', 'tenant_id', 'tenantId']) ||
      aa6b5bV2PickString(row?.company, ['id', 'company_id', 'companyId']);

    if (value) return value;
  }

  return '';
}

function aa6b5bV2ResolveTodayWindow(query = {}) {
  const now = new Date();

  const rawStart = query.start || query.start_at || query.startAt || '';
  const rawEnd = query.end || query.end_at || query.endAt || '';

  const start = rawStart ? new Date(rawStart) : new Date(now);
  if (!rawStart) start.setHours(0, 0, 0, 0);

  const end = rawEnd ? new Date(rawEnd) : new Date(start);
  if (!rawEnd) end.setDate(end.getDate() + 1);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    const fallbackStart = new Date(now);
    fallbackStart.setHours(0, 0, 0, 0);

    const fallbackEnd = new Date(fallbackStart);
    fallbackEnd.setDate(fallbackEnd.getDate() + 1);

    return {
      startIso: fallbackStart.toISOString(),
      endIso: fallbackEnd.toISOString(),
    };
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function aa6b5bV2Text(row) {
  const parts = [];

  const push = (value) => {
    if (value === null || value === undefined) return;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(String(value));
      return;
    }

    if (typeof value === 'object') {
      try {
        parts.push(JSON.stringify(value));
      } catch (_) {}
    }
  };

  [
    'direction',
    'source',
    'sender',
    'sender_type',
    'senderType',
    'role',
    'type',
    'message_type',
    'messageType',
    'content_type',
    'contentType',
    'template_name',
    'templateName',
    'category',
    'origin',
    'author_type',
    'authorType',
    'metadata',
    'payload',
    'raw',
    'body',
    'content',
    'text',
  ].forEach((key) => push(row?.[key]));

  return parts.join(' ').toLowerCase();
}

function aa6b5bV2ConversationKey(row) {
  return (
    aa6b5bV2PickString(row, [
      'conversation_id',
      'conversationId',
      'conversation_uuid',
      'thread_id',
      'threadId',
      'chat_id',
      'chatId',
      'contact',
      'contact_number',
      'contactNumber',
      'phone',
      'phone_number',
      'phoneNumber',
      'from',
      'wa_id',
      'remoteJid',
    ]) || ''
  );
}

function aa6b5bV2IsTemplate(row) {
  const hay = aa6b5bV2Text(row);

  return (
    hay.includes('template') ||
    hay.includes('disparo') ||
    hay.includes('dispatch') ||
    hay.includes('batch') ||
    hay.includes('campaign') ||
    hay.includes('acquisition') ||
    Boolean(row?.template_name || row?.templateName)
  );
}

function aa6b5bV2IsBot(row) {
  const hay = aa6b5bV2Text(row);

  return (
    hay.includes('bot') ||
    hay.includes('assistant') ||
    hay.includes('assistente') ||
    hay.includes('automation') ||
    hay.includes('automacao') ||
    hay.includes('automação') ||
    hay.includes('autoatende') ||
    hay.includes('ai')
  );
}

function aa6b5bV2IsHuman(row) {
  const hay = aa6b5bV2Text(row);

  return (
    hay.includes('human') ||
    hay.includes('humano') ||
    hay.includes('agent') ||
    hay.includes('agente') ||
    hay.includes('attendant') ||
    hay.includes('atendente') ||
    hay.includes('operator') ||
    hay.includes('operador')
  );
}

async function aa6b5bV2LoadTodayMessages(client, companyId, startIso, endIso) {
  if (!client) {
    return {
      rows: [],
      warning: 'supabase_client_missing',
    };
  }

  if (!companyId) {
    return {
      rows: [],
      warning: 'company_id_missing',
    };
  }

  try {
    let query = client
      .from('messages')
      .select('*')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(2000);

    query = query.eq('company_id', companyId);

    const { data, error } = await query;

    if (error) {
      return {
        rows: [],
        warning: error.message || 'messages_query_failed',
      };
    }

    return {
      rows: Array.isArray(data) ? data : [],
      warning: '',
    };
  } catch (error) {
    return {
      rows: [],
      warning: error?.message || 'messages_query_exception',
    };
  }
}

async function aa6b5bV2LoadConversationStates(client, companyId, startIso, endIso) {
  if (!client) {
    return {
      rows: [],
      humanCurrent: 0,
      humanUpdatedToday: 0,
      warning: 'supabase_client_missing',
    };
  }

  if (!companyId) {
    return {
      rows: [],
      humanCurrent: 0,
      humanUpdatedToday: 0,
      warning: 'company_id_missing',
    };
  }

  try {
    let query = client
      .from('conversation_states')
      .select('*')
      .limit(3000);

    query = query.eq('company_id', companyId);

    const { data, error } = await query;

    if (error) {
      return {
        rows: [],
        humanCurrent: 0,
        humanUpdatedToday: 0,
        warning: error.message || 'conversation_states_query_failed',
      };
    }

    const rows = Array.isArray(data) ? data : [];

    const humanCurrent = rows.filter((row) => {
      return String(row?.mode || '').toLowerCase() === 'human';
    }).length;

    const humanUpdatedToday = rows.filter((row) => {
      if (String(row?.mode || '').toLowerCase() !== 'human') return false;

      const raw = row?.updated_at || row?.created_at || '';
      const dt = new Date(raw);

      if (Number.isNaN(dt.getTime())) return false;

      const iso = dt.toISOString();
      return iso >= startIso && iso < endIso;
    }).length;

    return {
      rows,
      humanCurrent,
      humanUpdatedToday,
      warning: '',
    };
  } catch (error) {
    return {
      rows: [],
      humanCurrent: 0,
      humanUpdatedToday: 0,
      warning: error?.message || 'conversation_states_query_exception',
    };
  }
}

function aa6b5bV2FallbackSummary(reason) {
  const now = new Date();

  return {
    conversations_today: 0,
    conversationsToday: 0,
    bot_responses_today: 0,
    botResponsesToday: 0,
    human_today: 0,
    humanToday: 0,
    human_interactions_today: 0,
    templates_today: 0,
    templateSendsToday: 0,
    dispatches_today: 0,
    current_human_conversations: 0,
    generated_at: now.toISOString(),
    source: 'fallback',
    quality: 'partial',
    warnings: [reason || 'summary_fallback'],
  };
}

async function aa6b5bV2BuildDashboardDailyIndicators(req, payload) {
  const client = aa6b5bV2GetSupabaseClient();
  const companyId = aa6b5bV2ResolveCompanyId(req, payload);
  const { startIso, endIso } = aa6b5bV2ResolveTodayWindow(req?.query || {});
  const warnings = [];

  const messagesResult = await aa6b5bV2LoadTodayMessages(client, companyId, startIso, endIso);
  if (messagesResult.warning) warnings.push('messages:' + messagesResult.warning);

  const statesResult = await aa6b5bV2LoadConversationStates(client, companyId, startIso, endIso);
  if (statesResult.warning) warnings.push('conversation_states:' + statesResult.warning);

  const messages = Array.isArray(messagesResult.rows) ? messagesResult.rows : [];
  const conversationKeys = new Set();

  let botResponses = 0;
  let humanInteractions = 0;
  let templateSends = 0;

  for (const row of messages) {
    const key = aa6b5bV2ConversationKey(row);
    if (key) conversationKeys.add(key);

    if (aa6b5bV2IsBot(row)) botResponses += 1;
    if (aa6b5bV2IsHuman(row)) humanInteractions += 1;
    if (aa6b5bV2IsTemplate(row)) templateSends += 1;
  }

  const humanToday =
    humanInteractions > 0
      ? humanInteractions
      : aa6b5bV2SafeNumber(statesResult.humanUpdatedToday || statesResult.humanCurrent);

  return {
    conversations_today: conversationKeys.size,
    conversationsToday: conversationKeys.size,

    bot_responses_today: botResponses,
    botResponsesToday: botResponses,

    human_today: humanToday,
    humanToday: humanToday,
    human_interactions_today: humanToday,

    templates_today: templateSends,
    templateSendsToday: templateSends,
    dispatches_today: templateSends,

    current_human_conversations: aa6b5bV2SafeNumber(statesResult.humanCurrent),
    generated_at: new Date().toISOString(),
    range_start: startIso,
    range_end: endIso,
    source: 'messages_and_conversation_states',
    quality: warnings.length ? 'partial' : 'ok',
    warnings,
  };
}

function aa6b5bV2QueueSummaryMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function aa6b5bV2JsonWithDashboardSummary(payload) {
    Promise.resolve()
      .then(async () => {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          return originalJson(payload);
        }

        if (payload.summary && typeof payload.summary === 'object') {
          return originalJson(payload);
        }

        const summary = await aa6b5bV2BuildDashboardDailyIndicators(req, payload);

        return originalJson({
          ...payload,
          summary,
        });
      })
      .catch((error) => {
        return originalJson({
          ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
          summary: aa6b5bV2FallbackSummary(error?.message || 'summary_build_failed'),
        });
      });

    return res;
  };

  return next();
}

router.use('/followups/queue', aa6b5bV2QueueSummaryMiddleware);
/* __AUTOATENDE_PHASE6B5B_REAL_DAILY_INDICATORS_V2__:END */



router.get(
  '/followups/queue',
  aaContactInternalNotesRequireAuth,
  async (req, res) => {
    try {
      const companyId = resolveCompanyId(req);

      if (!companyId) {
        return res.status(401).json({
          ok: false,
          error: 'UNAUTHORIZED_COMPANY_CONTEXT_MISSING',
        });
      }

      const rawLimit = Number.parseInt(
        String(req.query?.limit || ''),
        10
      );

      const limit = Math.max(
        1,
        Math.min(
          Number.isFinite(rawLimit) && rawLimit > 0
            ? rawLimit
            : 120,
          AA_CONTACT_FOLLOWUP_QUEUE_MAX_LIMIT
        )
      );

      const { data, error } = await supabase
        .from(AA_CONTACT_FOLLOWUP_TABLE)
        .select(AA_CONTACT_FOLLOWUP_SELECT)
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('due_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error(
          '[CONTACT_FOLLOWUP_QUEUE] fetch_failed',
          error
        );

        return res.status(500).json({
          ok: false,
          error: 'CONTACT_FOLLOWUP_QUEUE_FETCH_FAILED',
          message:
            'Não foi possível carregar a fila de retornos.',
        });
      }

      const rows = Array.isArray(data) ? data : [];
      let conversations = [];

      try {
        const listed = await inboxService.listConversations(
          companyId,
          ''
        );

        conversations = Array.isArray(listed) ? listed : [];
      } catch (error) {
        console.warn(
          '[CONTACT_FOLLOWUP_QUEUE] conversation_enrichment_failed',
          error
        );
      }

      const conversationIndex = new Map();

      for (const conversation of conversations) {
        const id = aaContactFollowupQueueConversationId(
          conversation
        );

        if (id) {
          conversationIndex.set(String(id), conversation);
        }
      }

      const now = new Date();
      const buckets = {
        overdue: [],
        today: [],
        next7: [],
        later: [],
      };

      const items = rows.map((row) => {
        const conversation =
          conversationIndex.get(String(row.conversation_id || '')) ||
          {};

        const item = {
          id: row.id || null,
          company_id: row.company_id || null,
          conversation_id: row.conversation_id || null,
          due_at: row.due_at || null,
          summary: row.summary || '',
          status: row.status || 'pending',
          completed_at: row.completed_at || null,
          created_at: row.created_at || null,
          updated_at: row.updated_at || null,
          contact:
            aaContactFollowupQueueContactPayload(conversation),
        };

        const bucket = aaContactFollowupQueueBucket(
          row,
          now
        );

        item.bucket = bucket;
        buckets[bucket].push(item);

        return item;
      });

      const counts = {
        total: items.length,
        overdue: buckets.overdue.length,
        today: buckets.today.length,
        next7: buckets.next7.length,
        later: buckets.later.length,
      };

      return res.json({
        ok: true,
        generated_at: now.toISOString(),
        limit,
        counts,
        buckets,
        items,
      });
    } catch (error) {
      console.error(
        '[CONTACT_FOLLOWUP_QUEUE] unexpected_error',
        error
      );

      return res.status(500).json({
        ok: false,
        error: 'CONTACT_FOLLOWUP_QUEUE_UNEXPECTED_ERROR',
        message:
          'Não foi possível carregar a fila de retornos.',
      });
    }
  }
);
/* END __AUTOATENDE_CONTACT_FOLLOWUP_QUEUE_V1__ */

/* END __AUTOATENDE_CONTACT_FOLLOWUP_BACKEND_V1__ */


module.exports = router;

// __AUTOATENDE_V4_R15A_R2B_CONVERSATION_LABELS_BACKEND_AFTER_MANUAL_SQL__

// __AUTOATENDE_V4_R15A_R2C_FIX_INBOX_LABELS_ROUTE_MOUNT__
