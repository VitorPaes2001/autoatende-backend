const express = require('express');
const router = express.Router();

const billingController = require('../controllers/billing.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rateLimit = require('../middlewares/rateLimit.middleware');

// Status deve usar o mesmo authMiddleware das demais rotas.
// Nunca retornar Starter hardcoded aqui (isso mascara bug de DB/schema).
router.get('/status', authMiddleware, rateLimit(60, 60), billingController.getStatus);

router.post('/portal', authMiddleware, rateLimit(10, 60), billingController.createPortalSession);
router.get('/summary', authMiddleware, rateLimit(60, 60), billingController.getMonthlySummary);
router.post('/overage/run', authMiddleware, rateLimit(10, 60), billingController.runOverageCycle);

module.exports = router;
