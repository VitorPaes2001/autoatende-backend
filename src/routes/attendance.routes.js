const express = require('express');
const router = express.Router();

// __AUTOATENDE_C7E_R2_R2_CONTAINER_SAFE_PREFLIGHT__
function __aaNormalizeConversationContact(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) return digits;

  return raw;
}

function __aaCanonicalizeAttendancePayload(body = {}, path = '') {
  const next = { ...(body || {}) };

  const canonicalContact = __aaNormalizeConversationContact(
    next.contact ??
    next.contact_phone ??
    next.contactPhone ??
    next.phone ??
    next.phone_number ??
    next.phoneNumber ??
    next.customer_phone ??
    next.customerPhone ??
    next.chat_id ??
    next.chatId ??
    next.remoteJid ??
    next.remote_jid
  );

  if (canonicalContact) {
    next.contact = canonicalContact;
    next.contact_phone = canonicalContact;
    next.contactPhone = canonicalContact;
    next.phone = canonicalContact;
    next.phone_number = canonicalContact;
    next.phoneNumber = canonicalContact;
    next.customer_phone = canonicalContact;
    next.customerPhone = canonicalContact;
    next.chat_id = canonicalContact;
    next.chatId = canonicalContact;
    next.normalized_contact = canonicalContact;
    next.conversation_contact = canonicalContact;
  }

  const canonicalAssignedAgentId =
    next.assignedAgentId ??
    next.assigned_agent_id ??
    next.ownerId ??
    next.owner_id ??
    next.agentId ??
    next.agent_id ??
    next.userId ??
    next.user_id ??
    null;

  if (path === '/return/bot') {
    next.assignedAgentId = null;
    next.assigned_agent_id = null;
    next.ownerId = null;
    next.owner_id = null;
    next.agentId = null;
    next.agent_id = null;
    next.userId = null;
    next.user_id = null;
  } else if (canonicalAssignedAgentId != null && canonicalAssignedAgentId != '') {
    next.assignedAgentId = canonicalAssignedAgentId;
    next.assigned_agent_id = canonicalAssignedAgentId;
    next.ownerId = canonicalAssignedAgentId;
    next.owner_id = canonicalAssignedAgentId;
    next.agentId = canonicalAssignedAgentId;
    next.agent_id = canonicalAssignedAgentId;
    next.userId = canonicalAssignedAgentId;
    next.user_id = canonicalAssignedAgentId;
  }

  return next;
}

// __AUTOATENDE_C8A_R1_OWNER_ENVELOPE_NORMALIZATION__
function aaFirstDefined(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return null;
}

function aaSetContactAliases(body, contact) {
  if (!body || contact === null || contact === undefined) return;
  const normalized = String(contact).trim();
  const keys = [
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
    'conversation_contact'
  ];
  for (const key of keys) body[key] = normalized;
}

function aaSetOwnerAliases(body, owner) {
  if (!body) return;
  const normalized = owner === undefined ? null : owner;
  const keys = [
    'assignedAgentId',
    'assigned_agent_id',
    'ownerId',
    'owner_id',
    'agentId',
    'agent_id',
    'userId',
    'user_id'
  ];
  for (const key of keys) body[key] = normalized;
}

function attendanceWriteEnvelopeMiddleware(action) {
  return (req, res, next) => {
    try {
      req.body = req.body && typeof req.body === 'object' ? req.body : {};
      const body = req.body;

      const contact = aaFirstDefined(
        body.contact,
        body.contact_phone,
        body.contactPhone,
        body.phone,
        body.phone_number,
        body.phoneNumber,
        body.customer_phone,
        body.customerPhone,
        body.chat_id,
        body.chatId,
        body.normalized_contact,
        body.conversation_contact
      );

      if (contact !== null) {
        aaSetContactAliases(body, contact);
      }

      let owner = aaFirstDefined(
        body.assignedAgentId,
        body.assigned_agent_id,
        body.ownerId,
        body.owner_id,
        body.agentId,
        body.agent_id,
        body.userId,
        body.user_id
      );

      if (action === 'transfer_human' || action === 'return_bot') {
        owner = null;
        aaSetOwnerAliases(body, null);
      } else if (action === 'transfer_agent') {
        if (owner !== null) {
          aaSetOwnerAliases(body, owner);
        }
      }

      console.info(
        '[C8A_R1_OWNER_ENVELOPE] ' +
        'action=' + action +
        ' contact=' + (contact === null ? 'null' : String(contact)) +
        ' owner=' + (owner === null ? 'null' : String(owner))
      );

      return next();
    } catch (error) {
      console.error('[C8A_R1_OWNER_ENVELOPE][ERROR]', error?.message || error);
      return next();
    }
  };
}

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

// __AUTOATENDE_C8A_R3_TRANSFER_AGENT_OWNER_REQUIRED__
function aaFirstDefinedAgentAssign(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return null;
}

function aaSetOwnerIdAliasesAgentAssign(body, ownerId) {
  if (!body) return;
  const normalized = ownerId === null || ownerId === undefined ? null : String(ownerId).trim();
  const keys = [
    'assigned_user_id',
    'assignedAgentId',
    'assigned_agent_id',
    'ownerId',
    'owner_id',
    'agentId',
    'agent_id',
    'userId',
    'user_id',
    'responsible_user_id',
    'responsavel_id',
    'targetAgentId',
    'target_agent_id',
    'assigneeId',
    'assignee_id'
  ];
  for (const key of keys) body[key] = normalized;
}

