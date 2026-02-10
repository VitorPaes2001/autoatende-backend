const billingService = require('../services/billing.service');
const AppError = require('../utils/AppError');

/**
 * Controller de Billing e Planos
 */

/**
 * Retorna o status detalhado da assinatura e limites
 * GET /api/billing/status
 */
async function getStatus(req, res, next) {
  try {
    // Fix: Extract IDs correctly from request context (injected by auth middleware)
    const companyId = req.companyId || req.user?.companyId; 
    const clientId = req.user?.id || req.user?.clientId;

    // Validation: Ensure IDs are present
    if (!companyId || !clientId) {
      console.error('[BillingController] Missing context:', { companyId, clientId, user: req.user });
      // Don't crash, just let it fail gracefully into fallback or service handling
      // But logging is crucial.
    }

    // Utiliza o service blindado para obter o status
    const status = await billingService.getBillingStatus(companyId, clientId);
    
    res.json(status);

  } catch (error) {
    console.error('[BillingController] Unexpected error in getStatus:', error);
    
    // Fallback de Último Recurso (Controller Level)
    // Caso o próprio service falhe catastroficamente (ex: erro de import, sintaxe)
    res.json({
      plan: 'Start',
      status: 'inactive',
      limits: {
        conversations: 400,
        templates: 80,
        agents: 1
      },
      usage: {
        conversations: 0,
        templates: 0,
        agents: 1
      },
      features: {},
      blocked: {
        isBlocked: false
      }
    });
  }
}

/**
 * Cria sessão do Portal do Cliente Stripe
 * POST /api/billing/portal
 */
async function createPortalSession(req, res, next) {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const clientId = req.user?.id || req.user?.clientId;
    
    // URL de retorno (Frontend)
    const returnUrl = req.body.returnUrl || process.env.FRONTEND_URL || 'http://localhost:3000/dashboard/settings/billing';

    const sessionUrl = await billingService.createPortalSession(clientId, returnUrl);

    res.json({ url: sessionUrl });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStatus,
  createPortalSession
};
