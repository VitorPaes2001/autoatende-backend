const billingService = require('../services/billing.service');
const stripeWebhookEventService = require('../services/stripeWebhookEvent.service');
const stripe = require('../config/stripe');

async function webhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (endpointSecret) {
      const payload = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error(`[Stripe Webhook Error] ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  let eventId = event?.id || null;

  try {
    const processing = await stripeWebhookEventService.startProcessing(event);
    eventId = processing.eventId || eventId;

    if (processing.isDuplicate) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    await billingService.handleWebhook(event);
    await stripeWebhookEventService.markProcessed(eventId);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[Stripe Webhook Handler Error] ${err.message}`);

    try {
      await stripeWebhookEventService.markFailed(eventId, err.message);
    } catch (trackErr) {
      console.error(`[Stripe Webhook Tracking Error] ${trackErr.message}`);
    }

    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  webhook,
};
