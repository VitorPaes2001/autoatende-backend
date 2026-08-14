/**
 * __AUTOATENDE_V4_R12D_A3_FAIL_SOFT_UNRESOLVED_AGENT_SEAT_LIMIT__
 *
 * Wrapper seguro para o limite de usuários internos.
 *
 * Problema corrigido:
 * - O middleware original pode resolver plan=null e limit=null.
 * - Em modo enforce, isso estava virando at_limit=true.
 * - Resultado: criação de agente bloqueada por falso positivo.
 *
 * Regra deste wrapper:
 * - Se limite conhecido e usado >= limite: bloqueia.
 * - Se limite conhecido e ainda há capacidade: permite.
 * - Se limite NÃO foi resolvido: não bloqueia por falso positivo, mas registra log forte.
 *
 * Observação:
 * - A solução definitiva futura é tornar a resolução de plano/limite 100% autoritativa no backend.
 */

const { isSupabaseAdminUnavailableError } = require("../config/supabase");
const baseAgentSeatLimit = require("./agentSeatLimit.middleware");

const MARKER = "__AUTOATENDE_V4_R12D_A3_FAIL_SOFT_UNRESOLVED_AGENT_SEAT_LIMIT__";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return null;

  return numberValue;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const numberValue = toNumber(value);

    if (numberValue !== null && numberValue > 0) {
      return numberValue;
    }
  }

  return null;
}

function firstNonNegativeNumber(...values) {
  for (const value of values) {
    const numberValue = toNumber(value);

    if (numberValue !== null && numberValue >= 0) {
      return numberValue;
    }
  }

  return null;
}

function pickLimit(status) {
  if (!status || typeof status !== "object") return null;

  return firstPositiveNumber(
    status.limit,
    status.agent_limit,
    status.seat_limit,
    status.users_limit,
    status.limits?.agents,
    status.limits?.agent_limit,
    status.limits?.seat_limit,
    status.limits?.users_limit,
    status.plan?.limits?.agents,
    status.plan?.agent_limit,
    status.plan?.seat_limit,
    status.plan?.users_limit
  );
}

function pickUsed(status) {
  if (!status || typeof status !== "object") return 0;

  return firstNonNegativeNumber(
    status.users_used,
    status.used_seats,
    status.internal_users_used,
    status.current_users,
    status.current_seats,
    status.agents_used,
    status.current_agents
  ) ?? 0;
}

function getMode() {
  return String(process.env.AGENT_SEAT_ENFORCEMENT_MODE || "report")
    .trim()
    .toLowerCase();
}

function getUnresolvedPolicy() {
  return String(process.env.AGENT_SEAT_UNRESOLVED_LIMIT_POLICY || "allow")
    .trim()
    .toLowerCase();
}

async function resolveStatus(req) {
  if (typeof baseAgentSeatLimit.resolveAgentSeatStatus === "function") {
    return await baseAgentSeatLimit.resolveAgentSeatStatus(req);
  }

  return null;
}

function agentSeatLimitFailSoft(options = {}) {
  return async function agentSeatLimitFailSoftGuard(req, res, next) {
    const mode = getMode();
    const unresolvedPolicy = getUnresolvedPolicy();

    try {
      const status = await resolveStatus(req);

      req.agentSeatStatus = status;

      const limit = pickLimit(status);
      const used = pickUsed(status);
      const limitKnown = Number.isFinite(limit) && limit > 0;
      const atLimit = limitKnown ? used >= limit : false;

      const logPayload = {
        marker: MARKER,
        mode,
        unresolved_policy: unresolvedPolicy,
        company_id: status?.company_id || req.company?.id || req.user?.company_id || null,
        client_id: status?.client_id || req.client?.id || req.user?.client_id || req.user?.id || null,
        plan_source: status?.plan_source || null,
        raw_plan: status?.raw_plan || null,
        normalized_plan: status?.normalized_plan || status?.plan || null,
        limit,
        used,
        limit_known: limitKnown,
        at_limit: atLimit,
        original_at_limit: Boolean(status?.at_limit || status?.limit_reached),
        original_limit: status?.limit ?? null,
        original_users_limit: status?.users_limit ?? null,
        original_agent_limit: status?.agent_limit ?? null,
        original_seat_limit: status?.seat_limit ?? null
      };

      console.log("[AGENT_SEAT_FAIL_SOFT_GUARD]", JSON.stringify(logPayload));

      if (mode === "enforce" && limitKnown && atLimit) {
        return res.status(403).json({
          error: "Limite de usuários internos atingido para o plano atual.",
          code: "AGENT_SEAT_LIMIT_REACHED",
          marker: MARKER,
          used,
          limit,
          available: Math.max(0, limit - used)
        });
      }

      if (mode === "enforce" && !limitKnown) {
        if (unresolvedPolicy === "block") {
          return res.status(503).json({
            error: "Não foi possível validar o limite de usuários internos neste momento.",
            code: "AGENT_SEAT_LIMIT_UNRESOLVED",
            marker: MARKER
          });
        }

        console.warn("[AGENT_SEAT_FAIL_SOFT_GUARD_UNRESOLVED_ALLOWED]", JSON.stringify({
          marker: MARKER,
          reason: "limit_unresolved_fail_soft",
          mode,
          unresolved_policy: unresolvedPolicy,
          used
        }));
      }

      return next();
    } catch (error) {
      if (isSupabaseAdminUnavailableError(error)) {
        return res.status(503).json({
          error: "Serviço administrativo de billing temporariamente indisponível.",
          code: error.code,
          marker: MARKER
        });
      }

      console.error("[AGENT_SEAT_FAIL_SOFT_GUARD_ERROR]", JSON.stringify({
        marker: MARKER,
        message: error?.message || String(error)
      }));

      if (mode === "enforce" && getUnresolvedPolicy() === "block") {
        return res.status(503).json({
          error: "Não foi possível validar o limite de usuários internos neste momento.",
          code: "AGENT_SEAT_LIMIT_VALIDATION_FAILED",
          marker: MARKER
        });
      }

      return next();
    }
  };
}

agentSeatLimitFailSoft.resolveAgentSeatStatus = baseAgentSeatLimit.resolveAgentSeatStatus;
agentSeatLimitFailSoft._base = baseAgentSeatLimit;

module.exports = agentSeatLimitFailSoft;
