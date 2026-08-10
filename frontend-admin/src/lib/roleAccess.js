// __AUTOATENDE_C6B_R1_ADMIN_SURFACE_HARDENING__
export const ROLE_GOVERNANCE_MARKER = '__AUTOATENDE_C6A_ROLE_GOVERNANCE_FOUNDATION__';

export const ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  AGENT: 'agent',
});

const ROLE_ALIASES = Object.freeze({
  owner: ROLES.OWNER,
  superadmin: ROLES.OWNER,
  master: ROLES.OWNER,
  founder: ROLES.OWNER,

  admin: ROLES.ADMIN,
  administrator: ROLES.ADMIN,
  gerente: ROLES.ADMIN,
  gestor: ROLES.ADMIN,
  company: ROLES.ADMIN,
  empresa: ROLES.ADMIN,

  agent: ROLES.AGENT,
  operador: ROLES.AGENT,
  operator: ROLES.AGENT,
  attendant: ROLES.AGENT,
  atendente: ROLES.AGENT,
  support: ROLES.AGENT,
  user: ROLES.AGENT,
});

function normalizeRole(input) {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim().toLowerCase();
  return ROLE_ALIASES[raw] || null;
}

function safeParse(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractRoleFromObject(obj) {
  if (!obj || typeof obj !== 'object') return null;

  const candidates = [
    obj.role,
    obj.user_role,
    obj.type,
    obj.kind,
    obj.profile && obj.profile.role,
    obj.user && obj.user.role,
    obj.currentUser && obj.currentUser.role,
    obj.session && obj.session.user && obj.session.user.role,
    obj.user_metadata && obj.user_metadata.role,
    obj.app_metadata && obj.app_metadata.role,
    obj.user && obj.user.user_metadata && obj.user.user_metadata.role,
    obj.user && obj.user.app_metadata && obj.user.app_metadata.role,
    obj.currentSession && obj.currentSession.user && obj.currentSession.user.role,
    obj.currentSession && obj.currentSession.user && obj.currentSession.user.user_metadata && obj.currentSession.user.user_metadata.role,
    obj.currentSession && obj.currentSession.user && obj.currentSession.user.app_metadata && obj.currentSession.user.app_metadata.role,
    obj.session && obj.session.user && obj.session.user.user_metadata && obj.session.user.user_metadata.role,
    obj.session && obj.session.user && obj.session.user.app_metadata && obj.session.user.app_metadata.role,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeRole(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function getRoleFromWindow() {
  if (typeof window === 'undefined') return null;

  const runtimeCandidates = [
    window.__AUTOATENDE_USER__,
    window.__AUTOATENDE_SESSION__,
    window.__AUTOATENDE_AUTH__,
    window.__INITIAL_STATE__,
  ];

  for (const entry of runtimeCandidates) {
    const role = extractRoleFromObject(entry);
    if (role) return role;
  }

  return null;
}

function getRoleFromLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  const keys = [
    'autoatende_user',
    'auth_user',
    'profile',
    'user',
    'session',
    'supabase.auth.token',
  ];

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    const parsed = safeParse(raw);
    if (parsed) {
      const role = extractRoleFromObject(parsed);
      if (role) return role;
    }

    const normalized = normalizeRole(raw);
    if (normalized) return normalized;
  }

  return null;
}

export function resolveCurrentRole(explicitRole) {
  const direct = normalizeRole(explicitRole);
  if (direct) return direct;

  const runtime = getRoleFromWindow() || getRoleFromLocalStorage();
  if (runtime) return runtime;

  if (typeof window !== 'undefined' && !window.__AUTOATENDE_ROLE_FALLBACK_WARNED__) {
    console.warn('[AUTOATENDE][ROLE] Papel não identificado; fallback temporário para admin para evitar lockout indevido.');
    window.__AUTOATENDE_ROLE_FALLBACK_WARNED__ = true;
  }

  return ROLES.ADMIN;
}

export function hasAnyRole(currentRole, allowedRoles = []) {
  const normalizedCurrentRole = resolveCurrentRole(currentRole);
  const normalizedAllowed = (allowedRoles || [])
    .map(normalizeRole)
    .filter(Boolean);

  if (!normalizedAllowed.length) return true;
  return normalizedAllowed.includes(normalizedCurrentRole);
}

export function isAdminLike(currentRole) {
  const normalized = resolveCurrentRole(currentRole);
  return normalized === ROLES.OWNER || normalized === ROLES.ADMIN;
}
