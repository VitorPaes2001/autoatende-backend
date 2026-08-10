import React, { useCallback, useEffect, useMemo, useState } from "react";

/**
 * __AUTOATENDE_V4_R12B_R6_OWNER_SEAT_COUNT_CLEAN_UI__
 *
 * Painel somente leitura para limite de usuários internos.
 * Conta usuário titular + agentes cadastrados para alinhar com Meu Plano.
 */

const MARKER = "__AUTOATENDE_V4_R12B_R6_OWNER_SEAT_COUNT_CLEAN_UI__";

const PLAN_LIMITS = {
  essencial: 1,
  essential: 1,
  profissional: 4,
  professional: 4,
  pro: 4,
  business: 8
};

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    const directKeys = ["access_token", "accessToken", "jwt", "token"];

    for (const key of directKeys) {
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

  const globals = [
    window.__AUTOATENDE_SESSION__,
    window.__AUTOATENDE_AUTH__,
    window.__AUTOATENDE_USER__
  ];

  for (const item of globals) {
    const found = findTokenDeep(item);
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

    const priorityKeys = keys
      .filter((key) => /auth|session|supabase|autoatende|token/i.test(key))
      .concat(keys.filter((key) => !/auth|session|supabase|autoatende|token/i.test(key)));

    for (const key of priorityKeys) {
      const raw = store.getItem(key);
      if (!raw) continue;

      const found = findTokenDeep(raw);
      if (found) return found;
    }
  }

  return null;
}

function walk(value, visit, depth = 0, path = []) {
  if (depth > 8 || value === null || value === undefined) return;

  visit(value, path);

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, depth + 1, path.concat(index)));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      walk(item, visit, depth + 1, path.concat(key));
    });
  }
}

function findPlanName(payload) {
  let best = null;

  walk(payload, (value, path) => {
    if (best) return;
    if (typeof value !== "string") return;

    const keyPath = normalize(path.join(" "));
    const text = normalize(value);

    const looksLikePlanKey =
      keyPath.includes("plan") ||
      keyPath.includes("plano") ||
      keyPath.includes("subscription") ||
      keyPath.includes("assinatura") ||
      keyPath.includes("tier") ||
      keyPath.includes("package");

    const hasKnownPlan =
      text.includes("business") ||
      text.includes("profissional") ||
      text.includes("professional") ||
      text.includes("essencial") ||
      text.includes("essential") ||
      text === "pro";

    if (looksLikePlanKey && hasKnownPlan) {
      best = value;
    }
  });

  if (best) return best;

  walk(payload, (value) => {
    if (best) return;
    if (typeof value !== "string") return;

    const text = normalize(value);

    if (
      text.includes("business") ||
      text.includes("profissional") ||
      text.includes("professional") ||
      text.includes("essencial") ||
      text.includes("essential")
    ) {
      best = value;
    }
  });

  return best;
}

function findNumericByKeys(payload, keys) {
  let best = null;

  walk(payload, (value, path) => {
    if (best !== null) return;

    const pathText = normalize(path.join("_")).replace(/[\s-]/g, "");
    const number = Number(value);

    if (!Number.isFinite(number)) return;
    if (number < 0 || number > 500) return;

    const matchesKey = keys.some((key) => pathText.includes(key.replace(/_/g, "")));

    if (matchesKey) {
      best = number;
    }
  });

  return best;
}

function inferPlanLimit(planName) {
  const text = normalize(planName);

  if (!text) return null;
  if (text.includes("business")) return PLAN_LIMITS.business;
  if (text.includes("profissional") || text.includes("professional")) return PLAN_LIMITS.profissional;
  if (text === "pro" || text.includes(" pro ")) return PLAN_LIMITS.pro;
  if (text.includes("essencial") || text.includes("essential")) return PLAN_LIMITS.essencial;

  return null;
}

function formatPlan(value) {
  const raw = String(value || "").trim();

  if (!raw) return "Não identificado";

  const text = normalize(raw);

  if (text.includes("business")) return "Business";
  if (text.includes("profissional") || text.includes("professional") || text === "pro") return "Profissional";
  if (text.includes("essencial") || text.includes("essential")) return "Essencial";

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function valueOrDash(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

async function requestJson(path, token) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: "GET",
    headers,
    credentials: "include"
  });

  const payload = await response.json().catch(() => null);

  return {
    ok: response.ok,
    statusCode: response.status,
    payload
  };
}

