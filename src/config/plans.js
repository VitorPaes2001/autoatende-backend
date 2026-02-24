// Definição dos Planos e Limites (Billing v1)
// Fonte da Verdade para franquia de templates + excedente.

const OVERAGE_TEMPLATE_PRICE_BRL_CENTS = 99; // R$ 0,99 por template excedente

const PLANS = {
  STARTER: {
    key: 'starter',
    name: 'Starter',
    stripePriceId: 'price_starter_placeholder',
    limits: {
      conversations: Infinity,
      templates: 300,
      agents: 1,
      features: ['basic_bot', 'manual_chat']
    }
  },
  PRO: {
    key: 'pro',
    name: 'Pro',
    stripePriceId: 'price_pro_placeholder',
    limits: {
      conversations: Infinity,
      templates: 800,
      agents: 3,
      features: ['basic_bot', 'manual_chat', 'analytics', 'priority_support']
    }
  },
  BUSINESS: {
    key: 'business',
    name: 'Business',
    stripePriceId: 'price_business_placeholder',
    limits: {
      conversations: Infinity,
      templates: 2000,
      agents: 8,
      features: ['basic_bot', 'manual_chat', 'analytics', 'priority_support', 'custom_integration', 'whitelabel']
    }
  }
};

const LEGACY_MAP = {
  start: 'STARTER',
  starter: 'STARTER',
  pro: 'PRO',
  business: 'BUSINESS'
};

const PLAN_LEVELS = {
  starter: 1,
  start: 1,
  pro: 2,
  business: 3
};

function getPlanByPriceId(priceId) {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId) || PLANS.STARTER;
}

function getPlanByName(name) {
  if (!name) return PLANS.STARTER;
  const key = LEGACY_MAP[String(name).toLowerCase()] || 'STARTER';
  return PLANS[key];
}

function isPlanAtLeast(currentPlanKey, requiredPlanKey) {
  const currentLevel = PLAN_LEVELS[currentPlanKey?.toLowerCase()] || 0;
  const requiredLevel = PLAN_LEVELS[requiredPlanKey?.toLowerCase()] || 999;
  return currentLevel >= requiredLevel;
}

module.exports = {
  OVERAGE_TEMPLATE_PRICE_BRL_CENTS,
  PLANS,
  getPlanByPriceId,
  getPlanByName,
  isPlanAtLeast
};
