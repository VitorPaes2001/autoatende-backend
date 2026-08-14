const publicBillingCheckoutService = require('../services/publicBillingCheckout.service');
const checkoutConfirmationEmailService = require('../services/checkoutConfirmationEmail.service');

async function getPlans(req, res) {
  res.json({
    ok: true,
    currency: 'brl',
    plans: publicBillingCheckoutService.getPublicPlans(),
  });
}

async function createCheckout(req, res) {
  try {
    const result = await publicBillingCheckoutService.createCheckoutSession(req.body || {});

    res.status(result.dryRun ? 200 : 201).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    console.error('[PublicBilling] Checkout error:', {
      code: error.code || 'CHECKOUT_ERROR',
      message: error.message,
      statusCode,
    });

    res.status(statusCode).json({
      error: true,
      code: error.code || 'CHECKOUT_ERROR',
      message: statusCode >= 500
        ? 'Não foi possível iniciar o checkout neste momento.'
        : error.message,
    });
  }
}

async function getCheckoutStatus(req, res) {
  try {
    const result = await publicBillingCheckoutService.getCheckoutSessionStatus({
      sessionId: req.params.sessionId || req.query.session_id || req.query.sessionId,
    });

    res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    console.error('[PublicBilling] Checkout status error:', {
      code: error.code || 'CHECKOUT_STATUS_ERROR',
      message: error.message,
      statusCode,
    });

    res.status(statusCode).json({
      error: true,
      code: error.code || 'CHECKOUT_STATUS_ERROR',
      message: statusCode >= 500
        ? 'Não foi possível consultar o status do checkout neste momento.'
        : error.message,
    });
  }
}


async function sendCheckoutConfirmationEmail(req, res, next) {
  try {
    const sessionId = req.body?.sessionId || req.query?.session_id || req.query?.sessionId;
    const result = await checkoutConfirmationEmailService.sendCheckoutConfirmationEmail(sessionId);
    return res.status(200).json(result);
  } catch (error) {
    if (typeof next === 'function') return next(error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'confirmation_email_failed',
    });
  }
}

module.exports = {
  sendCheckoutConfirmationEmail,
  getPlans,
  createCheckout,
  getCheckoutStatus,
};
