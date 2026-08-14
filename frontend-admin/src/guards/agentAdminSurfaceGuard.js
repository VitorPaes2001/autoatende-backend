/**
 * __AUTOATENDE_V4_R12D_B3R1_AGENT_SIDEBAR_STRONG_DETECTION__
 *
 * Guard visual reforçado para perfil agent.
 *
 * Objetivo:
 * - Agent vê somente Dashboard, Atendimento, Inbox e Disparos.
 * - Agent não vê Meu Plano nem Configurações.
 * - Agent pode acessar /configuracoes/aquisicao e subrotas.
 * - Agent não acessa /settings, /billing e demais /configuracoes/* administrativas.
 *
 * Estratégia:
 * - Detecta role por window/localStorage/sessionStorage/JWT quando disponível.
 * - Se uma rota administrativa renderizar "Acesso negado" ou "perfil (agent)",
 *   marca a sessão do navegador como agent e redireciona.
 */

const MARKER = "__AUTOATENDE_V4_R12D_B3R1_AGENT_SIDEBAR_STRONG_DETECTION__";

const AGENT_ROLES = new Set(["agent", "agente", "atendente", "support", "operator"]);
const ADMIN_ROLES = new Set(["admin", "company", "owner", "manager", "superadmin"]);

const FORCE_AGENT_KEY = "aa_forced_agent_role_detected_v1";

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (_) {
    return null;
  }
}

function decodeBase64Url(value) {
  try {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return decodeURIComponent(
      atob(padded)
        .split("")
        .map((char) => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch (_) {
    try {
      const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      return atob(padded);
    } catch (__){
      return "";
    }
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const payload = decodeBase64Url(parts[1]);
    return safeJsonParse(payload);
  } catch (_) {
    return null;
  }
}

function pushRole(candidates, value) {
  const role = normalize(value);
  if (role) candidates.push(role);
}

function collectFromObject(obj, candidates, depth = 0, seen = new Set()) {
  if (!obj || depth > 5) return;

  if (typeof obj === "string") {
    const raw = obj.trim();

    if (!raw) return;

    const normalized = normalize(raw);

    if (AGENT_ROLES.has(normalized) || ADMIN_ROLES.has(normalized)) {
      candidates.push(normalized);
    }

    if (raw.includes(".") && raw.split(".").length >= 3) {
      const payload = decodeJwtPayload(raw);
      if (payload) collectFromObject(payload, candidates, depth + 1, seen);
    }

    if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
      const parsed = safeJsonParse(raw);
      if (parsed) collectFromObject(parsed, candidates, depth + 1, seen);
    }

    return;
  }

  if (typeof obj !== "object") return;
  if (seen.has(obj)) return;

  seen.add(obj);

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = normalize(key);

    if (
      normalizedKey === "role" ||
      normalizedKey === "perfil" ||
      normalizedKey === "profile" ||
      normalizedKey === "user_role" ||
      normalizedKey === "userrole"
    ) {
      pushRole(candidates, value);
    }

    collectFromObject(value, candidates, depth + 1, seen);
  }
}

function collectRoleCandidates() {
  const candidates = [];

  try {
    collectFromObject(window.__AUTOATENDE_AUTH__, candidates);
    collectFromObject(window.__AUTOATENDE_SESSION__, candidates);
    collectFromObject(window.__AUTOATENDE_USER__, candidates);
    collectFromObject(window.__AUTOATENDE_CURRENT_USER__, candidates);

    for (const storage of [localStorage, sessionStorage]) {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        const value = storage.getItem(key);
        collectFromObject(value, candidates);
      }
    }

    document.querySelectorAll("[data-role], [data-user-role], [data-perfil]").forEach((node) => {
      pushRole(candidates, node.getAttribute("data-role"));
      pushRole(candidates, node.getAttribute("data-user-role"));
      pushRole(candidates, node.getAttribute("data-perfil"));
    });
  } catch (_) {}

  return candidates.filter(Boolean);
}

function pathNow() {
  return window.location.pathname || "/";
}

function isOperationalDisparosPath(path) {
  const normalizedPath = normalize(path);
  return normalizedPath === "/configuracoes/aquisicao" || normalizedPath.startsWith("/configuracoes/aquisicao/");
}

function isAllowedAgentPath(path) {
  const normalizedPath = normalize(path);

  return (
    normalizedPath === "/" ||
    normalizedPath === "/dashboard" ||
    normalizedPath.startsWith("/dashboard/") ||
    normalizedPath === "/attendance" ||
    normalizedPath.startsWith("/attendance/") ||
    normalizedPath === "/inbox" ||
    normalizedPath.startsWith("/inbox/") ||
    normalizedPath === "/disparos" ||
    normalizedPath.startsWith("/disparos/") ||
    isOperationalDisparosPath(normalizedPath)
  );
}

function isSensitiveAdminPath(path) {
  const normalizedPath = normalize(path);

  if (isOperationalDisparosPath(normalizedPath)) {
    return false;
  }

  return (
    normalizedPath === "/settings" ||
    normalizedPath.startsWith("/settings/") ||
    normalizedPath === "/billing" ||
    normalizedPath.startsWith("/billing/") ||
    normalizedPath === "/meu-plano" ||
    normalizedPath.startsWith("/meu-plano/") ||
    normalizedPath === "/plano" ||
    normalizedPath.startsWith("/plano/") ||
    normalizedPath === "/admin" ||
    normalizedPath.startsWith("/admin/") ||
    normalizedPath.startsWith("/configuracoes")
  );
}

