/**
 * __AUTOATENDE_V4_R12B_R1_FIX_AGENT_SEAT_BACKEND_GUARD_REPORT_MODE_NO_HOST_NODE__
 *
 * Guard backend para limite de agentes por plano.
 *
 * Modo padrão: report
 * - report: registra observabilidade e não bloqueia criação.
 * - enforce: bloqueia POST /api/users/agents quando o limite do plano for atingido.
 *
 * Planos padrão:
 * - Essencial/Essential: 1 agente
 * - Profissional/Professional: 4 agentes
 * - Business: 8 agentes
 */

const {
  getSupabaseAdminClient,
  isSupabaseAdminUnavailableError,
} = require("../config/supabase");

const MARKER = "__AUTOATENDE_V4_R12B_R1_FIX_AGENT_SEAT_BACKEND_GUARD_REPORT_MODE_NO_HOST_NODE__";

const PLAN_LIMITS = {
  essencial: 1,
  essential: 1,
  profissional: 4,
  professional: 4,
  business: 8
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePlanName(value) {
  const raw = normalizeText(value);

  if (!raw) return "";

  if (raw.includes("business")) return "business";
  if (raw.includes("profissional") || raw.includes("professional") || raw.includes("pro")) return "profissional";
  if (raw.includes("essencial") || raw.includes("essential") || raw.includes("basic") || raw.includes("starter")) return "essencial";

  return raw;
}

function pickFirstNonEmpty(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function resolveCompanyId(req) {
  return pickFirstNonEmpty([
    req?.user?.company_id,
    req?.user?.companyId,
    req?.company_id,
    req?.companyId,
    req?.company?.id,
    req?.company?.company_id,
    req?.profile?.company_id,
    req?.body?.company_id,
    req?.query?.company_id
  ]);
}

function resolveClientId(req) {
  return pickFirstNonEmpty([
    req?.user?.client_id,
    req?.user?.clientId,
    req?.client_id,
    req?.clientId,
    req?.company?.client_id,
    req?.profile?.client_id,
    req?.body?.client_id,
    req?.query?.client_id
  ]);
}

function loadSupabaseClient() {
  return getSupabaseAdminClient();
}

async function getCompanyPlan(supabase, companyId, clientId) {
  const attempts = [];

  if (companyId) {
    attempts.push({
      table: "companies",
      column: "id",
      value: companyId,
      select: "id, plan, status, client_id"
    });

    attempts.push({
      table: "subscriptions",
      column: "company_id",
      value: companyId,
      select: "id, plan, plan_name, status, company_id, client_id"
    });
  }

  if (clientId) {
    attempts.push({
      table: "subscriptions",
      column: "client_id",
      value: clientId,
      select: "id, plan, plan_name, status, company_id, client_id"
    });

    attempts.push({
      table: "companies",
      column: "client_id",
      value: clientId,
      select: "id, plan, status, client_id"
    });
  }

  for (const attempt of attempts) {
    try {
      const { data, error } = await supabase
        .from(attempt.table)
        .select(attempt.select)
        .eq(attempt.column, attempt.value)
        .maybeSingle();

      if (error || !data) continue;

      const rawPlan = pickFirstNonEmpty([
        data.plan,
        data.plan_name,
        data.name,
        data.tier,
        data.product
      ]);

      const normalized = normalizePlanName(rawPlan);

      if (normalized && PLAN_LIMITS[normalized]) {
        return {
          source: `${attempt.table}.${attempt.column}`,
          rawPlan,
          normalized,
          limit: PLAN_LIMITS[normalized]
        };
      }
    } catch (_) {}
  }

  return {
    source: "unresolved",
    rawPlan: null,
    normalized: null,
    limit: null
  };
}

async function countActiveAgents(supabase, companyId) {
  if (!companyId) return null;

  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "agent");

  if (error) {
    throw error;
  }

  return Number(count || 0);
}

function agentSeatLimitMiddleware(options = {}) {
  const configuredMode = normalizeText(
    options.mode ||
    process.env.AGENT_SEAT_ENFORCEMENT_MODE ||
    "report"
  );

  const mode = configuredMode === "enforce" ? "enforce" : "report";

  return async function agentSeatLimitGuard(req, res, next) {
    const startedAt = Date.now();

    try {
      if (String(req.method || "").toUpperCase() !== "POST") {
        return next();
      }

      const companyId = resolveCompanyId(req);
      const clientId = resolveClientId(req);

      if (!companyId) {
        const payload = {
          marker: MARKER,
          mode,
          action: "missing_company_id",
          method: req.method,
          path: req.originalUrl || req.url
        };

        console.warn("[AGENT_SEAT_GUARD]", JSON.stringify(payload));

        if (mode === "enforce") {
          return res.status(400).json({
            error: "Não foi possível identificar a empresa para criar o agente.",
            code: "AGENT_SEAT_COMPANY_SCOPE_REQUIRED"
          });
        }

        req.agentSeatGuard = payload;
        return next();
      }

      const supabase = loadSupabaseClient();
      const plan = await getCompanyPlan(supabase, companyId, clientId);
      const currentAgents = await countActiveAgents(supabase, companyId);

      const atLimit =
        typeof plan.limit === "number" &&
        typeof currentAgents === "number" &&
        currentAgents >= plan.limit;

      const payload = {
        marker: MARKER,
        mode,
        action: atLimit ? "limit_reached" : "allowed",
        company_id: companyId,
        client_id: clientId || null,
        plan_source: plan.source,
        raw_plan: plan.rawPlan,
        normalized_plan: plan.normalized,
        limit: plan.limit,
        current_agents: currentAgents,
        elapsed_ms: Date.now() - startedAt
      };

      req.agentSeatGuard = payload;

      if (atLimit && mode === "enforce") {
        console.warn("[AGENT_SEAT_GUARD]", JSON.stringify(payload));

        return res.status(409).json({
          error: `Limite de agentes atingido para o plano ${plan.rawPlan || plan.normalized}.`,
          code: "AGENT_SEAT_LIMIT_REACHED",
          plan: plan.normalized,
          limit: plan.limit,
          current_agents: currentAgents
        });
      }

      console.info("[AGENT_SEAT_GUARD]", JSON.stringify(payload));
      return next();
    } catch (error) {
      if (isSupabaseAdminUnavailableError(error)) {
        return res.status(503).json({
          error: "Serviço administrativo de billing temporariamente indisponível.",
          code: error.code
        });
      }

      const payload = {
        marker: MARKER,
        mode,
        action: "guard_error",
        error: String(error?.message || error),
        details: error?.details || null,
        elapsed_ms: Date.now() - startedAt
      };

      console.warn("[AGENT_SEAT_GUARD]", JSON.stringify(payload));

      if (mode === "enforce") {
        return res.status(503).json({
          error: "Não foi possível validar o limite de agentes neste momento.",
          code: "AGENT_SEAT_GUARD_UNAVAILABLE"
        });
      }

      req.agentSeatGuard = payload;
      return next();
    }
  };
}

module.exports = agentSeatLimitMiddleware;
module.exports.MARKER = MARKER;
module.exports.PLAN_LIMITS = PLAN_LIMITS;
module.exports.normalizePlanName = normalizePlanName;

// __AUTOATENDE_R12B_R1B_STATUS_HELPER_START__
// __AUTOATENDE_V4_R12B_R1B_FIX_AGENT_SEAT_STATUS_ENDPOINT_ROBUST_PARSER__
async function resolveAgentSeatStatus(req) {
  const companyId = resolveCompanyId(req);
  const clientId = resolveClientId(req);

  if (!companyId) {
    return {
      marker: "__AUTOATENDE_V4_R12B_R1B_FIX_AGENT_SEAT_STATUS_ENDPOINT_ROBUST_PARSER__",
      ok: false,
      action: "missing_company_id",
      company_id: null,
      client_id: clientId || null,
      plan_source: null,
      raw_plan: null,
      normalized_plan: null,
      limit: null,
      current_agents: null,
      remaining: null,
      at_limit: false,
      enforcement_mode: normalizeText(process.env.AGENT_SEAT_ENFORCEMENT_MODE || "report") === "enforce" ? "enforce" : "report"
    };
  }

  const supabase = loadSupabaseClient();
  const plan = await getCompanyPlan(supabase, companyId, clientId);
  const currentAgents = await countActiveAgents(supabase, companyId);

  const hasLimit = typeof plan.limit === "number";
  const hasCount = typeof currentAgents === "number";
  const remaining = hasLimit && hasCount ? Math.max(plan.limit - currentAgents, 0) : null;
  const atLimit = hasLimit && hasCount ? currentAgents >= plan.limit : false;

  return {
    marker: "__AUTOATENDE_V4_R12B_R1B_FIX_AGENT_SEAT_STATUS_ENDPOINT_ROBUST_PARSER__",
    ok: true,
    action: atLimit ? "limit_reached" : "allowed",
    company_id: companyId,
    client_id: clientId || null,
    plan_source: plan.source,
    raw_plan: plan.rawPlan,
    normalized_plan: plan.normalized,
    limit: plan.limit,
    current_agents: currentAgents,
    remaining,
    at_limit: atLimit,
    enforcement_mode: normalizeText(process.env.AGENT_SEAT_ENFORCEMENT_MODE || "report") === "enforce" ? "enforce" : "report"
  };
}

module.exports.resolveAgentSeatStatus = resolveAgentSeatStatus;
module.exports.STATUS_MARKER = "__AUTOATENDE_V4_R12B_R1B_FIX_AGENT_SEAT_STATUS_ENDPOINT_ROBUST_PARSER__";
// __AUTOATENDE_R12B_R1B_STATUS_HELPER_END__


// __AUTOATENDE_V4_R12B_R7B_BACKEND_OWNER_AWARE_AGENT_SEAT_AUTHORITY__:START
/*
 * R12B-R7B
 * Authority backend para capacidade de usuários internos.
 * A capacidade do plano deve considerar titular da conta + agentes cadastrados.
 *
 * Compatibilidade:
 * - preserva o middleware anterior;
 * - preserva o helper resolveAgentSeatStatus existente;
 * - adiciona campos oficiais: used_seats/users_used/current_users/owner_seat_count;
 * - recalcula remaining/available/at_limit com base em usuários internos, não só agentes.
 */

const __r12bR7bOriginalExport = module.exports;
const __r12bR7bOriginalResolveAgentSeatStatus =
  typeof __r12bR7bOriginalExport?.resolveAgentSeatStatus === "function"
    ? __r12bR7bOriginalExport.resolveAgentSeatStatus.bind(__r12bR7bOriginalExport)
    : null;

function __r12bR7bToFiniteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function __r12bR7bFirstNumber(values, fallback = null) {
  for (const value of values) {
    const number = __r12bR7bToFiniteNumber(value, null);
    if (number !== null) return number;
  }
  return fallback;
}

function __r12bR7bNormalizeMode(value) {
  const raw = String(value || process.env.AGENT_SEAT_ENFORCEMENT_MODE || "report")
    .trim()
    .toLowerCase();

  return raw === "enforce" ? "enforce" : "report";
}

function __r12bR7bBuildOwnerAwareStatus(status) {
  const base = status && typeof status === "object" ? { ...status } : {};

  const currentAgents = __r12bR7bFirstNumber([
    base.current_agents,
    base.agents_current,
    base.agents_used,
    base.agent_count,
    base.currentAgents,
    base.used_agents
  ], 0);

  const ownerSeatCount = __r12bR7bFirstNumber([
    base.owner_seat_count,
    base.ownerSeatCount
  ], 1);

  const existingUsedSeats = __r12bR7bFirstNumber([
    base.used_seats,
    base.users_used,
    base.current_users,
    base.internal_users_used,
    base.seats_used,
    base.usedSeats
  ], null);

  const ownerAlreadyIncluded =
    base.owner_seat_included === true ||
    base.used_includes_owner === true ||
    base.counts_owner === true ||
    base.seat_count_basis === "owner_plus_agents";

  const usedSeats =
    existingUsedSeats !== null
      ? existingUsedSeats
      : currentAgents + ownerSeatCount;

  const normalizedUsedSeats =
    ownerAlreadyIncluded && existingUsedSeats !== null
      ? existingUsedSeats
      : usedSeats;

  const limit = __r12bR7bFirstNumber([
    base.limit,
    base.agent_limit,
    base.seat_limit,
    base.users_limit,
    base.max_agents,
    base.max_users,
    base.included_agents,
    base.included_seats
  ], null);

  const remaining =
    limit !== null
      ? Math.max(limit - normalizedUsedSeats, 0)
      : __r12bR7bFirstNumber([base.remaining, base.available, base.available_agents], null);

  const atLimit =
    limit !== null
      ? normalizedUsedSeats >= limit
      : Boolean(base.at_limit || base.limit_reached);

  const mode = __r12bR7bNormalizeMode(base.mode || base.enforcement_mode);

  return {
    ...base,

    current_agents: currentAgents,
    agents_used: currentAgents,

    owner_seat_count: ownerSeatCount,
    owner_seat_included: true,
    used_includes_owner: true,
    seat_count_basis: "owner_plus_agents",

    used_seats: normalizedUsedSeats,
    users_used: normalizedUsedSeats,
    current_users: normalizedUsedSeats,
    internal_users_used: normalizedUsedSeats,

    limit,
    remaining,
    available: remaining,
    available_seats: remaining,

    at_limit: atLimit,
    limit_reached: atLimit,

    mode,
    enforcement_mode: mode,

    r12b_r7b_backend_authority: true
  };
}

async function __r12bR7bResolveAgentSeatStatus(req) {
  if (!__r12bR7bOriginalResolveAgentSeatStatus) {
    throw new Error("resolveAgentSeatStatus original indisponível");
  }

  const status = await __r12bR7bOriginalResolveAgentSeatStatus(req);
  return __r12bR7bBuildOwnerAwareStatus(status);
}

function __r12bR7bAgentSeatLimit(options = {}) {
  return async function r12bR7bAgentSeatLimitMiddleware(req, res, next) {
    try {
      const status = await __r12bR7bResolveAgentSeatStatus(req);
      req.agentSeatStatus = status;

      const mode = __r12bR7bNormalizeMode(options.mode || status.mode);

      console.info("[AGENT_SEAT_GUARD]", JSON.stringify({
        marker: "__AUTOATENDE_V4_R12B_R7B_BACKEND_OWNER_AWARE_AGENT_SEAT_AUTHORITY__",
        mode,
        company_id: status.company_id || status.companyId || null,
        plan: status.normalized_plan || status.raw_plan || status.plan || null,
        current_agents: status.current_agents,
        owner_seat_count: status.owner_seat_count,
        used_seats: status.used_seats,
        limit: status.limit,
        remaining: status.remaining,
        at_limit: status.at_limit
      }));

      if (mode === "enforce" && status.at_limit) {
        return res.status(403).json({
          ok: false,
          error: "Limite de usuários internos atingido para o plano atual.",
          code: "AGENT_SEAT_LIMIT_REACHED",
          status
        });
      }

      return next();
    } catch (error) {
      if (isSupabaseAdminUnavailableError(error)) {
        return res.status(503).json({
          error: "Serviço administrativo de billing temporariamente indisponível.",
          code: error.code
        });
      }

      console.warn("[AGENT_SEAT_GUARD]", JSON.stringify({
        marker: "__AUTOATENDE_V4_R12B_R7B_BACKEND_OWNER_AWARE_AGENT_SEAT_AUTHORITY__",
        action: "guard_error",
        error: String(error?.message || error)
      }));

      return next();
    }
  };
}

Object.keys(__r12bR7bOriginalExport || {}).forEach((key) => {
  __r12bR7bAgentSeatLimit[key] = __r12bR7bOriginalExport[key];
});

__r12bR7bAgentSeatLimit.resolveAgentSeatStatus = __r12bR7bResolveAgentSeatStatus;
__r12bR7bAgentSeatLimit.__buildOwnerAwareStatus = __r12bR7bBuildOwnerAwareStatus;
__r12bR7bAgentSeatLimit.__r12b_r7b_marker = "__AUTOATENDE_V4_R12B_R7B_BACKEND_OWNER_AWARE_AGENT_SEAT_AUTHORITY__";

module.exports = __r12bR7bAgentSeatLimit;
// __AUTOATENDE_V4_R12B_R7B_BACKEND_OWNER_AWARE_AGENT_SEAT_AUTHORITY__:END


// __AUTOATENDE_V4_R12B_R7C_FIX_BACKEND_ONLY_ZERO_LIMIT_PLAN_INFERENCE__:START
/*
 * R12B-R7C-FIX
 * Backend-only: corrige limit 0/null/inválido com base no plano reconhecido.
 *
 * Motivo:
 * - R12B-R7B passou a contar titular + agentes corretamente.
 * - Porém o status podia continuar retornando limit=0.
 * - A tela então mostrava Business / usados 4 / limite 0 / disponíveis 0.
 *
 * Regra oficial:
 * - Essencial: 1 usuário interno
 * - Profissional: 4 usuários internos
 * - Business: 8 usuários internos
 */

const __r12bR7cFixPreviousExport = module.exports;
const __r12bR7cFixPreviousResolve =
  typeof __r12bR7cFixPreviousExport?.resolveAgentSeatStatus === "function"
    ? __r12bR7cFixPreviousExport.resolveAgentSeatStatus.bind(__r12bR7cFixPreviousExport)
    : null;

function __r12bR7cFixNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function __r12bR7cFixNormalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function __r12bR7cFixInferLimitFromPlan(status) {
  const candidates = [
    status?.normalized_plan,
    status?.plan,
    status?.raw_plan,
    status?.plan_name,
    status?.subscription_plan,
    status?.billing_plan,
    status?.stripe_plan,
    status?.product_name,
    status?.tier
  ];

  const joined = candidates
    .map(__r12bR7cFixNormalizeText)
    .filter(Boolean)
    .join(" ");

  if (joined.includes("business")) return 8;
  if (joined.includes("profissional") || joined.includes("professional")) return 4;
  if (joined.includes("essencial") || joined.includes("essential")) return 1;

  return null;
}

function __r12bR7cFixFirstPositive(values, fallback = null) {
  for (const value of values) {
    const number = __r12bR7cFixNumber(value, null);
    if (number !== null && number > 0) return number;
  }

  return fallback;
}

function __r12bR7cFixFirstNumber(values, fallback = null) {
  for (const value of values) {
    const number = __r12bR7cFixNumber(value, null);
    if (number !== null) return number;
  }

  return fallback;
}

function __r12bR7cFixApplyPlanLimitGuard(status) {
  const base = status && typeof status === "object" ? { ...status } : {};

  const inferredLimit = __r12bR7cFixInferLimitFromPlan(base);

  const rawLimit = __r12bR7cFixFirstPositive([
    base.limit,
    base.agent_limit,
    base.seat_limit,
    base.users_limit,
    base.max_agents,
    base.max_users,
    base.included_agents,
    base.included_seats
  ], null);

  const limit = rawLimit || inferredLimit;

  const used = __r12bR7cFixFirstNumber([
    base.used_seats,
    base.users_used,
    base.current_users,
    base.internal_users_used,
    base.seats_used
  ], 0);

  const remaining =
    limit !== null && limit !== undefined
      ? Math.max(limit - used, 0)
      : null;

  const atLimit =
    limit !== null && limit !== undefined
      ? used >= limit
      : Boolean(base.at_limit || base.limit_reached);

  return {
    ...base,

    limit,
    agent_limit: limit,
    seat_limit: limit,
    users_limit: limit,

    remaining,
    available: remaining,
    available_seats: remaining,

    at_limit: atLimit,
    limit_reached: atLimit,

    r12b_r7c_fix_limit_inferred_from_plan: Boolean(!rawLimit && inferredLimit),
    r12b_r7c_fix_backend_authority: true
  };
}

if (!__r12bR7cFixPreviousResolve) {
  throw new Error("R12B-R7C-FIX: resolveAgentSeatStatus anterior indisponível");
}

async function __r12bR7cFixResolveAgentSeatStatus(req) {
  const status = await __r12bR7cFixPreviousResolve(req);
  return __r12bR7cFixApplyPlanLimitGuard(status);
}

function __r12bR7cFixAgentSeatLimit(options = {}) {
  return async function r12bR7cFixAgentSeatLimitMiddleware(req, res, next) {
    try {
      const status = await __r12bR7cFixResolveAgentSeatStatus(req);
      req.agentSeatStatus = status;

      const mode = String(
        options.mode ||
        status.mode ||
        status.enforcement_mode ||
        process.env.AGENT_SEAT_ENFORCEMENT_MODE ||
        "report"
      ).toLowerCase() === "enforce" ? "enforce" : "report";

      console.info("[AGENT_SEAT_GUARD]", JSON.stringify({
        marker: "__AUTOATENDE_V4_R12B_R7C_FIX_BACKEND_ONLY_ZERO_LIMIT_PLAN_INFERENCE__",
        mode,
        plan: status.normalized_plan || status.plan || status.raw_plan || null,
        used_seats: status.used_seats,
        limit: status.limit,
        remaining: status.remaining,
        inferred_from_plan: status.r12b_r7c_fix_limit_inferred_from_plan,
        at_limit: status.at_limit
      }));

      if (mode === "enforce" && status.at_limit) {
        return res.status(403).json({
          ok: false,
          error: "Limite de usuários internos atingido para o plano atual.",
          code: "AGENT_SEAT_LIMIT_REACHED",
          status
        });
      }

      return next();
    } catch (error) {
      if (isSupabaseAdminUnavailableError(error)) {
        return res.status(503).json({
          error: "Serviço administrativo de billing temporariamente indisponível.",
          code: error.code
        });
      }

      console.warn("[AGENT_SEAT_GUARD]", JSON.stringify({
        marker: "__AUTOATENDE_V4_R12B_R7C_FIX_BACKEND_ONLY_ZERO_LIMIT_PLAN_INFERENCE__",
        action: "guard_error",
        error: String(error?.message || error)
      }));

      return next();
    }
  };
}

Object.keys(__r12bR7cFixPreviousExport || {}).forEach((key) => {
  __r12bR7cFixAgentSeatLimit[key] = __r12bR7cFixPreviousExport[key];
});

__r12bR7cFixAgentSeatLimit.resolveAgentSeatStatus = __r12bR7cFixResolveAgentSeatStatus;
__r12bR7cFixAgentSeatLimit.__applyPlanLimitGuard = __r12bR7cFixApplyPlanLimitGuard;
__r12bR7cFixAgentSeatLimit.__r12b_r7c_fix_marker = "__AUTOATENDE_V4_R12B_R7C_FIX_BACKEND_ONLY_ZERO_LIMIT_PLAN_INFERENCE__";

module.exports = __r12bR7cFixAgentSeatLimit;
// __AUTOATENDE_V4_R12B_R7C_FIX_BACKEND_ONLY_ZERO_LIMIT_PLAN_INFERENCE__:END
