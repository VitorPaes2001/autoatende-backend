const STORAGE_KEY = 'autoatende_acquisition_context';
const ALLOWED_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'refhost',
  'src',
  'lp',
  'click_id',
  'tracking_key',
  'session_key'
];

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readStorage(storage) {
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  return safeParse(raw);
}

function getIncomingContext() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search || '');
  const ctx = {};

  for (const key of ALLOWED_KEYS) {
    const value = params.get(key);
    if (value && String(value).trim() !== '') {
      ctx[key] = value;
    }
  }

  if (!ctx.refhost) {
    try {
      ctx.refhost = document.referrer ? (new URL(document.referrer)).hostname || '' : '';
    } catch {
      ctx.refhost = '';
    }
  }

  ctx.entry_path = window.location.pathname || '';
  ctx.entry_url = window.location.href || '';
  ctx.captured_at = new Date().toISOString();

  return ctx;
}

export function readAcquisitionContext() {
  if (typeof window === 'undefined') return null;
  return (
    readStorage(window.sessionStorage) ||
    readStorage(window.localStorage) ||
    null
  );
}

export function bootAcquisitionAttributionCapture() {
  if (typeof window === 'undefined') return null;

  const existing = readAcquisitionContext() || {};
  const incoming = getIncomingContext();

  const merged = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(incoming).filter(([_, value]) => value != null && String(value).trim() !== '')
    )
  };

  const hasMeaningfulTracking = ALLOWED_KEYS.some((key) => {
    const value = merged[key];
    return value != null && String(value).trim() !== '';
  });

  if (!hasMeaningfulTracking) return existing || null;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.__AUTOATENDE_ACQUISITION__ = merged;

  try {
      const runtimeBinding =
        window.__AUTOATENDE_AUTH__ ||
        window.__AUTOATENDE_SESSION__ ||
        window.__AUTOATENDE_USER__ ||
        {};
      scheduleBackendAcquisitionBind(runtimeBinding, merged);
    } catch (error) {
      console.warn('[R10C-C2] backend bind schedule failed', error);
    }

  return merged;
}
const AUTH_BRIDGE_MARKER = '__AUTOATENDE_R10C_B_AUTH_IDENTITY_BRIDGE__';

function readPath(obj, path) {
  try {
    return String(path)
      .split('.')
      .reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
  } catch {
    return undefined;
  }
}

function pickFirstNonEmpty(values = []) {
  for (const value of values) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') continue;
    return normalized;
  }
  return '';
}

function resolveBindingIdentity(binding = {}) {
  const userId = pickFirstNonEmpty([
    binding.user_id,
    binding.userId,
    readPath(binding, 'user.id'),
    readPath(binding, 'session.user.id'),
    readPath(binding, 'currentSession.user.id')
  ]);

  const companyId = pickFirstNonEmpty([
    binding.company_id,
    binding.companyId,
    readPath(binding, 'company.id'),
    readPath(binding, 'profile.company_id'),
    readPath(binding, 'user_metadata.company_id'),
    readPath(binding, 'app_metadata.company_id'),
    readPath(binding, 'session.user.user_metadata.company_id'),
    readPath(binding, 'session.user.app_metadata.company_id'),
    readPath(binding, 'currentSession.user.user_metadata.company_id'),
    readPath(binding, 'currentSession.user.app_metadata.company_id')
  ]);

  const clientId = pickFirstNonEmpty([
    binding.client_id,
    binding.clientId,
    readPath(binding, 'company.client_id'),
    readPath(binding, 'profile.client_id'),
    readPath(binding, 'user_metadata.client_id'),
    readPath(binding, 'app_metadata.client_id'),
    readPath(binding, 'session.user.user_metadata.client_id'),
    readPath(binding, 'session.user.app_metadata.client_id'),
    readPath(binding, 'currentSession.user.user_metadata.client_id'),
    readPath(binding, 'currentSession.user.app_metadata.client_id')
  ]);

  const role = pickFirstNonEmpty([
    binding.role,
    binding.resolvedRole,
    readPath(binding, 'profile.role'),
    readPath(binding, 'user_metadata.role'),
    readPath(binding, 'app_metadata.role'),
    readPath(binding, 'session.user.user_metadata.role'),
    readPath(binding, 'session.user.app_metadata.role')
  ]);

  const email = pickFirstNonEmpty([
    binding.email,
    readPath(binding, 'user.email'),
    readPath(binding, 'session.user.email'),
    readPath(binding, 'currentSession.user.email')
  ]);

  return {
    user_id: userId || undefined,
    company_id: companyId || undefined,
    client_id: clientId || undefined,
    role: role || undefined,
    email: email || undefined
  };
}

