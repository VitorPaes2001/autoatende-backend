/**
 * __AUTOATENDE_V4_R13C_R3D_AGENT_MENU_DASHBOARD_ADMIN_CLEANUP__
 *
 * Guard visual operacional para perfil agent/atendente.
 *
 * Regra oficial:
 * - agent pode ver: Dashboard, Atendimento, Inbox e Disparos.
 * - agent não vê: Meu Plano, Configurações e cards administrativos do Dashboard.
 * - admin/company/owner/manager continuam sem alteração.
 *
 * Este arquivo é defensivo: não lança erro no runtime e não bloqueia backend.
 */

const MARKER = "__AUTOATENDE_V4_R13C_R3D_AGENT_MENU_DASHBOARD_ADMIN_CLEANUP__";

const AGENT_ROLES = new Set([
  "agent",
  "agente",
  "atendente",
  "support",
  "operator",
  "operador"
]);

const ADMIN_ROLES = new Set([
  "admin",
  "company",
  "owner",
  "manager",
  "gestor",
  "empresa",
  "superadmin"
]);

const ADMIN_MENU_LABELS = [
  "meu plano",
  "configurações",
  "configuracoes"
];

const ADMIN_DASHBOARD_LABELS = [
  "meu plano",
  "configurações",
  "configuracoes",
  "assinatura",
  "conta e plano",
  "central do assistente",
  "assistente de ia",
  "conecte whatsapp"
];

const AGENT_ALLOWED_PATHS = [
  "/",
  "/dashboard",
  "/attendance",
  "/inbox",
  "/configuracoes/aquisicao",
  "/configuracoes/aquisicao/templates",
  "/configuracoes/aquisicao/lista",
  "/configuracoes/aquisicao/lote",
  "/disparos"
];

const AGENT_BLOCKED_PATHS = [
  "/settings",
  "/billing",
  "/meu-plano",
  "/plano",
  "/admin",
  "/configuracoes/assistente-central",
  "/configuracoes/teste-assistente",
  "/configuracoes/perfil-comercial",
  "/configuracoes/onboarding-comercial",
  "/configuracoes/whatsapp",
  "/configuracoes/conexao",
  "/configuracoes/assistente"
];

function safeLower(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);

    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function collectRolesFromObject(value, roles = []) {
  if (!value || typeof value !== "object") return roles;

  const roleKeys = new Set([
    "role",
    "perfil",
    "user_role",
    "userRole",
    "resolvedRole",
    "resolved_role",
    "account_role",
    "accountRole",
    "type",
    "user_type",
    "userType"
  ]);

  const stack = [value];
  const seen = new WeakSet();

  while (stack.length) {
    const item = stack.pop();

    if (!item || typeof item !== "object") continue;
    if (seen.has(item)) continue;

    seen.add(item);

    for (const [key, raw] of Object.entries(item)) {
      if (roleKeys.has(key) && typeof raw === "string") {
        const role = safeLower(raw);
        if (role) roles.push(role);
      }

      if (raw && typeof raw === "object") {
        stack.push(raw);
      }
    }
  }

  return roles;
}

function parseStorageValue(raw, roles = []) {
  const text = String(raw || "");

  if (!text) return roles;

  const jwtPayload = decodeJwtPayload(text);
  if (jwtPayload) {
    collectRolesFromObject(jwtPayload, roles);
  }

  if (
    text.includes("{") ||
    text.includes("[") ||
    text.includes("role") ||
    text.includes("perfil") ||
    text.includes("agent") ||
    text.includes("admin") ||
    text.includes("company")
  ) {
    try {
      const parsed = JSON.parse(text);
      collectRolesFromObject(parsed, roles);
    } catch (_) {
      const low = safeLower(text);

      for (const role of AGENT_ROLES) {
        if (low.includes(`"${role}"`) || low.includes(`:${role}`) || low.includes(` ${role}`)) {
          roles.push(role);
        }
      }

      for (const role of ADMIN_ROLES) {
        if (low.includes(`"${role}"`) || low.includes(`:${role}`) || low.includes(` ${role}`)) {
          roles.push(role);
        }
      }
    }
  }

  return roles;
}

function collectRolesFromStorage() {
  const roles = [];

  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      if (!storage) continue;

      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        const value = storage.getItem(key);

        parseStorageValue(key, roles);
        parseStorageValue(value, roles);
      }
    }
  } catch (_) {}

  try {
    collectRolesFromObject(window.__AUTOATENDE_USER__, roles);
    collectRolesFromObject(window.__AUTOATENDE_SESSION__, roles);
    collectRolesFromObject(window.__AUTOATENDE_AUTH__, roles);
  } catch (_) {}

  return roles;
}

function collectRolesFromDomHints() {
  const roles = [];

  try {
    const text = safeLower(document.body?.innerText || "");

    if (text.includes("seu perfil (agent)") || text.includes("perfil (agent)") || text.includes("perfil agent")) {
      roles.push("agent");
    }

    if (text.includes("acesso negado") && text.includes("agent")) {
      roles.push("agent");
    }
  } catch (_) {}

  return roles;
}

function resolveEffectiveRole() {
  const roles = [
    ...collectRolesFromStorage(),
    ...collectRolesFromDomHints()
  ].map(safeLower).filter(Boolean);

  const hasAgent = roles.some((role) => AGENT_ROLES.has(role));
  const hasAdmin = roles.some((role) => ADMIN_ROLES.has(role));

  // Admin vence quando explicitamente encontrado sem indício de agent.
  // Em sessão real de agent, normalmente só existe agent no storage/session.
  if (hasAdmin && !hasAgent) return "admin";
  if (hasAgent) return "agent";
  if (hasAdmin) return "admin";

  return "unknown";
}