function aaSetOwnerNameAliasesAgentAssign(body, ownerName) {
  if (!body) return;
  const normalized = ownerName === null || ownerName === undefined || String(ownerName).trim() === ''
    ? null
    : String(ownerName).trim();

  const keys = [
    'assigned_user_name',
    'assignedAgentName',
    'assigned_agent_name',
    'ownerName',
    'owner_name',
    'agentName',
    'agent_name',
    'userName',
    'user_name',
    'responsible_user_name',
    'responsavel_nome',
    'targetAgentName',
    'target_agent_name',
    'assigneeName',
    'assignee_name'
  ];
  for (const key of keys) body[key] = normalized;
}

function attendanceRequireOwnerForTransferAgent(req, res, next) {
  try {
    req.body = req.body && typeof req.body === 'object' ? req.body : {};
    const body = req.body;

    const ownerId = aaFirstDefinedAgentAssign(
      body.assigned_user_id,
      body.assignedAgentId,
      body.assigned_agent_id,
      body.ownerId,
      body.owner_id,
      body.agentId,
      body.agent_id,
      body.userId,
      body.user_id,
      body.responsible_user_id,
      body.responsavel_id,
      body.targetAgentId,
      body.target_agent_id,
      body.assigneeId,
      body.assignee_id
    );

    const ownerName = aaFirstDefinedAgentAssign(
      body.assigned_user_name,
      body.assignedAgentName,
      body.assigned_agent_name,
      body.ownerName,
      body.owner_name,
      body.agentName,
      body.agent_name,
      body.userName,
      body.user_name,
      body.responsible_user_name,
      body.responsavel_nome,
      body.targetAgentName,
      body.target_agent_name,
      body.assigneeName,
      body.assignee_name
    );

    if (ownerId === null) {
      return res.status(400).json({
        success: false,
        error: 'ATTENDANCE_TRANSFER_AGENT_OWNER_REQUIRED',
        code: 'ATTENDANCE_TRANSFER_AGENT_OWNER_REQUIRED',
        message: 'É obrigatório informar o agente de destino em /attendance/transfer/agent.'
      });
    }

    aaSetOwnerIdAliasesAgentAssign(body, ownerId);
    aaSetOwnerNameAliasesAgentAssign(body, ownerName);

    body.resolved_owner_id = String(ownerId).trim();
    body.resolved_owner_name =
      ownerName === null || ownerName === undefined || String(ownerName).trim() === ''
        ? null
        : String(ownerName).trim();

    const contact = aaFirstDefinedAgentAssign(
      body.contact,
      body.contact_phone,
      body.contactPhone,
      body.phone,
      body.phone_number,
      body.phoneNumber,
      body.customer_phone,
      body.customerPhone,
      body.chat_id,
      body.chatId,
      body.normalized_contact,
      body.conversation_contact
    );

    console.info(
      '[C8A_R3_AGENT_ASSIGNMENT] ' +
      'contact=' + (contact === null ? 'null' : String(contact)) +
      ' owner=' + String(body.resolved_owner_id) +
      ' owner_name=' + (body.resolved_owner_name === null ? 'null' : String(body.resolved_owner_name))
    );

    return next();
  } catch (error) {
    console.error('[C8A_R3_AGENT_ASSIGNMENT][ERROR]', error?.message || error);
    return next();
  }
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
    /* __AUTOATENDE_V4_R16D_B2_SANITIZE_ATTENDANCE_ERROR_ENVELOPE_RETRY_HEALTH__ */
    const aaR16dB2StatusCode = Number(res.statusCode || 200);
    if (aaR16dB2StatusCode >= 400) {
      return originalJson(payload);
    }

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











router.use((req, _res, next) => {
  const eligibleMethod = ['POST', 'PUT', 'PATCH'].includes(req.method);
  if (!eligibleMethod) return next();

  const eligiblePath = ['/transfer/human', '/transfer/agent', '/return/bot'].includes(req.path);
  if (!eligiblePath) return next();

  req.body = __aaCanonicalizeAttendancePayload(req.body || {}, req.path);
  return next();
});

const attendanceController = require('../controllers/attendance.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const rateLimit = require('../middlewares/rateLimit.middleware');
const auditLogger = require('../middlewares/audit.middleware');
const { requirePlan } = require('../middlewares/plan.middleware');

// Rotas de controle de atendimento
// Auth + RBAC + Audit + RateLimit + Plan

// Todos os perfis (agent, company, admin) podem operar o atendimento
const allowedRoles = ['agent', 'company', 'admin'];

router.use(responseOwnerProjectionMiddleware('attendance'));

router.use(responseOwnerFlagsProjectionMiddleware('attendance'));

router.use(responseOperationalRosterProjectionMiddleware('attendance'));

router.post('/transfer/human', attendanceWriteEnvelopeMiddleware('transfer_human'), 
  authMiddleware, 
  requireRole(allowedRoles), 
  requirePlan('start'),
  rateLimit(50, 60), 
  auditLogger,
  attendanceController.transferToHuman
);

router.post('/transfer/agent', attendanceWriteEnvelopeMiddleware('transfer_agent'), attendanceRequireOwnerForTransferAgent, 
  authMiddleware, 
  requireRole(allowedRoles), 
  requirePlan('start'),
  rateLimit(50, 60),
  auditLogger,
  attendanceController.transferToAgent
);

router.post('/return/bot', attendanceWriteEnvelopeMiddleware('return_bot'), 
  authMiddleware, 
  requireRole(allowedRoles), 
  requirePlan('start'),
  rateLimit(50, 60),
  auditLogger,
  attendanceController.returnToBot
);

router.get('/state', 
  authMiddleware, 
  requireRole(allowedRoles),
  requirePlan('start'),
  rateLimit(100, 60),
  attendanceController.getState
);

module.exports = router;
