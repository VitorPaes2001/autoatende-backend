/* __AUTOATENDE_C3FIX_COMPANY_CONTEXT__ */
/* __AUTOATENDE_STRIPE_PHASE2R_D5F_B_REMOVE_MAIN_COMPANY_FALLBACK__ */

/**
 * Contexto de empresa/tenant para o frontend.
 *
 * Decisão D5F-B:
 * - Não usar fallback fixo para a empresa principal.
 * - Resolver primeiro pelo usuário autenticado / metadata do Supabase.
 * - Se não houver tenant no login, retornar string vazia.
 *
 * Motivo:
 * - Em cliente real, fallback para a empresa principal pode misturar dados entre tenants.
 */

const MAIN_COMPANY_ID_FALLBACK = "";
const MAIN_CLIENT_ID_FALLBACK = "";

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function pickDeep(obj, keys, depth = 0, seen = new WeakSet()) {
  if (!obj || typeof obj !== "object" || depth > 8) return "";

  if (seen.has(obj)) return "";
  seen.add(obj);

  for (const key of keys) {
    const value = obj[key];

    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const priority = [
    obj.user,
    obj.currentUser,
    obj.session,
    obj.currentSession,
    obj.data,
    obj.profile,
    obj.user_metadata,
    obj.app_metadata,
    obj.user?.user_metadata,
    obj.user?.app_metadata,
    obj.session?.user,
    obj.currentSession?.user,
    obj.data?.session,
    obj.data?.session?.user,
  ];

  for (const candidate of priority) {
    const found = pickDeep(candidate, keys, depth + 1, seen);
    if (found) return found;
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = pickDeep(value, keys, depth + 1, seen);
      if (found) return found;
    }
  }

  return "";
}

function findAuthStorageCandidate(storageObj, keys) {
  if (!storageObj) return "";

  const keysToInspect = [];

  for (let i = 0; i < (storageObj.length || 0); i += 1) {
    const storageKey = storageObj.key(i);

    if (!storageKey) continue;

    if (
      storageKey.includes("supabase") ||
      storageKey.includes("auth") ||
      storageKey.includes("session") ||
      storageKey.includes("profile") ||
      storageKey.includes("user") ||
      storageKey.includes("autoatende")
    ) {
      keysToInspect.push(storageKey);
    }
  }

  // Preferir auth_user/autoatende_user, que são materializados pelo AuthContext.
  keysToInspect.sort((a, b) => {
    const score = (key) => {
      if (key === "auth_user") return 0;
      if (key === "autoatende_user") return 1;
      if (key.includes("supabase")) return 2;
      return 3;
    };

    return score(a) - score(b);
  });

  for (const storageKey of keysToInspect) {
    const raw = storageObj.getItem?.(storageKey);

    if (!raw) continue;

    const parsed = safeJsonParse(raw);

    if (parsed) {
      const found = pickDeep(parsed, keys);
      if (found) return found;
    }
  }

  return "";
}

function resolveFromRuntime(keys) {
  if (typeof window === "undefined") return "";

  const authFound =
    pickDeep(window.__AUTOATENDE_AUTH__, keys) ||
    pickDeep(window.__AUTOATENDE_SESSION__, keys) ||
    pickDeep(window.__AUTOATENDE_USER__, keys);

  if (authFound) return authFound;

  const localFound = findAuthStorageCandidate(window.localStorage, keys);
  if (localFound) return localFound;

  const sessionFound = findAuthStorageCandidate(window.sessionStorage, keys);
  if (sessionFound) return sessionFound;

  return "";
}

export function resolveCompanyId() {
  const fromRuntime = resolveFromRuntime([
    "company_id",
    "companyId",
    "tenant_company_id",
    "tenantCompanyId",
  ]);

  if (fromRuntime) return fromRuntime;

  return MAIN_COMPANY_ID_FALLBACK;
}

export function resolveClientId() {
  const fromRuntime = resolveFromRuntime([
    "client_id",
    "clientId",
    "tenant_client_id",
    "tenantClientId",
  ]);

  if (fromRuntime) return fromRuntime;

  return MAIN_CLIENT_ID_FALLBACK;
}

export { MAIN_COMPANY_ID_FALLBACK, MAIN_CLIENT_ID_FALLBACK };
