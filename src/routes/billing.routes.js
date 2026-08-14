// __AUTOATENDE_C6C_R3_RATE_LIMIT_BUCKET_ISOLATION__
// __AUTOATENDE_C6C_R2_BILLING_PORTAL_RATE_LIMIT_AND_UX__
// __AUTOATENDE_C6B_R1_ADMIN_SURFACE_HARDENING__
const express = require('express');
const router = express.Router();
const { canonicalizeTemplateUsagePayloadMiddleware } = require('../middleware/canonicalizeTemplateUsagePayload.middleware');

router.use(canonicalizeTemplateUsagePayloadMiddleware);
const billingController = require('../controllers/billing.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const rateLimit = require('../middlewares/rateLimit.middleware');
// __AUTOATENDE_V4_R22C_D_B_R3_INBOX_TRANSITION_BILLING_STATUS_BUCKET_PATCH__

const effectiveBillingTenantForAgent = require('../middlewares/effectiveBillingTenantForAgent.middleware'); // __AUTOATENDE_V4_R12D_B2R1_EFFECTIVE_TENANT_ONLY_BILLING_STATUS__

// Status deve usar o mesmo authMiddleware das demais rotas.
// Nunca retornar Starter hardcoded aqui (isso mascara bug de DB/schema).
// __AUTOATENDE_V4_R12D_A7_AGENT_OPERATIONAL_BILLING_STATUS_AND_MENU_GUARD__
// __AUTOATENDE_V4_R12D_B2R1_EFFECTIVE_TENANT_ONLY_BILLING_STATUS__
router.get('/status', authMiddleware, requireRole(['company', 'admin', 'agent']), effectiveBillingTenantForAgent, rateLimit(180, 60, 'billing_status'), billingController.getStatus);

router.post('/portal', authMiddleware, requireRole(['company','admin']), rateLimit(30, 60, 'billing_portal'), billingController.createPortalSession);
router.get('/summary', authMiddleware, requireRole(['company','admin']), rateLimit(60, 60), billingController.getMonthlySummary);
router.post('/overage/run', authMiddleware, requireRole(['company','admin']), rateLimit(10, 60), billingController.runOverageCycle);

module.exports = router;
