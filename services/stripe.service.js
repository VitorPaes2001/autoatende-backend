const stripe = require('../config/stripe');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const systemEvents = require('./systemEvents.service');

const createCheckoutSession = async (clientId, priceId) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('client_id', clientId)
    .single();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    customer_email: profile?.email,
    client_reference_id: clientId,
    success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/dashboard?canceled=true`,
  });

  return session;
};

const handleWebhook = async (event) => {
  const session = event.data.object;
  const clientId = session.client_reference_id;

  if (event.type === 'checkout.session.completed') {
    logger.info(`Payment success for client ${clientId}`);

    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        client_id: clientId,
        stripe_subscription_id: session.subscription,
        status: 'active',
        current_period_end: new Date(session.expires_at * 1000).toISOString()
      });

    if (error) logger.error(`Failed to update sub: ${error.message}`);

    await systemEvents.logEvent(clientId, 'billing_success', { sessionId: session.id });

    await supabase
      .from('clients')
      .update({ status: 'active' })
      .eq('id', clientId);
  }

  if (event.type === 'invoice.payment_failed') {
    logger.warn(`Payment failed for subscription ${session.subscription}`);
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook
};

