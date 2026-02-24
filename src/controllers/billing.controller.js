const billingService = require('../services/billing.service');
const overageBillingService = require('../services/overageBilling.service');

async function getStatus(req, res) {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const clientId = req.user?.id || req.user?.clientId;

    const status = await billingService.getBillingStatus(companyId, clientId);
    res.json(status);
  } catch (error) {
    console.error('[BillingController] Unexpected error in getStatus:', error);
    res.json({
      plan: 'Starter',
      status: 'inactive',
      limits: { conversations: Infinity, templates: 300, agents: 1 },
      usage: { conversations: 0, templates: 0, agents: 1 },
      features: {},
      blocked: { isBlocked: false }
    });
  }
}

async function createPortalSession(req, res, next) {
  try {
    const clientId = req.user?.id || req.user?.clientId;
    const returnUrl = req.body.returnUrl || process.env.FRONTEND_URL || 'http://localhost:3000/dashboard/settings/billing';
    const sessionUrl = await billingService.createPortalSession(clientId, returnUrl);
    res.json({ url: sessionUrl });
  } catch (error) {
    next(error);
  }
}

async function getMonthlySummary(req, res, next) {
  try {
    const clientId = req.user?.id || req.user?.clientId;
    const now = new Date();
    const month = Number(req.query.month || now.getMonth() + 1);
    const year = Number(req.query.year || now.getFullYear());

    const summary = await overageBillingService.getMonthlyUsageSummary(clientId, { month, year });
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

async function runOverageCycle(req, res, next) {
  try {
    const clientId = req.user?.id || req.user?.clientId;
    const now = new Date();
    const month = Number(req.body.month || now.getMonth() + 1);
    const year = Number(req.body.year || now.getFullYear());
    const dryRun = Boolean(req.body.dryRun);

    const result = await overageBillingService.chargeMonthlyOverage({ clientId, month, year, dryRun });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStatus,
  createPortalSession,
  getMonthlySummary,
  runOverageCycle
};
