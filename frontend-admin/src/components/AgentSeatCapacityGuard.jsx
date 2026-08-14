import { useCallback, useEffect, useRef, useState } from "react";

/**
 * __AUTOATENDE_V4_R12B_R8_PREVENTIVE_ADD_AGENT_BUTTON_UX__
 *
 * Guard visual preventivo para criação de agentes.
 * Não faz enforcement definitivo. Apenas bloqueia a ação na UI quando
 * a capacidade oficial do backend indicar limite atingido.
 */

const MARKER = "__AUTOATENDE_V4_R12B_R8_PREVENTIVE_ADD_AGENT_BUTTON_UX__";

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function findTokenDeep(value, depth = 0) {
  if (!value || depth > 6) return null;

  if (typeof value === "string") {
    if (value.length > 40 && value.split(".").length >= 3) return value;

    const parsed = safeParseJson(value);
    if (parsed) return findTokenDeep(parsed, depth + 1);

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTokenDeep(item, depth + 1);
      if (found) return found;
    }

    return null;
  }

  if (typeof value === "object") {
    for (const key of ["access_token", "accessToken", "jwt", "token"]) {
      if (typeof value[key] === "string" && value[key].length > 40) {
        return value[key];
      }
    }

    for (const item of Object.values(value)) {
      const found = findTokenDeep(item, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function getAccessToken() {
  if (typeof window === "undefined") return null;

  for (const source of [
    window.__AUTOATENDE_SESSION__,
    window.__AUTOATENDE_AUTH__,
    window.__AUTOATENDE_USER__
  ]) {
    const found = findTokenDeep(source);
    if (found) return found;
  }

  const stores = [];

  try {
    stores.push(window.localStorage);
  } catch (_) {}

  try {
    stores.push(window.sessionStorage);
  } catch (_) {}

  for (const store of stores) {
    if (!store) continue;

    const keys = [];

    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key) keys.push(key);
    }

    const orderedKeys = keys
      .filter((key) => /auth|session|supabase|autoatende|token/i.test(key))
      .concat(keys.filter((key) => !/auth|session|supabase|autoatende|token/i.test(key)));

    for (const key of orderedKeys) {
      const found = findTokenDeep(store.getItem(key));
      if (found) return found;
    }
  }

  return null;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function inferLimit(planName) {
  const plan = normalize(planName);

  if (plan.includes("business")) return 8;
  if (plan.includes("profissional") || plan.includes("professional")) return 4;
  if (plan.includes("essencial") || plan.includes("essential")) return 1;

  return null;
}

function firstNumber(values, fallback = null) {
  for (const value of values) {
    const number = toNumber(value, null);
    if (number !== null) return number;
  }

  return fallback;
}

function firstPositive(values, fallback = null) {
  for (const value of values) {
    const number = toNumber(value, null);
    if (number !== null && number > 0) return number;
  }

  return fallback;
}

function readStatus(payload) {
  const status = payload?.status || payload || {};

  const plan =
    status.normalized_plan ||
    status.plan ||
    status.raw_plan ||
    status.plan_name ||
    status.subscription_plan ||
    status.billing_plan ||
    null;

  const limit =
    firstPositive([
      status.limit,
      status.agent_limit,
      status.seat_limit,
      status.users_limit,
      status.max_agents,
      status.max_users
    ]) || inferLimit(plan);

  const used = firstNumber([
    status.used_seats,
    status.users_used,
    status.current_users,
    status.internal_users_used,
    status.seats_used
  ]);

  const remaining = firstNumber([
    status.remaining,
    status.available,
    status.available_seats
  ], typeof limit === "number" && typeof used === "number" ? Math.max(limit - used, 0) : null);

  const atLimit =
    status.at_limit === true ||
    status.limit_reached === true ||
    (typeof limit === "number" && typeof used === "number" && used >= limit);

  return {
    plan,
    limit,
    used,
    remaining,
    atLimit,
    valid: typeof limit === "number" && typeof used === "number"
  };
}

function findAddAgentActions() {
  return Array.from(document.querySelectorAll("button, a, [role='button']"))
    .filter((node) => normalize(node.textContent).includes("adicionar agente"));
}

function ensureNotice(anchor, status) {
  const wrapper = anchor?.parentElement;
  if (!wrapper) return;

  let notice = document.querySelector("[data-autoatende-agent-seat-guard-notice='true']");

  if (!notice) {
    notice = document.createElement("div");
    notice.setAttribute("data-autoatende-agent-seat-guard-notice", "true");
    notice.className = "aa-agent-seat-guard-notice-r12b8";
    wrapper.insertAdjacentElement("afterend", notice);
  }

  const limit = status.limit ?? "do plano";
  notice.textContent = `Limite de usuários internos atingido. Remova um agente ou ajuste o plano para cadastrar novos usuários. Limite atual: ${limit}.`;
}

function removeNotice() {
  document
    .querySelectorAll("[data-autoatende-agent-seat-guard-notice='true']")
    .forEach((node) => node.remove());
}

function markDisabled(node, status) {
  if (!node.dataset.aaR12b8Managed) {
    node.dataset.aaR12b8Managed = "true";
    node.dataset.aaR12b8PrevDisabled = node.disabled ? "true" : "false";
    node.dataset.aaR12b8PrevAriaDisabled = node.getAttribute("aria-disabled") || "";
    node.dataset.aaR12b8PrevTitle = node.getAttribute("title") || "";
  }

  node.classList.add("aa-agent-seat-action-disabled-r12b8");
  node.setAttribute("aria-disabled", "true");
  node.setAttribute(
    "title",
    `Limite de usuários internos atingido (${status.used}/${status.limit}).`
  );

  if ("disabled" in node) {
    node.disabled = true;
  }
}

function restoreNode(node) {
  if (!node.dataset.aaR12b8Managed) return;

  node.classList.remove("aa-agent-seat-action-disabled-r12b8");

  if ("disabled" in node) {
    node.disabled = node.dataset.aaR12b8PrevDisabled === "true";
  }

  const prevAria = node.dataset.aaR12b8PrevAriaDisabled;
  const prevTitle = node.dataset.aaR12b8PrevTitle;

  if (prevAria) node.setAttribute("aria-disabled", prevAria);
  else node.removeAttribute("aria-disabled");

  if (prevTitle) node.setAttribute("title", prevTitle);
  else node.removeAttribute("title");

  delete node.dataset.aaR12b8Managed;
  delete node.dataset.aaR12b8PrevDisabled;
  delete node.dataset.aaR12b8PrevAriaDisabled;
  delete node.dataset.aaR12b8PrevTitle;
}

function applyVisualGuard(status) {
  const actions = findAddAgentActions();

  if (!actions.length) {
    removeNotice();
    return;
  }

  if (status?.valid && status.atLimit) {
    actions.forEach((node) => markDisabled(node, status));
    ensureNotice(actions[0], status);
    return;
  }

  actions.forEach(restoreNode);
  removeNotice();
}

async function fetchSeatStatus() {
  const token = getAccessToken();
  const headers = { "Content-Type": "application/json" };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch("/api/users/agents/seat-status", {
    method: "GET",
    headers,
    credentials: "include"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Falha ao consultar limite (${response.status})`);
  }

  return readStatus(payload);
}

export default function AgentSeatCapacityGuard() {
  const [status, setStatus] = useState(null);
  const statusRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSeatStatus();

      statusRef.current = next;
      setStatus(next);

      window.dispatchEvent(
        new CustomEvent("autoatende:agent-seat-capacity", {
          detail: {
            marker: MARKER,
            status: next
          }
        })
      );
    } catch (_) {
      statusRef.current = null;
      setStatus(null);
      applyVisualGuard(null);
    }
  }, []);

  useEffect(() => {
    refresh();

    const onFocus = () => refresh();
    const onAgentsUpdated = () => refresh();

    window.addEventListener("focus", onFocus);
    window.addEventListener("autoatende:agents-updated", onAgentsUpdated);

    const interval = window.setInterval(refresh, 30000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("autoatende:agents-updated", onAgentsUpdated);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    applyVisualGuard(status);

    const timers = [
      window.setTimeout(() => applyVisualGuard(statusRef.current), 120),
      window.setTimeout(() => applyVisualGuard(statusRef.current), 450),
      window.setTimeout(() => applyVisualGuard(statusRef.current), 1200)
    ];

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => applyVisualGuard(statusRef.current));
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [status]);

  useEffect(() => {
    const onClick = (event) => {
      const target = event.target?.closest?.(".aa-agent-seat-action-disabled-r12b8");

      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", onClick, true);

    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