export default function AgentSeatStatusInline() {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: null,
    seatStatus: null,
    billingStatus: null
  });

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    const token = getAccessToken();

    setState((prev) => ({
      ...prev,
      loading: !silent && !prev.seatStatus,
      refreshing: silent || Boolean(prev.seatStatus),
      error: null
    }));

    try {
      const seatResult = await requestJson("/api/users/agents/seat-status", token);
      const billingResult = await requestJson("/api/billing/status", token);

      if (!seatResult.ok) {
        const message =
          seatResult.statusCode === 401 || seatResult.statusCode === 403
            ? "Sessão sem permissão para consultar o limite de usuários."
            : seatResult.payload?.error || "Não foi possível consultar o limite de usuários.";

        setState({
          loading: false,
          refreshing: false,
          error: message,
          seatStatus: null,
          billingStatus: billingResult.ok ? billingResult.payload : null
        });

        return;
      }

      setState({
        loading: false,
        refreshing: false,
        error: null,
        seatStatus: seatResult.payload?.status || null,
        billingStatus: billingResult.ok ? billingResult.payload : null
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error: String(error?.message || error || "Erro ao consultar limite de usuários."),
        seatStatus: null,
        billingStatus: null
      });
    }
  }, []);

  useEffect(() => {
    loadStatus();

    const onFocus = () => loadStatus({ silent: true });
    const onRefresh = () => loadStatus({ silent: true });

    window.addEventListener("focus", onFocus);
    window.addEventListener("autoatende:agents-updated", onRefresh);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("autoatende:agents-updated", onRefresh);
    };
  }, [loadStatus]);

  const visual = useMemo(() => {
    // __AUTOATENDE_V4_R12B_R7B_FRONTEND_USE_BACKEND_SEAT_AUTHORITY__
    const seatStatus = state.seatStatus || {};
    const billingStatus = state.billingStatus || {};

    const planName =
      seatStatus.raw_plan ||
      seatStatus.normalized_plan ||
      findPlanName(billingStatus);

    const explicitLimit =
      typeof seatStatus.limit === "number"
        ? seatStatus.limit
        : findNumericByKeys(billingStatus, [
            "agent_limit",
            "agents_limit",
            "max_agents",
            "seats_included",
            "included_agents",
            "internal_users_limit",
            "usuarios_internos",
            "limite_agentes"
          ]);

    const inferredLimit = inferPlanLimit(planName);
    const limit = typeof explicitLimit === "number" ? explicitLimit : inferredLimit;

    const backendUsed = findNumericByKeys(seatStatus, [
      "used_seats",
      "users_used",
      "current_users",
      "internal_users_used",
      "seats_used"
    ]);

    const billingUsed = findNumericByKeys(billingStatus, [
      "seats_used",
      "used_seats",
      "agents_used",
      "users_used",
      "internal_users_used",
      "usuarios_usados",
      "used_agents"
    ]);

    const agentsOnly =
      typeof seatStatus.current_agents === "number"
        ? seatStatus.current_agents
        : null;

    const used =
      typeof backendUsed === "number"
        ? backendUsed
        : typeof billingUsed === "number"
          ? billingUsed
          : typeof agentsOnly === "number"
            ? agentsOnly + 1
            : null;

    const remaining =
      typeof limit === "number" && typeof used === "number"
        ? Math.max(limit - used, 0)
        : null;

    const atLimit =
      typeof limit === "number" && typeof used === "number"
        ? used >= limit
        : Boolean(seatStatus.at_limit);

    const percent =
      typeof limit === "number" && limit > 0 && typeof used === "number"
        ? Math.min(Math.round((used / limit) * 100), 100)
        : 0;

    return {
      plan: formatPlan(planName),
      limit,
      used,
      remaining,
      atLimit,
      percent
    };
  }, [state.seatStatus, state.billingStatus]);

  const usageText =
    typeof visual.remaining === "number" && typeof visual.limit === "number"
      ? `${visual.remaining} disponíveis de ${visual.limit}`
      : "Limite em validação";

  return (
    <section className="aa-agent-seat-status-r12b2 aa-agent-seat-status-r12b6" data-marker={MARKER}>
      <div className="aa-agent-seat-status-r12b2__header">
        <div>
          <p className="aa-agent-seat-status-r12b2__eyebrow">LIMITE DO PLANO</p>
          <h3>Capacidade de usuários internos</h3>
          <p>Inclui o titular da conta e os agentes cadastrados no atendimento.</p>
        </div>

        <button
          type="button"
          onClick={() => loadStatus({ silent: true })}
          disabled={state.loading || state.refreshing}
          className="aa-agent-seat-status-r12b2__refresh"
        >
          {state.refreshing ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {state.loading ? (
        <div className="aa-agent-seat-status-r12b2__loading">
          Carregando limite de usuários...
        </div>
      ) : state.error ? (
        <div className="aa-agent-seat-status-r12b2__error">{state.error}</div>
      ) : (
        <>
          <div className="aa-agent-seat-status-r12b2__grid">
            <div>
              <span>Plano</span>
              <strong>{visual.plan}</strong>
            </div>

            <div>
              <span>Usuários usados</span>
              <strong>{valueOrDash(visual.used)}</strong>
            </div>

            <div>
              <span>Limite</span>
              <strong>{valueOrDash(visual.limit)}</strong>
            </div>

            <div>
              <span>Disponíveis</span>
              <strong>{valueOrDash(visual.remaining)}</strong>
            </div>
          </div>

          <div className="aa-agent-seat-status-r12b2__bar">
            <span style={{ width: `${visual.percent}%` }} />
          </div>

          <div className="aa-agent-seat-status-r12b2__footer">
            <span className={visual.atLimit ? "is-limit" : "is-ok"}>
              {visual.atLimit ? "Limite atingido" : "Dentro do limite"}
            </span>
            <span>{usageText}</span>
          </div>
        </>
      )}
    </section>
  );
}
