require('dotenv').config();
const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('CRITICAL: STRIPE_SECRET_KEY missing in .env');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
});

module.exports = stripe;
