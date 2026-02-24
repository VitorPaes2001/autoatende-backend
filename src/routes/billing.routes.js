const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const supabase = require('../config/supabase');

const authMiddleware = require('../middlewares/auth.middleware');
const rateLimit = require('../middlewares/rateLimit.middleware');

const FALLBACK_STATUS = {
  plan: 'Starter',
  status: 'inactive',
  limits: { conversations: Infinity, templates: 300, agents: 1 },
  usage: { conversations: 0, templates: 0, agents: 1 },
  features: {},
  blocked: { isBlocked: false }
};

router.get('/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('No token');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id, name, client_id, plan, status')
      .eq('client_id', user.id);

    if (companyError || !companies || companies.length === 0) throw new Error('Company not found');

    req.user = user;
    req.companyId = companies[0].id;
    return billingController.getStatus(req, res);
  } catch (error) {
    console.error('[BillingRoute] Safe Mode triggered:', error.message);
    return res.status(200).json(FALLBACK_STATUS);
  }
});

router.post('/portal', authMiddleware, rateLimit(10, 60), billingController.createPortalSession);
router.get('/summary', authMiddleware, rateLimit(60, 60), billingController.getMonthlySummary);
router.post('/overage/run', authMiddleware, rateLimit(10, 60), billingController.runOverageCycle);

module.exports = router;