export function attachIdentityToAcquisitionContext(binding = {}) {
  if (typeof window === 'undefined') return null;

  const existing = readAcquisitionContext() || {};
  const resolved = resolveBindingIdentity(binding);

  const hasTracking = ALLOWED_KEYS.some((key) => {
    const value = existing[key];
    return value != null && String(value).trim() !== '';
  });

  const hasIdentity = ['user_id', 'company_id', 'client_id'].some((key) => {
    const value = resolved[key];
    return value != null && String(value).trim() !== '';
  });

  if (!hasTracking || !hasIdentity) {
    return existing || null;
  }

  const merged = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(resolved).filter(([_, value]) => value != null && String(value).trim() !== '')
    ),
    auth_bound_at: new Date().toISOString(),
    auth_binding_source: 'frontend_auth_context',
    ready_for_bind: true,
    __marker: AUTH_BRIDGE_MARKER
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.__AUTOATENDE_ACQUISITION__ = merged;

  return merged;
}

const BACKEND_BIND_MARKER = '__AUTOATENDE_R10C_C2_BACKEND_BIND__';
const BACKEND_BIND_ENDPOINT = '/api/ops-surface/acquisition/bind-self';

function persistAcquisitionContext(next = {}) {
  if (typeof window === 'undefined') return next || null;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.__AUTOATENDE_ACQUISITION__ = next;
  return next;
}

function resolveAccessTokenCandidate(binding = {}, depth = 0) {
  if (depth > 5 || binding == null) return '';

  if (typeof binding === 'string') {
    const value = binding.trim();
    if (!value) return '';
    if (
      /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(value) ||
      value.startsWith('Bearer ')
    ) {
      return value;
    }
    try {
      return resolveAccessTokenCandidate(JSON.parse(value), depth + 1);
    } catch {
      return '';
    }
  }

  if (Array.isArray(binding)) {
    for (const item of binding) {
      const token = resolveAccessTokenCandidate(item, depth + 1);
      if (token) return token;
    }
    return '';
  }

  if (typeof binding === 'object') {
    const directKeys = ['access_token', 'accessToken', 'token', 'authToken', 'jwt'];
    for (const key of directKeys) {
      if (binding[key]) {
        const token = resolveAccessTokenCandidate(binding[key], depth + 1);
        if (token) return token;
      }
    }

    const nestedKeys = ['session', 'currentSession', 'data', 'auth', 'supabase', 'result'];
    for (const key of nestedKeys) {
      if (binding[key]) {
        const token = resolveAccessTokenCandidate(binding[key], depth + 1);
        if (token) return token;
      }
    }

    for (const key of Object.keys(binding).slice(0, 20)) {
      const token = resolveAccessTokenCandidate(binding[key], depth + 1);
      if (token) return token;
    }
  }

  return '';
}