function hasAdminRoleCandidate() {
  return collectRoleCandidates().some((role) => ADMIN_ROLES.has(role));
}

function hasAgentRoleCandidate() {
  return collectRoleCandidates().some((role) => AGENT_ROLES.has(role));
}

function hasAgentDomEvidence() {
  try {
    const bodyText = normalize(document.body?.innerText || "");

    if (!bodyText) return false;

    const path = pathNow();

    const explicitAgent =
      bodyText.includes("perfil (agent)") ||
      bodyText.includes("seu perfil (agent)") ||
      bodyText.includes("role agent") ||
      bodyText.includes("agent nao tem permissao") ||
      bodyText.includes("agent não tem permissao") ||
      bodyText.includes("agent não tem permissão");

    const deniedOnAdminSurface =
      isSensitiveAdminPath(path) &&
      (
        bodyText.includes("acesso negado") ||
        bodyText.includes("falha ao carregar dados do plano") ||
        bodyText.includes("nao tem permissao") ||
        bodyText.includes("não tem permissao") ||
        bodyText.includes("não tem permissão")
      );

    return explicitAgent || deniedOnAdminSurface;
  } catch (_) {
    return false;
  }
}

function resolveRole() {
  if (hasAdminRoleCandidate()) {
    try {
      sessionStorage.removeItem(FORCE_AGENT_KEY);
    } catch (_) {}
    return "admin";
  }

  if (hasAgentRoleCandidate()) {
    try {
      sessionStorage.setItem(FORCE_AGENT_KEY, "1");
    } catch (_) {}
    return "agent";
  }

  if (hasAgentDomEvidence()) {
    try {
      sessionStorage.setItem(FORCE_AGENT_KEY, "1");
    } catch (_) {}
    return "agent";
  }

  try {
    if (sessionStorage.getItem(FORCE_AGENT_KEY) === "1") {
      return "agent";
    }
  } catch (_) {}

  return "unknown";
}

function isAgent() {
  return resolveRole() === "agent";
}

function markHiddenMenuItem(node) {
  if (!node || node === document.body || node === document.documentElement) return;

  const target =
    node.closest("a") ||
    node.closest("button") ||
    node.closest("[role='menuitem']") ||
    node.closest("li") ||
    node.closest("[data-sidebar-item]") ||
    node.closest("nav a") ||
    node.closest("nav button") ||
    node;

  if (!target || target === document.body || target === document.documentElement) return;

  target.setAttribute("data-aa-agent-hidden-menu", "true");
  target.setAttribute("aria-hidden", "true");
}

function cleanAgentSidebar() {
  const role = resolveRole();

  if (role !== "agent") {
    document.documentElement.classList.remove("aa-role-agent");
    document.body?.classList.remove("aa-role-agent");
    return;
  }

  document.documentElement.classList.add("aa-role-agent");
  document.body?.classList.add("aa-role-agent");
  document.documentElement.setAttribute("data-aa-role", "agent");
  document.body?.setAttribute("data-aa-role", "agent");

  const nodes = Array.from(document.querySelectorAll("a, button, [role='menuitem'], nav *, aside *"));

  for (const node of nodes) {
    const text = normalize(node.innerText || node.textContent || "");
    const href = normalize(node.getAttribute?.("href") || "");
    const aria = normalize(node.getAttribute?.("aria-label") || "");
    const title = normalize(node.getAttribute?.("title") || "");

    const haystack = `${text} ${href} ${aria} ${title}`;

    const shouldHide =
      haystack.includes("meu plano") ||
      haystack.includes("/billing") ||
      haystack.includes("/meu-plano") ||
      haystack.includes("/plano") ||
      haystack.includes("configuracoes") ||
      haystack.includes("configuracoes") ||
      haystack.includes("/settings");

    const isAllowedDisparos =
      haystack.includes("disparos") ||
      haystack.includes("/disparos") ||
      haystack.includes("/configuracoes/aquisicao");

    if (shouldHide && !isAllowedDisparos) {
      markHiddenMenuItem(node);
    }
  }
}

function redirectAgentIfNeeded() {
  if (!isAgent()) return;

  const path = pathNow();

  if (isSensitiveAdminPath(path) && !isAllowedAgentPath(path)) {
    setTimeout(() => {
      if (window.location.pathname !== "/attendance") {
        window.location.replace("/attendance");
      }
    }, 120);
  }
}

function run() {
  try {
    cleanAgentSidebar();
    redirectAgentIfNeeded();
  } catch (_) {}
}

function install() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__AUTOATENDE_R12D_B3R1_AGENT_MENU_GUARD_INSTALLED__) return;

  window.__AUTOATENDE_R12D_B3R1_AGENT_MENU_GUARD_INSTALLED__ = true;
  window.__AUTOATENDE_R12D_B3R1_AGENT_MENU_GUARD_MARKER__ = MARKER;

  run();

  window.addEventListener("load", run);
  window.addEventListener("focus", run);
  window.addEventListener("popstate", run);

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(run, 50);
    setTimeout(run, 250);
    return result;
  };

  history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(run, 50);
    setTimeout(run, 250);
    return result;
  };

  const observer = new MutationObserver(() => {
    run();
  });

  const startObserver = () => {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      run();
      setTimeout(run, 100);
      setTimeout(run, 400);
      setTimeout(run, 900);
      setTimeout(run, 1800);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }
}

install();

export { MARKER };
