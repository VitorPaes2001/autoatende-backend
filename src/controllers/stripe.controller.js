const billingService = require('../services/billing.service');
const stripe = require('../config/stripe');

async function webhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Se tiver secret, valida assinatura
    if (endpointSecret) {
      // Use req.rawBody stored by express.json verify option
      const payload = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } else {
      // Dev mode: trust body directly (not recommended for prod but useful for dev if secret missing)
      // Note: express.json() might break constructEvent if it expects raw body.
      // We need raw body for Stripe signature verification.
      // app.js has app.use(express.json()). This is a problem for Stripe webhooks.
      event = req.body;
    }
  } catch (err) {
    console.error(`[Stripe Webhook Error] ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await billingService.handleWebhook(event);
    res.json({ received: true });
  } catch (err) {
    console.error(`[Stripe Webhook Handler Error] ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  webhook,
};