function resolveAccessToken(binding = {}) {
  if (typeof window === 'undefined') return '';

  const direct = resolveAccessTokenCandidate(binding);
  if (direct) return direct.startsWith('Bearer ') ? direct : `Bearer ${direct}`;

  try {
    const storageKeys = ['token', 'authToken', 'access_token', 'adminToken', 'jwt', 'auth_token'];
    for (const key of storageKeys) {
      const raw = window.localStorage.getItem(key);
      const token = resolveAccessTokenCandidate(raw);
      if (token) return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const globals = [
      window.__AUTOATENDE_SESSION__,
      window.__AUTOATENDE_AUTH__,
      window.__AUTOATENDE_AUTH__?.session,
      window.__AUTOATENDE_AUTH__?.currentSession
    ];
    for (const entry of globals) {
      const token = resolveAccessTokenCandidate(entry);
      if (token) return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !/^sb-.*-auth-token$/i.test(key)) continue;
      const raw = window.localStorage.getItem(key);
      const token = resolveAccessTokenCandidate(raw);
      if (token) return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
  } catch {
    return '';
  }

  return '';
}

function hasBindableMatchKey(context = {}) {
  return ['tracking_key', 'session_key', 'click_id'].some((key) => {
    const value = context[key];
    return value != null && String(value).trim() !== '';
  });
}

function buildBackendBindSignature(context = {}) {
  return [
    context.tracking_key || '',
    context.session_key || '',
    context.click_id || '',
    context.company_id || '',
    context.client_id || '',
    context.user_id || ''
  ].join('|');
}

async function postBackendAcquisitionBind(binding = {}, acquisitionContext = {}) {
  const token = resolveAccessToken(binding);
  if (!token) {
    throw new Error('missing_access_token');
  }

  const response = await fetch(BACKEND_BIND_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token
    },
    body: JSON.stringify({
      acquisitionContext
    })
  });

  const raw = await response.text();
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    throw new Error(parsed?.message || parsed?.error || raw || `HTTP ${response.status}`);
  }

  return parsed?.data || parsed;
}

function scheduleBackendAcquisitionBind(binding = {}, acquisitionContext = {}) {
  if (typeof window === 'undefined') return acquisitionContext || null;

  const current = acquisitionContext || readAcquisitionContext() || {};
  if (!current.ready_for_bind) return current;
  if (!hasBindableMatchKey(current)) return current;

  const signature = buildBackendBindSignature(current);
  if (!signature.replace(/\|/g, '').trim()) return current;

  if (
    current.last_backend_bind_status === 'ok' &&
    current.last_backend_bind_signature === signature
  ) {
    return current;
  }

  if (window.__AUTOATENDE_ACQ_BIND_INFLIGHT__ === signature) {
    return current;
  }

  window.__AUTOATENDE_ACQ_BIND_INFLIGHT__ = signature;

  persistAcquisitionContext({
    ...current,
    last_backend_bind_status: 'pending',
    last_backend_bind_signature: signature,
    last_backend_bind_attempted_at: new Date().toISOString(),
    backend_bind_marker: BACKEND_BIND_MARKER
  });

  Promise.resolve()
    .then(() => postBackendAcquisitionBind(binding, current))
    .then((result) => {
      const latest = readAcquisitionContext() || current;
      persistAcquisitionContext({
        ...latest,
        last_backend_bind_status: 'ok',
        last_backend_bind_signature: signature,
        last_backend_bind_at: new Date().toISOString(),
        last_backend_bind_result: result,
        backend_bind_marker: BACKEND_BIND_MARKER
      });
    })
    .catch((error) => {
      const latest = readAcquisitionContext() || current;
      persistAcquisitionContext({
        ...latest,
        last_backend_bind_status: 'error',
        last_backend_bind_signature: signature,
        last_backend_bind_error: String(error?.message || error || 'bind_failed'),
        last_backend_bind_error_at: new Date().toISOString(),
        backend_bind_marker: BACKEND_BIND_MARKER
      });
      console.warn('[R10C-C2] backend acquisition bind failed', error);
    })
    .finally(() => {
      if (window.__AUTOATENDE_ACQ_BIND_INFLIGHT__ === signature) {
        delete window.__AUTOATENDE_ACQ_BIND_INFLIGHT__;
      }
    });

  return current;
}
