// Definição dos Planos e Limites
// Este arquivo serve como Fonte da Verdade para mapeamento de Preços do Stripe e capacidades.

const PLANS = {
  STARTER: {
    key: 'starter',
    name: 'Starter', // Renamed from Start
    stripePriceId: 'price_starter_placeholder',
    limits: {
      conversations: Infinity, // Ilimitadas
      templates: 300,      // Mensal
      agents: 1,
      features: ['basic_bot', 'manual_chat']
    }
  },
  PRO: {
    key: 'pro',
    name: 'Pro',
    stripePriceId: 'price_pro_placeholder',
    limits: {
      conversations: Infinity, // Ilimitadas
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
      conversations: Infinity, // Ilimitadas
      templates: 2000,
      agents: 8,
      features: ['basic_bot', 'manual_chat', 'analytics', 'priority_support', 'custom_integration', 'whitelabel']
    }
  }
};

// Mapeamento de retrocompatibilidade
const LEGACY_MAP = {
  'start': 'STARTER',
  'starter': 'STARTER',
  'pro': 'PRO',
  'business': 'BUSINESS'
};

// Helper para buscar plano pelo Price ID
function getPlanByPriceId(priceId) {
  return Object.values(PLANS).find(p => p.stripePriceId === priceId) || PLANS.STARTER;
}

// Helper para normalizar nome do plano (backward compatibility)
function getPlanByName(name) {
  if (!name) return PLANS.STARTER;
  const key = LEGACY_MAP[name.toLowerCase()] || 'STARTER';
  return PLANS[key];
}

// Helper para hierarquia de planos
const PLAN_LEVELS = {
  starter: 1,
  start: 1, // Legacy support
  pro: 2,
  business: 3
};

function isPlanAtLeast(currentPlanKey, requiredPlanKey) {
  const currentLevel = PLAN_LEVELS[currentPlanKey?.toLowerCase()] || 0;
  const requiredLevel = PLAN_LEVELS[requiredPlanKey?.toLowerCase()] || 999;
  return currentLevel >= requiredLevel;
}

module.exports = {
  PLANS,
  getPlanByPriceId,
  getPlanByName,
  isPlanAtLeast
};
