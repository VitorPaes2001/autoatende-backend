const companyService = require('../services/company.service');
const AppError = require('../utils/AppError');
const { isPlanAtLeast, PLANS } = require('../config/plans');
const supabase = require('../config/supabase'); // Para verificar contagem de agentes

/**
 * Middleware para garantir que a empresa tenha um plano mínimo
 * @param {string} minPlanKey - 'free', 'pro', 'business'
 */
function requirePlan(minPlanKey) {
  return async (req, res, next) => {
    try {
      // req.companyId e req.company são populados pelo authMiddleware
      if (!req.company || !req.company.client_id) {
         // Fallback se authMiddleware não tiver rodado (embora deva rodar antes)
         throw new AppError('Authentication context missing', 500);
      }
      
      const subscription = await companyService.getActivePlan(req.company.client_id);
      
      if (!subscription) {
        throw new AppError('No active plan found', 403, { code: 'NO_PLAN' });
      }

      // Verifica hierarquia
      if (!isPlanAtLeast(subscription.plan, minPlanKey)) {
        throw new AppError(`Plan ${minPlanKey} required. Current: ${subscription.plan}`, 403, { 
          code: 'UPGRADE_REQUIRED',
          currentPlan: subscription.plan,
          requiredPlan: minPlanKey,
          action: 'upgrade_plan'
        });
      }

      // Injeta info do plano na requisição para uso posterior
      req.plan = subscription;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware para verificar limites de recursos que NÃO são consumo (ex: Agentes)
 * Consumo (conversas/templates) é verificado no usage.service.js
 */
async function checkResourceLimit(req, res, next) {
  try {
    // Apenas verifica se a rota é de criação de agente/usuário
    // Assumindo que a rota é POST /users ou POST /agents
    if (req.method === 'POST' && (req.path.includes('/users') || req.path.includes('/agents'))) {
      const companyId = req.companyId;
      if (!companyId) throw new AppError('Company context missing', 500);

      const subscription = await companyService.getActivePlan(req.company.client_id);
      
      if (!subscription) {
        throw new AppError('No active plan found', 403);
      }

      // Mapeia o nome do plano do DB para a config local para pegar o limite de agentes
      // O DB retorna { plan: 'Pro', ... }. A config usa keys 'start', 'pro', 'business'.
      const planConfig = Object.values(PLANS).find(p => p.name.toLowerCase() === subscription.plan.toLowerCase()) || PLANS.START;
      const agentLimit = planConfig.limits.agents;

      // Conta agentes atuais
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      if (error) {
        console.error('Error counting agents:', error);
        throw new AppError('Internal error checking limits', 500);
      }

      if (count >= agentLimit) {
        throw new AppError(`Agent limit reached for plan ${subscription.plan}`, 403, {
          code: 'LIMIT_EXCEEDED',
          resource: 'agents',
          limit: agentLimit,
          current: count,
          action: 'upgrade_plan'
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
