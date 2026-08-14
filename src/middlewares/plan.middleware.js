const companyService = require("../services/company.service");
const AppError = require("../utils/AppError");
const { isPlanAtLeast, PLANS, getCommercialPlanByAnyKey, getPlanByName } = require("../config/plans");
const supabase = require("../config/supabase");

/**
 * Middleware para garantir que a empresa tenha um plano mínimo
 * @param {string} minPlanKey - ex: "start", "pro", "business"
 */
function requirePlan(minPlanKey) {
  return async (req, res, next) => {
    try {
      if (!req.company || !req.company.client_id) {
        throw new AppError("Authentication context missing", 500);
      }

      const subscription = await companyService.getActivePlan(req.company.client_id);

      if (!subscription) {
        throw new AppError("No active plan found", 403, { code: "NO_PLAN" });
      }

      if (!isPlanAtLeast(subscription.plan, minPlanKey)) {
        throw new AppError(`Plan ${minPlanKey} required. Current: ${subscription.plan}`, 403, {
          code: "UPGRADE_REQUIRED",
          currentPlan: subscription.plan,
          requiredPlan: minPlanKey,
          action: "upgrade_plan"
        });
      }

      req.plan = subscription;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/* __AUTOATENDE_C11A_R2B_AGENT_LIMIT_HARDENING_FIX__ */
function resolveAgentLimitFromSubscription(subscription) {
  const rawPlan = String(subscription?.plan || "").trim();

  const commercial = getCommercialPlanByAnyKey(rawPlan);
  if (commercial?.included?.agents != null) {
    return {
      agentLimit: Number(commercial.included.agents) || 1,
      resolvedPlanKey: commercial.key || rawPlan || "starter",
      resolutionSource: "commercial_catalog"
    };
  }

  const legacyPlan = getPlanByName(rawPlan);
  if (legacyPlan?.limits?.agents != null) {
    return {
      agentLimit: Number(legacyPlan.limits.agents) || 1,
      resolvedPlanKey: legacyPlan.key || rawPlan || "starter",
      resolutionSource: "legacy_plan"
    };
  }

  return {
    agentLimit: Number(PLANS.STARTER?.limits?.agents || 1),
    resolvedPlanKey: "starter",
    resolutionSource: "starter_fallback"
  };
}

/**
 * Middleware para verificar limites de recursos que NÃO são consumo
 * Ex.: agentes/usuários internos
 */
async function checkResourceLimit(req, res, next) {
  try {
    if (req.method === "POST" && (req.path.includes("/users") || req.path.includes("/agents"))) {
      const companyId = req.companyId;
      if (!companyId) throw new AppError("Company context missing", 500);

      const subscription = await companyService.getActivePlan(req.company.client_id);

      if (!subscription) {
        throw new AppError("No active plan found", 403);
      }

      const {
          agentLimit,
          resolvedPlanKey,
          resolutionSource
        } = resolveAgentLimitFromSubscription(subscription);

      const { count, error } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .neq("role", "company");

      if (error) {
        console.error("Error counting agents:", error);
        throw new AppError("Internal error checking limits", 500);
      }

      if ((count || 0) >= agentLimit) {
          throw new AppError("Limite de agentes do plano atingido", 409, {
            code: "AGENT_LIMIT_EXCEEDED",
            resource: "agents",
            limit: agentLimit,
            current: count || 0,
            plan: subscription.plan,
            resolvedPlanKey,
            resolutionSource,
            action: "upgrade_plan",
            userMessage: `Seu plano atual permite até ${agentLimit} agente(s). Faça upgrade para adicionar mais usuários internos.`
          });
        }
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requirePlan,
  checkResourceLimit
};