function pathStartsWith(pathname, prefix) {
  const current = String(pathname || "/").replace(/\/+$/, "") || "/";
  const wanted = String(prefix || "/").replace(/\/+$/, "") || "/";

  if (wanted === "/") return current === "/";
  return current === wanted || current.startsWith(`${wanted}/`);
}

function isAgentBlockedPath(pathname) {
  const path = String(pathname || "/");

  const explicitlyAllowed = AGENT_ALLOWED_PATHS.some((allowed) => pathStartsWith(path, allowed));
  const explicitlyBlocked = AGENT_BLOCKED_PATHS.some((blocked) => pathStartsWith(path, blocked));

  if (explicitlyBlocked && !explicitlyAllowed) return true;

  // /configuracoes/* só fica permitido para aquisição/disparos operacionais.
  if (pathStartsWith(path, "/configuracoes") && !pathStartsWith(path, "/configuracoes/aquisicao")) {
    return true;
  }

  return false;
}

function nearestClickableOrCard(node) {
  if (!node || !node.closest) return null;

  return (
    node.closest("a") ||
    node.closest("button") ||
    node.closest("[role='button']") ||
    node.closest("li") ||
    node.closest("nav > div") ||
    node.closest("aside div") ||
    node.closest("section a") ||
    node.closest("section article") ||
    node.closest("section > div") ||
    node.closest(".card") ||
    node.closest("[class*='card']") ||
    node.closest("[class*='Card']")
  );
}

function hideNode(node, reason) {
  if (!node || !node.style) return;

  node.setAttribute("data-aa-admin-only-hidden", "true");
  node.setAttribute("data-aa-hidden-reason", reason || MARKER);
  node.style.display = "none";
}

function shouldHideByLabel(text, labels) {
  const low = safeLower(text);
  if (!low) return false;

  return labels.some((label) => low === label || low.includes(label));
}

function hideSidebarAdminItems() {
  const candidates = Array.from(document.querySelectorAll("aside a, aside button, nav a, nav button, [role='navigation'] a, [role='navigation'] button"));

  for (const item of candidates) {
    const text = item.innerText || item.textContent || "";

    if (shouldHideByLabel(text, ADMIN_MENU_LABELS)) {
      hideNode(item.closest("a, button, li, div") || item, "agent_sidebar_admin_item");
    }
  }
}

function hideDashboardAdminCards() {
  const path = window.location.pathname || "/";

  if (!(path === "/" || pathStartsWith(path, "/dashboard"))) return;

  const cards = Array.from(document.querySelectorAll("a, article, section > div, [class*='card'], [class*='Card']"));

  for (const card of cards) {
    const text = card.innerText || card.textContent || "";

    if (!text) continue;

    const isAllowedOperational =
      safeLower(text).includes("inbox") ||
      safeLower(text).includes("atendimento") ||
      safeLower(text).includes("disparos") ||
      safeLower(text).includes("dashboard");

    if (shouldHideByLabel(text, ADMIN_DASHBOARD_LABELS) && !isAllowedOperational) {
      hideNode(card, "agent_dashboard_admin_card");
    }

    // Caso específico: cards do painel inicial com título exato.
    const strongs = Array.from(card.querySelectorAll?.("strong, h1, h2, h3, h4, p") || []);
    const titleLike = strongs.map((el) => safeLower(el.innerText || el.textContent || "")).join(" | ");

    if (
      (titleLike.includes("configuracoes") || titleLike.includes("meu plano") || titleLike.includes("assinatura") || titleLike.includes("central do assistente")) &&
      !isAllowedOperational
    ) {
      hideNode(card, "agent_dashboard_admin_card_title");
    }
  }
}

function markRole(role) {
  try {
    document.documentElement.setAttribute("data-aa-effective-role", role);
    document.body?.setAttribute("data-aa-effective-role", role);
  } catch (_) {}
}

function applyAgentSurfaceRules() {
  try {
    const role = resolveEffectiveRole();
    markRole(role);

    if (role !== "agent") return;

    hideSidebarAdminItems();
    hideDashboardAdminCards();

    if (isAgentBlockedPath(window.location.pathname)) {
      if (window.location.pathname !== "/attendance") {
        window.location.replace("/attendance");
      }
    }
  } catch (error) {
    try {
      console.warn(`[${MARKER}] guard_safe_error`, error);
    } catch (_) {}
  }
}

function startAgentOperationalSurfaceGuard() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (window.__AUTOATENDE_R13C_R3D_AGENT_GUARD_STARTED__) {
    applyAgentSurfaceRules();
    return;
  }

  window.__AUTOATENDE_R13C_R3D_AGENT_GUARD_STARTED__ = true;

  const run = () => applyAgentSurfaceRules();

  run();

  window.addEventListener("load", run, { passive: true });
  window.addEventListener("popstate", run, { passive: true });
  window.addEventListener("hashchange", run, { passive: true });

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(run, 0);
    setTimeout(run, 120);
    return result;
  };

  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(run, 0);
    setTimeout(run, 120);
    return result;
  };

  const observer = new MutationObserver(() => {
    run();
  });

  const startObserver = () => {
    if (!document.body) return;

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    run();
  };

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }

  let ticks = 0;
  const interval = window.setInterval(() => {
    ticks += 1;
    run();

    if (ticks >= 30) {
      window.clearInterval(interval);
    }
  }, 500);
}

startAgentOperationalSurfaceGuard();

export { startAgentOperationalSurfaceGuard };
export default startAgentOperationalSurfaceGuard;
