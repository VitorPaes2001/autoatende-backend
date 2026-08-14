const supabase = require('../config/supabase');

// __AUTOATENDE_C16N_C16G_R2_CONVERSATION_STATES_CONTACT_COLUMN_FIX_AND_SMOKE_RESUME__

const CONVERSATION_STATES_TABLE = 'conversation_states';
const STATE_CONTACT_COLUMN_CACHE = new Map();

function firstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function normalizeContact(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\D+/g, '');
}

function collectCandidatesFromItem(item) {
  return [
    item?.contact_number,
    item?.contactNumber,
    item?.contact,
    item?.phone,
    item?.phone_number,
    item?.customer_phone,
    item?.wa_id,
    item?.remote_jid,
    item?.contact?.phone,
    item?.contact?.number,
  ].map(normalizeContact).filter(Boolean);
}

function resolveCompanyIdFromArgs(args, result) {
  const candidates = [];
  const safeArgs = Array.isArray(args) ? args : [];

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

  return firstDefined(candidates) ?? null;
}

/* __AUTOATENDE_C16N_C16G_R5_POSITIONAL_COMPANYID_BINDING_FIX_AND_PROJECTION_PROOF__ */

function extractItemsTarget(result) {
  if (Array.isArray(result)) return { type: 'array', items: result };
  if (!result || typeof result !== 'object') return { type: 'none', items: null };
  if (Array.isArray(result.conversations)) return { type: 'conversations', items: result.conversations };
  if (Array.isArray(result.items)) return { type: 'items', items: result.items };
  if (Array.isArray(result.data)) return { type: 'data', items: result.data };
  return { type: 'none', items: null };
}

function projectAuthority(baseItem, stateRow) {
  if (!stateRow || typeof stateRow !== 'object') {
    return {
      ...baseItem,
      authority_source: baseItem?.authority_source || 'base_read_model',
    };
  }

  const projected = { ...baseItem };

  const authoritativeMode = firstDefined([
    stateRow.mode,
    stateRow.current_mode,
  ]);

  const authoritativeStatus = firstDefined([
    stateRow.status,
    stateRow.current_status,
  ]);

  const authoritativeOwner = firstDefined([
    stateRow.assigned_to,
    stateRow.owner_id,
    stateRow.agent_id,
    stateRow.assigned_user_id,
  ]);

  if (authoritativeMode !== undefined) {
    projected.mode = authoritativeMode;
  }

  if (authoritativeStatus !== undefined) {
    projected.status = authoritativeStatus;
  }

  if (authoritativeOwner !== undefined) {
    projected.owner_id = authoritativeOwner;
    projected.assigned_to = authoritativeOwner;
    projected.assignedTo = authoritativeOwner;
  }

  projected.authority_source = 'conversation_states';

  return projected;
}

async function detectStateContactColumn(companyId) {
  if (!companyId) return null;
  if (STATE_CONTACT_COLUMN_CACHE.has(companyId)) {
    return STATE_CONTACT_COLUMN_CACHE.get(companyId);
  }

  if (!supabase || typeof supabase.from !== 'function') {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(CONVERSATION_STATES_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .limit(1);

    if (error || !Array.isArray(data) || !data.length) {
      STATE_CONTACT_COLUMN_CACHE.set(companyId, null);
      return null;
    }

    const row = data[0] || {};
    const keys = Object.keys(row);

    const candidates = [
      'contact_number',
      'contact',
      'phone',
      'phone_number',
      'customer_phone',
      'wa_id',
      'remote_jid',
    ];

    const found = candidates.find((key) => keys.includes(key)) || null;
    STATE_CONTACT_COLUMN_CACHE.set(companyId, found);
    return found;
  } catch (_error) {
    STATE_CONTACT_COLUMN_CACHE.set(companyId, null);
    return null;
  }
}

async function fetchConversationStatesByContacts(companyId, items) {
  if (!companyId || !Array.isArray(items) || !items.length) {
    return new Map();
  }

  if (!supabase || typeof supabase.from !== 'function') {
    return new Map();
  }

  const contacts = Array.from(
    new Set(items.flatMap(collectCandidatesFromItem).filter(Boolean))
  );

  if (!contacts.length) {
    return new Map();
  }

  const contactColumn = await detectStateContactColumn(companyId);
  if (!contactColumn) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from(CONVERSATION_STATES_TABLE)
      .select('*')
      .eq('company_id', companyId)
      .in(contactColumn, contacts);

    if (error || !Array.isArray(data)) {
      return new Map();
    }

    const map = new Map();
    for (const row of data) {
      const key = normalizeContact(row?.[contactColumn]);
      if (key) map.set(key, row);
    }
    return map;
  } catch (_error) {
    return new Map();
  }
}

async function normalizeOperationalAuthorityResult({ result, args }) {
  const target = extractItemsTarget(result);
  if (!target.items) return result;

  const companyId = resolveCompanyIdFromArgs(args, result);
  if (!companyId) return result;

  const statesByContact = await fetchConversationStatesByContacts(companyId, target.items);
  if (!statesByContact.size) return result;

  const projected = target.items.map((item) => {
    const contactKey = collectCandidatesFromItem(item)[0];
    if (!contactKey) return item;
    const stateRow = statesByContact.get(contactKey);
    return projectAuthority(item, stateRow);
  });

  if (target.type === 'array') return projected;

  return {
    ...result,
    [target.type]: projected,
  };
}

module.exports = {
  normalizeOperationalAuthorityResult,
  detectStateContactColumn,
};
