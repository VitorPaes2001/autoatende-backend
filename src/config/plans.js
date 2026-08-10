// Definição dos Planos e Limites
// Fonte da verdade interna para mapeamento de preços Stripe e capacidades.
// Fase Stripe 2B: planos comerciais Essencial, Profissional e Business.

const TEST_PRICE_IDS = {
  ESSENCIAL_MONTHLY: 'price_1TqOb2GgAlIA1MzzxmpzUqCZ',
  PROFISSIONAL_MONTHLY: 'price_1TqOb5GgAlIA1Mzz6xJZDXzP',
  BUSINESS_MONTHLY: 'price_1TqOb7GgAlIA1MzzNCO0R9CS',
  ESSENCIAL_IMPLEMENTATION: 'price_1TqOb3GgAlIA1Mzz6HOYjGJA',
  PROFISSIONAL_IMPLEMENTATION: 'price_1TqOb5GgAlIA1Mzz9p63W3Ab',
  BUSINESS_IMPLEMENTATION: 'price_1TqOb7GgAlIA1Mzzr2kELC0f',
};

function isStripeTestMode() {
  return String(process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
}

function resolvePriceId(primaryEnv, fallbackEnv, testFallback) {
  const primary = process.env[primaryEnv];

  if (primary) return primary;

  if (fallbackEnv && process.env[fallbackEnv]) {
    return process.env[fallbackEnv];
  }

  if (isStripeTestMode()) {
    return testFallback;
  }

  return `missing_${primaryEnv.toLowerCase()}`;
}

const PLANS = {
  STARTER: {
    key: 'starter',
    commercialKey: 'essencial',
    name: 'Essencial',
    stripePriceId: resolvePriceId(
      'STRIPE_PRICE_STARTER',
      'STRIPE_PRICE_ESSENCIAL',
      TEST_PRICE_IDS.ESSENCIAL_MONTHLY
    ),
    implementationPriceId: resolvePriceId(
      'STRIPE_PRICE_IMPLEMENTATION_STARTER',
      'STRIPE_PRICE_IMPLEMENTATION_ESSENCIAL',
      TEST_PRICE_IDS.ESSENCIAL_IMPLEMENTATION
    ),
    limits: {
      conversations: Infinity,
      templates: 300,
      agents: 1,
      features: ['basic_bot', 'manual_chat'],
    },
  },

  PRO: {
    key: 'pro',
    commercialKey: 'profissional',
    name: 'Profissional',
    stripePriceId: resolvePriceId(
      'STRIPE_PRICE_PRO',
      'STRIPE_PRICE_PROFISSIONAL',
      TEST_PRICE_IDS.PROFISSIONAL_MONTHLY
    ),
    implementationPriceId: resolvePriceId(
      'STRIPE_PRICE_IMPLEMENTATION_PRO',
      'STRIPE_PRICE_IMPLEMENTATION_PROFISSIONAL',
      TEST_PRICE_IDS.PROFISSIONAL_IMPLEMENTATION
    ),
    limits: {
      conversations: Infinity,
      templates: 800,
      agents: 3,
      features: ['basic_bot', 'manual_chat', 'analytics', 'priority_support'],
    },
  },

  BUSINESS: {
    key: 'business',
    commercialKey: 'business',
    name: 'Business',
    stripePriceId: resolvePriceId(
      'STRIPE_PRICE_BUSINESS',
      null,
      TEST_PRICE_IDS.BUSINESS_MONTHLY
    ),
    implementationPriceId: resolvePriceId(
      'STRIPE_PRICE_IMPLEMENTATION_BUSINESS',
      null,
      TEST_PRICE_IDS.BUSINESS_IMPLEMENTATION
    ),
    limits: {
      conversations: Infinity,
      templates: 2000,
      agents: 8,
      features: [
        'basic_bot',
        'manual_chat',
        'analytics',
        'priority_support',
        'custom_integration',
        'whitelabel',
      ],
    },
  },
};

const LEGACY_MAP = {
  start: 'STARTER',
  starter: 'STARTER',
  essencial: 'STARTER',
  essential: 'STARTER',
  pro: 'PRO',
  profissional: 'PRO',
  professional: 'PRO',
  business: 'BUSINESS',
};

function getPlanByPriceId(priceId) {
  return Object.values(PLANS).find((plan) => plan.stripePriceId === priceId) || PLANS.STARTER;
}

function getPlanByName(name) {
  if (!name) return PLANS.STARTER;
  const key = LEGACY_MAP[String(name).toLowerCase()] || 'STARTER';
  return PLANS[key];
}

const PLAN_LEVELS = {
  starter: 1,
  start: 1,
  essencial: 1,
  essential: 1,
  pro: 2,
  profissional: 2,
  professional: 2,
  business: 3,
};

function isPlanAtLeast(currentPlanKey, requiredPlanKey) {
  const currentLevel = PLAN_LEVELS[String(currentPlanKey || '').toLowerCase()] || 0;
  const requiredLevel = PLAN_LEVELS[String(requiredPlanKey || '').toLowerCase()] || 999;
  return currentLevel >= requiredLevel;
}

module.exports = {
  PLANS,
  getPlanByPriceId,
  getPlanByName,
  isPlanAtLeast,
};
