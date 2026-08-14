const express = require('express');
const checkoutConfirmationEmailService = require('../services/checkoutConfirmationEmail.service');

const router = express.Router();

async function confirmationEmailHandler(req, res) {
  try {
    const sessionId =
      req.body?.sessionId ||
      req.body?.session_id ||
      req.query?.sessionId ||
      req.query?.session_id;

    const result = await checkoutConfirmationEmailService.sendCheckoutConfirmationEmail(sessionId);

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      ok: false,
      error: error.message || 'confirmation_email_failed',
    });
  }
}

router.post('/api/public/billing/checkout/confirmation-email', confirmationEmailHandler);
router.post('/api/public/billing/checkout/confirmation-email/', confirmationEmailHandler);

module.exports = router;
