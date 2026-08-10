const express = require('express');
const router = express.Router();
const publicBillingController = require('../controllers/publicBilling.controller');

let rateLimit = null;

try {
  rateLimit = require('../middlewares/rateLimit.middleware');
} catch (error) {
  rateLimit = null;
}

router.get('/plans', publicBillingController.getPlans);
router.get('/checkout/status', publicBillingController.getCheckoutStatus);
router.get('/checkout/session/:sessionId', publicBillingController.getCheckoutStatus);

if (typeof rateLimit === 'function') {
  router.post('/checkout', rateLimit(20, 60), publicBillingController.createCheckout);
} else {
  router.post('/checkout', publicBillingController.createCheckout);
router.post('/checkout/confirmation-email', publicBillingController.sendCheckoutConfirmationEmail);
}

module.exports = router;
