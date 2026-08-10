const express = require('express');
const {
  getSupabaseAdminConfig,
  isSupabaseAdminUnavailableError
} = require('../config/supabase');

const router = express.Router();

const MARKER = '__AUTOATENDE_V4_R15A_R2C_FIX_INBOX_LABELS_ROUTE_MOUNT__';

function tryRequire(candidates) {
  for (const candidate of candidates) {
    try {
      const mod = require(candidate);
      if (mod) return mod;
    } catch (_) {}
  }
  return null;
}

function normalizeMiddleware(mod, exportNames = []) {
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.default === 'function') return mod.default;

  for (const name of exportNames) {
    if (mod && typeof mod[name] === 'function') return mod[name];
  }

  return null;
}

const authModule = tryRequire([
  '../middlewares/auth.middleware',
  '../middlewares/authMiddleware',
  '../middlewares/auth',
  '../middleware/auth.middleware',
  '../middleware/authMiddleware',
  '../middleware/auth'
]);

const roleModule = tryRequire([
  '../middlewares/requireRole.middleware',
  '../middlewares/role.middleware',
  '../middlewares/roles.middleware',
  '../middlewares/rbac.middleware',
  '../middlewares/auth.middleware',
  '../middlewares/auth'
]);

const authMiddleware = normalizeMiddleware(authModule, ['authMiddleware', 'auth', 'authenticate', 'requireAuth']);
const requireRoleRaw = normalizeMiddleware(roleModule, ['requireRole', 'roleMiddleware', 'rolesMiddleware']);

if (!authMiddleware) {
  throw new Error('[inboxLabels.routes] auth middleware not found');
}

if (!requireRoleRaw) {
  throw new Error('[inboxLabels.routes] requireRole middleware not found');
}

const requireRole = (...args) => {
  const mw = requireRoleRaw(...args);
  return typeof mw === 'function' ? mw : requireRoleRaw;
};

const roleGuard = requireRole(['company', 'admin', 'owner', 'manager', 'agent']);

const LABEL_CATALOG = [
  { key: 'novo_lead', label: 'Novo lead', tone: 'green' },
  { key: 'aguardando_cliente', label: 'Aguardando cliente', tone: 'blue' },
  { key: 'aguardando_equipe', label: 'Aguardando equipe', tone: 'amber' },
  { key: 'resolvido', label: 'Resolvido', tone: 'emerald' },
  { key: 'urgente', label: 'Urgente', tone: 'red' },
  { key: 'comercial', label: 'Comercial', tone: 'teal' },
  { key: 'suporte', label: 'Suporte', tone: 'slate' },
  { key: 'financeiro', label: 'Financeiro', tone: 'violet' }
];

const ALLOWED_KEYS = new Set(LABEL_CATALOG.map((item) => item.key));
const LABEL_BY_NAME = new Map(
  LABEL_CATALOG.flatMap((item) => [
    [item.label.toLowerCase(), item.key],
    [item.key.toLowerCase(), item.key]
  ])
);

function resolveCompanyId(req) {
  return (
    req?.companyId ||
    req?.company_id ||
    req?.tenant?.company_id ||
    req?.tenant?.companyId ||
    req?.user?.company_id ||
    req?.user?.companyId ||
    req?.user?.user_metadata?.company_id ||
    req?.user?.app_metadata?.company_id ||
    req?.user?.client_id ||
    req?.user?.clientId ||
    req?.user?.user_metadata?.client_id ||
    req?.user?.app_metadata?.client_id ||
    null
  );
}

function normalizeContact(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

/* __AUTOATENDE_V4_R33B_R1_FREEFORM_INBOX_LABELS_NODE_VALIDATION_FIX___BACKEND */
function normalizeLabelKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const mapped = LABEL_BY_NAME.get(lower) || raw;

  const cleaned = String(mapped || '')
    .normalize('NFKC')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);

  if (!cleaned) return null;

  const legacyKey = cleaned.toLowerCase().replace(/\s+/g, '_');
  if (LABEL_BY_NAME.has(cleaned.toLowerCase())) return LABEL_BY_NAME.get(cleaned.toLowerCase());
  if (ALLOWED_KEYS.has(legacyKey)) return legacyKey;

  return cleaned;
}function sanitizeLabels(input) {
  const arr = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? [input]
      : [];

  const out = [];

  for (const item of arr) {
    const key = typeof item === 'object' && item !== null
      ? normalizeLabelKey(item.key || item.label || item.name)
      : normalizeLabelKey(item);

    if (key && !out.includes(key)) out.push(key);
  }

  return out.slice(0, 5);
}

async function supabaseRest(path, options = {}) {
  const { url, key } = getSupabaseAdminConfig();

  const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }

  if (!response.ok) {
    const err = new Error('SUPABASE_REST_ERROR');
    err.statusCode = response.status;
    err.details = body;
    throw err;
  }

  return body;
}

function encodeEq(value) {
  return encodeURIComponent(String(value));
}

router.get('/catalog', authMiddleware, roleGuard, (req, res) => {
  return res.status(200).json({
    ok: true,
    marker: MARKER,
    labels: LABEL_CATALOG
  });
});

router.get('/', authMiddleware, roleGuard, async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const contact = normalizeContact(req.query?.contact);

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    if (!contact) {
      return res.status(400).json({ error: 'Missing contact' });
    }

    const rows = await supabaseRest(
      `/conversation_states?select=id,company_id,contact,labels,updated_at&company_id=eq.${encodeEq(companyId)}&contact=eq.${encodeEq(contact)}&limit=1`
    );

    const row = Array.isArray(rows) ? rows[0] : null;

    return res.status(200).json({
      ok: true,
      marker: MARKER,
      contact,
      labels: sanitizeLabels(row?.labels || []),
      found: Boolean(row),
      updated_at: row?.updated_at || null
    });
  } catch (error) {
    if (isSupabaseAdminUnavailableError(error)) {
      return res.status(503).json({
        error: 'Supabase admin indisponível.',
        code: 'SUPABASE_ADMIN_UNAVAILABLE'
      });
    }

    console.error('[inboxLabels.get]', error?.details || error?.message || error);

    return res.status(error?.statusCode || 500).json({
      error: 'Failed to fetch conversation labels',
      details: error?.details || error?.message || null
    });
  }
});

router.patch('/', authMiddleware, roleGuard, async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const contact = normalizeContact(req.body?.contact || req.query?.contact);
    const labels = sanitizeLabels(req.body?.labels);

    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    if (!contact) {
      return res.status(400).json({ error: 'Missing contact' });
    }

    const rows = await supabaseRest(
      `/conversation_states?company_id=eq.${encodeEq(companyId)}&contact=eq.${encodeEq(contact)}&select=id,company_id,contact,labels,updated_at`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          labels,
          updated_at: new Date().toISOString()
        })
      }
    );

    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row) {
      return res.status(404).json({
        error: 'Conversation state not found',
        contact
      });
    }

    return res.status(200).json({
      ok: true,
      marker: MARKER,
      contact,
      labels: sanitizeLabels(row.labels || labels),
      updated_at: row.updated_at || null
    });
  } catch (error) {
    if (isSupabaseAdminUnavailableError(error)) {
      return res.status(503).json({
        error: 'Supabase admin indisponível.',
        code: 'SUPABASE_ADMIN_UNAVAILABLE'
      });
    }

    console.error('[inboxLabels.patch]', error?.details || error?.message || error);

    return res.status(error?.statusCode || 500).json({
      error: 'Failed to update conversation labels',
      details: error?.details || error?.message || null
    });
  }
});

module.exports = router;
