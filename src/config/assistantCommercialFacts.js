/* __AUTOATENDE_P3_R6_R4A_CANONICAL_NUMBER_POLISH__ */
const MARKER = '__AUTOATENDE_P3_R6_ASSISTANT_COMMERCIAL_FACTS__';

const PLANS = [
  {
    id: 'essencial',
    key: 'essential',
    name: 'Essencial',
    price: 'R$249,90',
    priceLabel: 'R$249,90/mês',
    agents: 1,
    marketing: 100,
    utility: 600
  },
  {
    id: 'profissional',
    key: 'professional',
    name: 'Profissional',
    price: 'R$449,90',
    priceLabel: 'R$449,90/mês',
    agents: 4,
    marketing: 250,
    utility: '1.500'
  },
  {
    id: 'business',
    key: 'business',
    name: 'Business',
    price: 'R$699,90',
    priceLabel: 'R$699,90/mês',
    agents: 8,
    marketing: 500,
    utility: '3.000'
  }
];

const ADDONS = [
  { label: '200 marketing', price: 'R$119' },
  { label: '1.000 utility/authentication', price: 'R$99' }
];

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getPlansCatalog() {
  return clone(PLANS);
}

function getAddonsCatalog() {
  return clone(ADDONS);
}

function buildPreviewPlansFacts() {
  const plans = getPlansCatalog();
  const essential = plans.find(p => p.id === 'essencial');
  const professional = plans.find(p => p.id === 'profissional');
  const business = plans.find(p => p.id === 'business');

  return {
    essential: {
      price: essential.priceLabel,
      agents: `até ${essential.agents} agente`,
      templates: `${essential.marketing} marketing + ${essential.utility} utility/authentication`
    },
    professional: {
      price: professional.priceLabel,
      agents: `até ${professional.agents} agentes`,
      templates: `${professional.marketing} marketing + ${professional.utility} utility/authentication`
    },
    business: {
      price: business.priceLabel,
      agents: `até ${business.agents} agentes`,
      templates: `${business.marketing} marketing + ${business.utility} utility/authentication`
    },
    addOns: {
      marketing: `${ADDONS[0].label} por ${ADDONS[0].price}`,
      utility: `${ADDONS[1].label} por ${ADDONS[1].price}`
    }
  };
}

function extractAgentNeed(question = '') {
  const q = String(question || '');
  const patterns = [
    /equipe\s+com\s+(\d+)\s*(pessoas?|agentes?|atendentes?)/i,
    /time\s+com\s+(\d+)\s*(pessoas?|agentes?|atendentes?)/i,
    /para\s+(\d+)\s*(pessoas?|agentes?|atendentes?)/i,
    /tenho\s+uma\s+equipe\s+com\s+(\d+)/i,
    /somos\s+(\d+)\s*(pessoas?|agentes?|atendentes?)/i
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && value < 1000) return value;
  }

  return null;
}

function looksLikePlanRecommendationQuestion(question = '') {
  const q = String(question || '');
  return /(qual\s+plano|plano\s+faz\s+mais\s+sentido|plano\s+voc[eê]s?\s+indicam|plano\s+voc[eê]\s+indica|indica(?:m|ria)?\s+.*plano|recomenda(?:m|ria)?\s+.*plano|para\s+come[cç]ar|equipe\s+com\s*\d+|time\s+com\s*\d+)/i.test(q);
}

function choosePlanByAgents(agentNeed) {
  const need = Number(agentNeed);
  if (!Number.isFinite(need) || need <= 0) return null;

  for (const item of PLANS) {
    if (need <= item.agents) return clone(item);
  }

  return null;
}

function buildStandardPlansResponse(options = {}) {
  const includeClosing = options.includeClosing !== false;
  const plans = getPlansCatalog();
  const essential = plans.find(p => p.id === 'essencial');
  const professional = plans.find(p => p.id === 'profissional');
  const business = plans.find(p => p.id === 'business');

  let text =
    `Hoje a AutoAtende AI trabalha com três planos. ` +
    `Essencial: ${essential.price} por mês para até ${essential.agents} agente, com conversas ilimitadas e ${essential.marketing} templates de marketing + ${essential.utility} templates utility/authentication por mês. ` +
    `Profissional: ${professional.price} por mês para até ${professional.agents} agentes, com conversas ilimitadas e ${professional.marketing} templates de marketing + ${professional.utility} templates utility/authentication por mês. ` +
    `Business: ${business.price} por mês para até ${business.agents} agentes, com conversas ilimitadas e ${business.marketing} templates de marketing + ${business.utility} templates utility/authentication por mês. ` +
    `Importante: as conversas de atendimento são ilimitadas; o que possui franquia mensal é apenas o envio de templates da Meta.`;

  if (includeClosing) {
    text += ` Se quiser, posso te indicar qual plano faz mais sentido para a sua operação.`;
  }

  return text.trim();
}

function buildRecommendationPrefix(agentNeed, options = {}) {
  const includeGrowth = options.includeGrowth !== false;
  const plan = choosePlanByAgents(agentNeed);
  if (!plan) return '';

  const nextPlan = PLANS.find(item => item.agents > plan.agents) || null;
  const peopleLabel = Number(agentNeed) === 1 ? 'pessoa' : 'pessoas';
  const agentLabel = plan.agents === 1 ? 'agente' : 'agentes';

  let out =
    `Para uma equipe com ${agentNeed} ${peopleLabel}, o plano que faz mais sentido para começar é o ${plan.name}, ` +
    `porque atende até ${plan.agents} ${agentLabel}, mantém as conversas de atendimento ilimitadas e já inclui ${plan.marketing} templates de marketing + ${plan.utility} utility/authentication por mês. ` +
    `O valor desse plano é ${plan.price}/mês.`;

  if (includeGrowth && nextPlan) {
    out += ` Se a operação crescer rápido, o próximo passo natural tende a ser o ${nextPlan.name}.`;
  }

  return out.trim();
}

module.exports = {
  MARKER,
  getPlansCatalog,
  getAddonsCatalog,
  buildPreviewPlansFacts,
  extractAgentNeed,
  looksLikePlanRecommendationQuestion,
  choosePlanByAgents,
  buildStandardPlansResponse,
  buildRecommendationPrefix
};
