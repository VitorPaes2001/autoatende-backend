'use strict';

const { createClient } = require('@supabase/supabase-js');

const ADMIN_UNAVAILABLE_CODE = 'SUPABASE_ADMIN_UNAVAILABLE';
const ADMIN_UNAVAILABLE_MESSAGE = 'Supabase admin indisponível.';

let supabaseAdminClient = null;

function createSupabaseAdminUnavailableError() {
  const error = new Error(ADMIN_UNAVAILABLE_MESSAGE);
  error.name = 'SupabaseAdminUnavailableError';
  error.code = ADMIN_UNAVAILABLE_CODE;
  error.statusCode = 503;
  delete error.stack;
  return error;
}

function isSupabaseAdminUnavailableError(error) {
  return Boolean(
    error &&
    error.name === 'SupabaseAdminUnavailableError' &&
    error.code === ADMIN_UNAVAILABLE_CODE &&
    Number(error.statusCode) === 503
  );
}

function isValidSupabaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    const parsed = new URL(value.trim());
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname);
  } catch (_) {
    return false;
  }
}

function isLikelyServiceRoleKey(value) {
  if (typeof value !== 'string') return false;
  const key = value.trim();
  return key.length >= 20 && !/\s/.test(key);
}

function getSupabaseAdminConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!isValidSupabaseUrl(url) || !isLikelyServiceRoleKey(key)) {
    throw createSupabaseAdminUnavailableError();
  }

  return Object.freeze({ url, key });
}

function isUsableAdminClient(client) {
  return Boolean(
    client &&
    typeof client.from === 'function' &&
    typeof client.rpc === 'function' &&
    typeof client.auth?.getUser === 'function' &&
    typeof client.auth?.admin?.createUser === 'function' &&
    typeof client.auth?.admin?.deleteUser === 'function' &&
    typeof client.storage?.from === 'function'
  );
}

function getSupabaseAdminClient() {
  if (supabaseAdminClient) return supabaseAdminClient;

  const { url, key } = getSupabaseAdminConfig();
  let client;

  try {
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (_) {
    throw createSupabaseAdminUnavailableError();
  }

  if (!isUsableAdminClient(client)) {
    throw createSupabaseAdminUnavailableError();
  }

  supabaseAdminClient = client;
  return supabaseAdminClient;
}

const authAdminFacade = Object.freeze({
  createUser(...args) {
    return getSupabaseAdminClient().auth.admin.createUser(...args);
  },
  deleteUser(...args) {
    return getSupabaseAdminClient().auth.admin.deleteUser(...args);
  },
});

const authFacade = Object.freeze({
  getUser(...args) {
    return getSupabaseAdminClient().auth.getUser(...args);
  },
  admin: authAdminFacade,
});

const storageFacade = Object.freeze({
  from(...args) {
    return getSupabaseAdminClient().storage.from(...args);
  },
});

const supabaseFacade = {
  from(...args) {
    return getSupabaseAdminClient().from(...args);
  },
  rpc(...args) {
    return getSupabaseAdminClient().rpc(...args);
  },
  auth: authFacade,
  storage: storageFacade,
};

module.exports = supabaseFacade;
module.exports.getSupabaseAdminClient = getSupabaseAdminClient;
module.exports.getSupabaseAdminConfig = getSupabaseAdminConfig;
module.exports.createSupabaseAdminUnavailableError = createSupabaseAdminUnavailableError;
module.exports.isSupabaseAdminUnavailableError = isSupabaseAdminUnavailableError;
