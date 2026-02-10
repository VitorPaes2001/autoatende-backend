const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

// Store onboarding data in a JSON file since we cannot alter DB schema
const STORE_PATH = path.join(__dirname, '../../data/onboarding_store.json');

// Ensure directory exists
if (!fs.existsSync(path.dirname(STORE_PATH))) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
}

// Ensure file exists
if (!fs.existsSync(STORE_PATH)) {
  fs.writeFileSync(STORE_PATH, JSON.stringify({}));
}

/**
 * Salva dados de onboarding da empresa
 * @param {string} companyId 
 * @param {Object} data 
 */
async function saveOnboardingData(companyId, data) {
  try {
    const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    store[companyId] = {
      ...store[companyId],
      ...data,
      updated_at: new Date().toISOString()
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    return store[companyId];
  } catch (error) {
    logger.error('[Onboarding] Failed to save data', error);
    throw error;
  }
}

/**
 * Recupera dados de onboarding
 * @param {string} companyId 
 */
async function getOnboardingData(companyId) {
  try {
    const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return store[companyId] || null;
  } catch (error) {
    logger.error('[Onboarding] Failed to get data', error);
    return null;
  }
}

/**
 * Gera o System Prompt final baseado nos dados de onboarding
 * @param {Object} data 
 */
function buildSystemPrompt(data) {
  if (!data) return "Você é um assistente virtual útil.";

  return `
Você é o assistente virtual da empresa ${data.company_name || 'Nossa Empresa'}.
CONTEXTO DA EMPRESA:
${data.company_context || ''}

O QUE VENDEMOS/OFERECEMOS:
${data.services || ''}

PÚBLICO-ALVO:
${data.target_audience || ''}

TOM DE VOZ:
${data.tone || 'Profissional e amigável'}

REGRAS DE ESCALONAMENTO (HUMANO):
${data.escalation_rules || 'Se o cliente pedir falar com humano, transfira.'}

TÓPICOS PROIBIDOS:
${data.forbidden_topics || ''}

BASE DE CONHECIMENTO (FAQ):
${data.faq_base || ''}

DIRETRIZES:
1. Responda sempre em português.
2. Seja conciso e direto.
3. Se não souber a resposta, peça desculpas e ofereça falar com um humano.
4. NUNCA invente preços ou serviços não listados.
`.trim();
}

module.exports = {
  saveOnboardingData,
  getOnboardingData,
  buildSystemPrompt,
  isOnboardingActive,
  processOnboardingStep
};

/**
 * Verifica se existe uma sessão de onboarding ativa para este usuário
 */
async function isOnboardingActive(companyId, from) {
  const data = await getOnboardingData(companyId);
  return data?.onboarding_session?.active && data?.onboarding_session?.from === from;
}

/**
 * Processa a máquina de estados do onboarding
 */
async function processOnboardingStep(companyId, from, userText) {
  let data = await getOnboardingData(companyId) || {};
  
  // Inicializar ou Reiniciar
  if (userText.trim().toLowerCase() === '#setup') {
    data.onboarding_session = {
      active: true,
      from: from,
      step: 'ASK_NAME'
    };
    await saveOnboardingData(companyId, data);
    return {
      message: "👋 Olá! Vamos configurar seu assistente virtual.\n\nPrimeiro, qual é o **Nome da sua Empresa**?"
    };
  }

  // Se não tiver sessão, ignora (segurança)
  if (!data.onboarding_session || !data.onboarding_session.active) {
    return null;
  }

  const step = data.onboarding_session.step;
  let nextMessage = '';
  let nextStep = step;

  switch (step) {
    case 'ASK_NAME':
      data.company_name = userText;
      nextStep = 'ASK_SERVICES';
      nextMessage = `Ótimo! Agora, em uma frase, **o que a ${userText} vende ou oferece**?`;
      break;

    case 'ASK_SERVICES':
      data.services = userText;
      nextStep = 'ASK_AUDIENCE';
      nextMessage = "Entendi. E qual é o seu **público-alvo**? (Ex: Jovens, Empresas, Donas de casa)";
      break;

    case 'ASK_AUDIENCE':
      data.target_audience = userText;
      nextStep = 'ASK_TONE';
      nextMessage = "Perfeito. Qual o **tom de voz** que devo usar? (Ex: Formal, Descontraído, Técnico, Empático)";
      break;

    case 'ASK_TONE':
      data.tone = userText;
      nextStep = 'COMPLETED';
      nextMessage = "✅ Tudo pronto! Já aprendi sobre sua empresa.\n\nA partir de agora, responderei seus clientes com base nessas informações. Você pode testar me mandando um 'Olá'!";
      data.onboarding_session.active = false; // Encerra sessão
      data.onboarding_completed = true;
      break;

    default:
      return null;
  }

  // Atualizar estado
  if (data.onboarding_session.active) {
    data.onboarding_session.step = nextStep;
  }
  
  await saveOnboardingData(companyId, data);
  
  return {
    message: nextMessage
  };
}