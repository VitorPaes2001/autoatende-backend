const stripe = require('../config/stripe');
const logger = require('../utils/logger');

const createCheckoutSession = async (companyId, priceId) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    client_reference_id: companyId,
    success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/dashboard?canceled=true`,
  });

  return session;
};

module.exports = {
  createCheckoutSession,
};

