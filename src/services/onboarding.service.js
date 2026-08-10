const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const { getCompanyCommercialProfile } = require("./companyCommercialProfile.service");

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
/* __AUTOATENDE_C1B_DB_FIRST_PROFILE__ */
async function resolveCommercialProfileDbFirst(companyId, fallbackProfile = null) {
  try {
    const profile = await getCompanyCommercialProfile(companyId);
    if (profile && profile.source && profile.source !== "empty") {
      try {
        console.info(`[C1B] commercial_profile_source ${JSON.stringify({ company_id: companyId, source: profile.source })}`);
      } catch (_) {}
      return profile;
    }
  } catch (error) {
    try {
      console.warn(`[C1B] commercial_profile_fallback_error ${JSON.stringify({ company_id: companyId, error: String(error?.message || error) })}`);
    } catch (_) {}
  }

  try {
    console.info(`[C1B] commercial_profile_source ${JSON.stringify({ company_id: companyId, source: "legacy_fallback" })}`);
  } catch (_) {}

  return fallbackProfile;
}

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
    return await resolveCommercialProfileDbFirst(companyId, store[companyId] || null);
  } catch (error) {
    logger.error('[Onboarding] Failed to get data', error);
    return null;
  }
}

/**
 * Gera o System Prompt final baseado nos dados de onboarding
 * @param {Object} data 
 */

/* __AUTOATENDE_C16N_C12C_R5_FIX_PROMPT_VALUE_NORMALIZATION__ */
function aaC12cR5NormalizePromptPrimitive(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function aaC12cR5NormalizePromptText(value, fallback = '') {
  const primitive = aaC12cR5NormalizePromptPrimitive(value);
  if (primitive) return primitive;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => aaC12cR5NormalizePromptText(item, ''))
      .filter(Boolean);
    return parts.join(', ') || fallback;
  }

  if (value && typeof value === 'object') {
    const parts = Object.entries(value)
      .map(([key, raw]) => {
        const normalized = aaC12cR5NormalizePromptText(raw, '');
        if (!normalized) return '';
        return `${key}: ${normalized}`;
      })
      .filter(Boolean);

    return parts.join(' | ') || fallback;
  }

  return fallback;
}


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

/* __AUTOATENDE_B65_ONBOARDING_PROMPT_HARDEN__ */

function buildSystemPrompt(data) {
  if (!data) {
    return [
      'Você é um assistente virtual comercial e operacional útil.',
      'Responda em português do Brasil.',
      'Se houver contexto suficiente, responda diretamente.',
      'Não reinicie a conversa com saudação genérica se o cliente já estiver em uma conversa em andamento.',
      'Não invente preços, funcionalidades, integrações, prazos ou condições comerciais.'
    ].join('\n');
  }

  const companyName = String(data.company_name || 'Nossa Empresa').trim();
  const companyContext = aaC12cR5NormalizePromptText(data.company_context, '');
  const services = aaC12cR5NormalizePromptText(data.services, '');
  const targetAudience = aaC12cR5NormalizePromptText(data.target_audience, '');
  const tone = aaC12cR5NormalizePromptText(data.tone, 'Profissional, consultivo, objetivo e cordial');
  const escalationRules = aaC12cR5NormalizePromptText(data.escalation_rules, 'Se o cliente pedir humano ou houver exceção relevante, sinalize encaminhamento para atendimento humano.');
  const forbiddenTopics = aaC12cR5NormalizePromptText(data.forbidden_topics, '');
  const faqBase = aaC12cR5NormalizePromptText(data.faq_base, '');
  const assistantGuidance = aaC12cR5NormalizePromptText(data.assistant_guidance, '');

  return `
Você é o assistente virtual da empresa ${companyName}.

OBJETIVO PRINCIPAL:
Ajudar clientes com clareza, objetividade e segurança comercial, usando apenas informações confirmadas no contexto disponível.

CONTEXTO DA EMPRESA:
${companyContext || 'Contexto não informado.'}

O QUE VENDEMOS/OFERECEMOS:
${services || 'Serviços não informados.'}

PÚBLICO-ALVO:
${targetAudience || 'Público-alvo não informado.'}

TOM DE VOZ:
${tone}

REGRAS DE ESCALONAMENTO (HUMANO):
${escalationRules}

TÓPICOS PROIBIDOS:
${forbiddenTopics || 'Não inventar informações.'}

BASE DE CONHECIMENTO (FAQ):
${faqBase || 'Base comercial ainda não informada.'}

ORIENTAÇÃO ADICIONAL DO NEGÓCIO:
${assistantGuidance || 'Explique valor com clareza, sem exagero comercial.'}

REGRAS DE RESPOSTA COMERCIAL:
1. Se a pergunta puder ser respondida com o contexto disponível, responda diretamente.
2. Ao falar de planos, use apenas os valores, limites e regras que estiverem explicitamente na base de conhecimento.
3. Não invente implantação imediata, disponibilidade comercial imediata, integrações não confirmadas, prazos ou condições especiais.
4. Se faltar dado essencial, faça apenas uma pergunta curta e objetiva.
5. Se a conversa já estiver em andamento, não recomece com saudação genérica.
6. Sempre priorize utilidade real: explicar o que a solução faz, para quem serve, como ajuda e quais são os planos quando isso estiver no contexto.
7. Se houver dúvida sobre contratação, implantação ou condição comercial atual, deixe claro que a confirmação final depende de validação comercial.
8. Nunca contradiga informações já dadas por atendimento humano anterior presentes no contexto interno.

DIRETRIZES GERAIS:
1. Responda sempre em português do Brasil.
2. Seja conciso, claro e consultivo.
3. Não invente preços, serviços ou políticas fora da base.
4. Quando não souber algo com segurança, admita a limitação e ofereça encaminhamento humano.
`.trim();
}

module.exports.buildSystemPrompt = buildSystemPrompt;
