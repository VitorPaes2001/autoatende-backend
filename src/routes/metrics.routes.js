// __AUTOATENDE_V4_R12D_A6_AGENT_OPERATIONAL_TEMPLATES_ACCESS__
const express = require('express');
const router = express.Router();
const { canonicalizeTemplateUsagePayloadMiddleware } = require('../middleware/canonicalizeTemplateUsagePayload.middleware');
router.use(canonicalizeTemplateUsagePayloadMiddleware);
const metricsController = require('../controllers/metrics.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const rateLimit = require('../middlewares/rateLimit.middleware');
const { requirePlan } = require('../middlewares/plan.middleware');

// Rotas de métricas
// Protegidas por Auth + Role (Company/Admin) + RateLimit + Plan

// GET /api/metrics/overview
router.get('/overview', 
  authMiddleware, 
  requireRole(['company', 'admin', 'agent']),
  requirePlan('start'), // Requer qualquer plano ativo
  rateLimit(100, 60), // 100 req/min
  metricsController.getOverview
);

// GET /api/metrics/temporal?days=30
router.get('/temporal', 
  authMiddleware, 
  requireRole(['company', 'admin', 'agent']),
  requirePlan('pro'), // Requer plano Pro ou superior (Analytics)
  rateLimit(100, 60),
  metricsController.getTemporal
);

module.exports = router;
