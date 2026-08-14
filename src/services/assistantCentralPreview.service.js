// AUTOATENDE_OPENAI_ABORT_RETRY_V20_E1_B1_BEGIN
const OPENAI_PREVIEW_MAX_ATTEMPTS = 2;
const OPENAI_PREVIEW_RETRY_DELAY_MS = 250;
// AUTOATENDE_OPENAI_TIMEOUT_SCOPE_FIX_V20_E1_B2_R2_BEGIN
const OPENAI_PREVIEW_TIMEOUT_MS = (() => {
  const parsed = Number.parseInt(
    process.env.OPENAI_TIMEOUT_MS || "25000",
    10,
  );

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : 25000;
})();
// AUTOATENDE_OPENAI_TIMEOUT_SCOPE_FIX_V20_E1_B2_R2_END

function createOpenAIPreviewTraceId() {
  return `preview_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeOpenAIPreviewLogValue(value, maxLength = 160) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value).slice(0, maxLength);
}

function getOpenAIPreviewTransportCode(error) {
  return normalizeOpenAIPreviewLogValue(
    error?.code || error?.cause?.code || null,
    80,
  );
}

function isOpenAIPreviewRetryableTransportFailure({
  error,
  aborted,
  timeoutTriggered,
}) {
  if (aborted || timeoutTriggered || error?.name === "AbortError") {
    return true;
  }

  const transportCode = getOpenAIPreviewTransportCode(error);

  return new Set([
    "ETIMEDOUT",
    "ESOCKETTIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
  ]).has(transportCode);
}

function logOpenAIPreviewTrace(event, fields = {}) {
  console.log(
    JSON.stringify({
      scope: "assistant_central_preview_openai",
      event,
      ...fields,
    }),
  );
}

async function executeOpenAIRequestWithAbortRetry(
  requestFactory,
  context = {},
) {
  const traceId = createOpenAIPreviewTraceId();
  const companyId = normalizeOpenAIPreviewLogValue(context.companyId, 120);
  const sourceMode = normalizeOpenAIPreviewLogValue(context.sourceMode, 80);

  for (
    let attempt = 1;
    attempt <= OPENAI_PREVIEW_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const controller = new AbortController();
    const startedAt = Date.now();
    let timeoutTriggered = false;

    const timeoutHandle = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, OPENAI_PREVIEW_TIMEOUT_MS);

    logOpenAIPreviewTrace("attempt_started", {
      traceId,
      companyId,
      sourceMode,
      attempt,
      maxAttempts: OPENAI_PREVIEW_MAX_ATTEMPTS,
      timeoutMs: OPENAI_PREVIEW_TIMEOUT_MS,
    });

    try {
      const response = await requestFactory(controller.signal, attempt);
      const elapsedMs = Date.now() - startedAt;
      const openaiRequestId = normalizeOpenAIPreviewLogValue(
        response?.headers?.get?.("x-request-id") || null,
        120,
      );

      logOpenAIPreviewTrace("attempt_completed", {
        traceId,
        companyId,
        sourceMode,
        attempt,
        elapsedMs,
        timeoutMs: OPENAI_PREVIEW_TIMEOUT_MS,
        httpStatus: Number.isFinite(response?.status)
          ? response.status
          : null,
        openaiRequestId,
        aborted: false,
        retryScheduled: false,
      });

      logOpenAIPreviewTrace("provider_final", {
        traceId,
        companyId,
        sourceMode,
        attempt,
        httpStatus: Number.isFinite(response?.status)
          ? response.status
          : null,
        providerFinal: response?.ok
          ? "openai"
          : "single_truth_fallback",
        fallbackFinal: !response?.ok,
      });

      return response;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const aborted = Boolean(
        timeoutTriggered
          || controller.signal.aborted
          || error?.name === "AbortError",
      );
      const retryable = isOpenAIPreviewRetryableTransportFailure({
        error,
        aborted,
        timeoutTriggered,
      });
      const retryScheduled = Boolean(
        retryable && attempt < OPENAI_PREVIEW_MAX_ATTEMPTS,
      );

      logOpenAIPreviewTrace("attempt_failed", {
        traceId,
        companyId,
        sourceMode,
        attempt,
        elapsedMs,
        timeoutMs: OPENAI_PREVIEW_TIMEOUT_MS,
        httpStatus: null,
        openaiRequestId: null,
        aborted,
        timeoutTriggered,
        transportCode: getOpenAIPreviewTransportCode(error),
        errorName: normalizeOpenAIPreviewLogValue(error?.name, 80),
        retryScheduled,
      });

      if (retryScheduled) {
        await new Promise((resolve) => {
          setTimeout(resolve, OPENAI_PREVIEW_RETRY_DELAY_MS);
        });
        continue;
      }

      logOpenAIPreviewTrace("provider_final", {
        traceId,
        companyId,
        sourceMode,
        attempt,
        providerFinal: "single_truth_fallback",
        fallbackFinal: true,
      });

      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw new Error("openai_preview_attempts_exhausted");
}
// AUTOATENDE_OPENAI_ABORT_RETRY_V20_E1_B1_END

const assistantCentralService = require('./assistantCentral.service');
const assistantCommercialFacts = require('../config/assistantCommercialFacts');

const MARKER = '__AUTOATENDE_C3C4A_SINGLE_TRUTH_PREVIEW__';
/* __AUTOATENDE_P3_R6_ASSISTANT_COMMERCIAL_FACTS__ */

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function toList(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean);
  if (typeof value === 'string') {
    return value.split('\n').map(normalizeText).filter(Boolean);
  }
  return [];
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function buildCommercialSnapshot(profile = {}) {
  return {
    companyName: normalizeText(profile.companyName || profile.company_name),
    targetAudience: normalizeText(profile.targetAudience || profile.target_audience),
    toneOfVoice: normalizeText(profile.toneOfVoice || profile.tone_of_voice),
    companyContext: normalizeText(profile.companyContext || profile.company_context),
    guidance: normalizeText(profile.guidance || profile.additionalGuidance || profile.additional_guidance),
    services: toList(profile.services || profile.services_text),
    forbiddenTopics: toList(profile.forbiddenTopics || profile.forbidden_topics || profile.forbidden_topics_text),
    faqJson: normalizeText(profile.faqJson || profile.faq_json)
  };
}

/* __AUTOATENDE_PREVIEW_QUALITY_HANDOFF_CONTRACT_V20_E1_B5_R4__ */
function detectIntent(message = '') {
  const text = normalizeText(message).toLowerCase();

  if (!text) return 'general';
  if (/(plano|planos|preço|precos|valor|mensalidade|quanto custa|investimento)/.test(text)) return 'pricing';
  if (/(pagamento|pagamentos|forma de pagamento|cartão|cartao|boleto|pix)/.test(text)) return 'payment';
  if (/(atendente|transbordo|transferir para humano|encaminhar para humano|falar com humano|falar com uma pessoa|falar com um humano|falar com um atendente|falar com uma atendente|conversar com humano|conversar com uma pessoa|conversar com um atendente)/.test(text)) return 'handoff';
  if (/(implantação|implantacao|implementar|implementação|implementacao|onboarding|configuração inicial|configuracao inicial)/.test(text)) return 'implementation';
  if (/(como funciona|funciona na prática|na pratica|como vocês funcionam|como voces funcionam)/.test(text)) return 'how_it_works';
  if (/(integra|integracao|integração|api|crm|erp|sistema)/.test(text)) return 'integration';
  if (/(lead|leads|qualificação|qualificacao)/.test(text)) return 'qualification';
  return 'general';
}

function buildPlansFacts() {
  return assistantCommercialFacts.buildPreviewPlansFacts();
}

function stripMarkdownishFormatting(text) {
  let clean = normalizeText(text);
  clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');
  clean = clean.replace(/\*(.*?)\*/g, '$1');
  clean = clean.replace(/^\s*\d+\.\s+/gm, '');
  clean = clean.replace(/^\s*[-•]\s+/gm, '');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}


// __AUTOATENDE_C3C6C_PREVIEW_STYLE_POLISH__
function __aa_c3c6c_norm(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function __aa_c3c6c_stripGreeting(text) {
  const clean = __aa_c3c6c_norm(text);
  if (!clean) return clean;
  if (clean.length <= 180) return clean;

  return clean
    .replace(/^(olá|ola|oi|bom dia|boa tarde|boa noite)[!,.\s-]+/i, '')
    .trim();
}

function __aa_c3c6c_flattenListyText(text) {
  let clean = __aa_c3c6c_norm(text);

  clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');
  clean = clean.replace(/\*(.*?)\*/g, '$1');
  clean = clean.replace(/^\s*[-•]\s+/gm, '');
  clean = clean.replace(/^\s*\d+\.\s+/gm, '');
  clean = clean.replace(/\n(?=(Essencial|Profissional|Business):)/g, ' ');
  clean = clean.replace(/\n(?=(O plano Essencial|O plano Profissional|O plano Business))/g, ' ');
  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean.trim();
}

function __aa_c3c6c_applyPreviewStylePolish(text) {
  let clean = __aa_c3c6c_norm(text);
  if (!clean) return clean;

  clean = __aa_c3c6c_stripGreeting(clean);
  clean = __aa_c3c6c_flattenListyText(clean);

  return clean.trim();
}


function applyCustomerFacingTerminology(text) {
  let clean = normalizeText(text);

  clean = clean.replace(/utility\s*\/\s*authentication/gi, 'serviço e autenticação');
  clean = clean.replace(/\badd-ons?\b/gi, 'pacotes adicionais');

  return clean;
}

function sanitizeOutput(text, maxChars) {
  text = __aa_c3c6c_applyPreviewStylePolish(text);
  text = applyCustomerFacingTerminology(text);
  return stripMarkdownishFormatting(text).slice(0, maxChars || 2200);
}

function buildGroundingCorpus(snapshot) {
  const faqParsed = safeJsonParse(snapshot.faqJson);
  const faqText = faqParsed ? JSON.stringify(faqParsed).toLowerCase() : normalizeText(snapshot.faqJson).toLowerCase();

  return [
    snapshot.companyName,
    snapshot.targetAudience,
    snapshot.toneOfVoice,
    snapshot.companyContext,
    snapshot.guidance,
    snapshot.services.join(' '),
    snapshot.forbiddenTopics.join(' '),
    faqText
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();
}

function topicIsGrounded(snapshot, intent, message) {
  const corpus = buildGroundingCorpus(snapshot);
  const text = normalizeText(message).toLowerCase();

  if (
    intent === 'pricing' ||
    intent === 'implementation' ||
    intent === 'handoff'
  ) return true;

  if (intent === 'payment') {
    return /(pagamento|pix|boleto|cartão|cartao|crédito|credito|débito|debito|transferência|transferencia)/.test(corpus);
  }

  if (intent === 'integration') {
    return /(integra|api|crm|erp|sistema)/.test(corpus);
  }

  if (intent === 'qualification') {
    return /(qualific|lead)/.test(corpus);
  }

  return text.length > 0;
}

/* __AUTOATENDE_P3_R5C_PREVIEW_PRICING_RECOMMENDATION_REBALANCE__ */
function previewPricingRecommendationRebalanceEnabled() {
  const raw = String(process.env.ASSISTANT_PREVIEW_PLAN_RECOMMENDATION_REBALANCE ?? "true").trim().toLowerCase();
  return !["false", "0", "off", "no"].includes(raw);
}

function extractPreviewAgentNeed(message = '') {
  return assistantCommercialFacts.extractAgentNeed(message);
}

function looksLikePlanRecommendationQuestion(message = '') {
  return assistantCommercialFacts.looksLikePlanRecommendationQuestion(message);
}

function choosePreviewPlanByAgents(agentNeed, plans) {
  const selected = assistantCommercialFacts.choosePlanByAgents(agentNeed);
  if (!selected) return null;

  const key =
    selected.id === 'essencial' ? 'essential' :
    selected.id === 'profissional' ? 'professional' :
    'business';

  const templates =
    plans?.[key]?.templates ||
    `${selected.marketing} marketing + ${selected.utility} utility/authentication`;

  return {
    name: selected.name,
    agents: selected.agents,
    price: selected.price,
    templates
  };
}

function buildPricingRecommendationPreview(message = '') {
  if (!previewPricingRecommendationRebalanceEnabled()) return '';
  if (!looksLikePlanRecommendationQuestion(message)) return '';

  const plans = buildPlansFacts();
  const agentNeed = extractPreviewAgentNeed(message);
  if (!agentNeed) return '';

  const plan = choosePreviewPlanByAgents(agentNeed, plans);
  if (!plan) return '';

  const nextPlan =
    plan.name === 'Essencial' ? 'Profissional'
    : plan.name === 'Profissional' ? 'Business'
    : null;

  const peopleLabel = agentNeed === 1 ? 'pessoa' : 'pessoas';

  let text =
    `Para uma equipe com ${agentNeed} ${peopleLabel}, o plano que faz mais sentido para começar é o ${plan.name}, porque ele já cobre esse porte de operação com folga, mantém as conversas de atendimento ilimitadas e inclui a franquia mensal de templates da Meta adequada para esse cenário. ` +
    `Hoje esse plano custa ${plan.price} e atende até ${plan.agents} ${plan.agents === 1 ? 'agente' : 'agentes'}. ` +
    `Na franquia mensal, ele inclui ${plan.templates}.`;

  if (nextPlan) {
    text += ` Se a operação crescer rápido, o próximo passo natural tende a ser o ${nextPlan}.`;
  }

  text += ` Se você quiser, eu também posso comparar esse cenário com os outros planos para mostrar por que ele é o mais equilibrado para começar.`;

  return sanitizeOutput(text, 2200);
}

function buildPricingPreview() {
  const plans = buildPlansFacts();

  return sanitizeOutput(
    `Hoje a AutoAtende AI trabalha com três planos mensais. O Essencial custa ${plans.essential.price} e atende ${plans.essential.agents}. O Profissional fica em ${plans.professional.price} para ${plans.professional.agents}. Já o Business sai por ${plans.business.price} para ${plans.business.agents}.

As conversas de atendimento são ilimitadas em todos os planos. O que tem franquia mensal são os templates da Meta. No Essencial, a empresa conta com ${plans.essential.templates}. No Profissional, ${plans.professional.templates}. No Business, ${plans.business.templates}.

Se a operação precisar expandir o volume de envios pagos, ainda existem add-ons padronizados, como ${plans.addOns.marketing} e ${plans.addOns.utility}. Se quiser, eu também posso te indicar qual plano faz mais sentido para o teu cenário.`
  , 2200);
}

function buildHowItWorksPreview(snapshot) {
  const company = snapshot.companyName || 'AutoAtende AI';
  const servicesText = snapshot.services.slice(0, 4).join(', ');

  return sanitizeOutput(
    `Na prática, a ${company} organiza o atendimento da empresa no WhatsApp para responder com mais rapidez, manter as conversas estruturadas e dar mais consistência ao processo comercial. O assistente usa o contexto do negócio para responder dúvidas frequentes, apoiar a qualificação de leads e acelerar o primeiro atendimento.

Quando a conversa exige continuidade humana, o fluxo pode seguir para o time sem perder contexto. ${servicesText ? `Hoje essa lógica conversa bem com frentes como ${servicesText}. ` : ''}A proposta é combinar automação com operação humana, em vez de prometer um atendimento totalmente engessado ou desconectado da realidade da empresa.`
  , 2200);
}

function buildImplementationPreview(snapshot) {
  const company = snapshot.companyName || 'AutoAtende AI';

  return sanitizeOutput(
    `A implantação da ${company} começa pelo alinhamento do contexto do negócio, dos tipos de atendimento, das respostas prioritárias, da qualificação e das situações que devem seguir para uma pessoa da equipe.

Depois, o assistente é configurado e validado no ambiente de teste, o fluxo é conectado ao canal oficial do WhatsApp e os ajustes iniciais são feitos antes da operação. O prazo e a sequência exatos dependem do cenário da empresa e são confirmados antes do início. Esta tela apenas simula a resposta do assistente: ela não agenda reuniões nem executa encaminhamentos reais.`
  , 2200);
}

/* __AUTOATENDE_PREVIEW_HANDOFF_SIMULATION_METADATA_V20_E1_B7_R3__ */
function buildHandoffPreview() {
  return sanitizeOutput(
    `Claro. Vou direcionar sua solicitação para a equipe de atendimento. Para encaminhar corretamente, poderia me informar brevemente qual assunto deseja tratar?`
  , 2200);
}

function buildGroundedUnknownPreview(intent) {
  if (intent === 'payment') {
    return sanitizeOutput(
      `Hoje eu não tenho uma forma de pagamento confirmada no contexto comercial publicado da AutoAtende AI. Para não te passar uma informação errada, o mais seguro é validar esse ponto no atendimento comercial humano antes de assumir qualquer método específico.`
    , 2200);
  }

  if (intent === 'integration') {
    return sanitizeOutput(
      `Hoje eu não tenho uma integração específica confirmada no contexto comercial publicado da AutoAtende AI. Para não inventar compatibilidades, o ideal é validar esse ponto conforme o sistema que você pretende conectar.`
    , 2200);
  }

  return sanitizeOutput(
    `Hoje eu não tenho essa informação específica confirmada no contexto comercial publicado da AutoAtende AI. Para evitar qualquer resposta imprecisa, o mais seguro é tratar esse ponto como dependente de validação comercial ou operacional.`
  , 2200);
}

function buildGenericPreview(snapshot) {
  const company = snapshot.companyName || 'AutoAtende AI';
  const audience = snapshot.targetAudience || 'empresas que atendem pelo WhatsApp';
  const servicesText = snapshot.services.slice(0, 4).join(', ');

  return sanitizeOutput(
    `A ${company} foi pensada para ${audience}, com foco em dar mais velocidade ao atendimento, mais organização para a operação e mais consistência comercial nas respostas. ${snapshot.companyContext ? snapshot.companyContext + ' ' : ''}${servicesText ? `Na prática, isso aparece em frentes como ${servicesText}. ` : ''}Se você quiser, eu posso te responder de forma mais específica sobre funcionamento, planos, qualificação de leads ou operação humana junto com o bot.`
  , 2200);
}

function deterministicSingleTruthPreview(snapshot, intent, message) {
  if (intent === 'pricing') {
    const recommendationPreview = buildPricingRecommendationPreview(message);
    if (recommendationPreview) return recommendationPreview;
    return buildPricingPreview();
  }
  if (intent === 'implementation') return buildImplementationPreview(snapshot);
  if (intent === 'handoff') return buildHandoffPreview();
  if (intent === 'how_it_works') return buildHowItWorksPreview(snapshot);
  if (!topicIsGrounded(snapshot, intent, message)) return buildGroundedUnknownPreview(intent);
  return buildGenericPreview(snapshot);
}

function isWeakPreviewResponse(text = '', intent = 'general') {
  const clean = __aa_c3c6c_norm(text).toLowerCase();

  if (!clean) return true;
  if (/^\s*\d+\.\s+/m.test(text) || /^\s*[-•]\s+/m.test(text) || /\*\*/.test(text)) return true;
  if (/^(olá|ola|oi|bom dia|boa tarde|boa noite)[!,.\s-]+/i.test(clean) && intent !== 'general') return true;
  if (clean.length < 160) return true;
  if (/utility\s*\/\s*authentication|\badd-ons?\b/i.test(clean)) return true;

  if (
    (intent === 'handoff' || intent === 'implementation') &&
    /(agendei|encaminhei|transferi|direcionei|vou agendar|vou encaminhar|vou transferir|vou direcionar)/i.test(clean)
  ) return true;

  if (intent === 'handoff') return true;

  if (intent === 'pricing') {
    const hasCoreFacts =
      clean.includes('essencial') &&
      clean.includes('profissional') &&
      clean.includes('business') &&
      clean.includes('conversas') &&
      clean.includes('templates');

    if (!hasCoreFacts) return true;
  }

  return false;
}

/* __AUTOATENDE_PREVIEW_OPENAI_CONTEXT_TELEMETRY_FIX_V20_E1_B2_R4__ */
async function callOpenAI({ companyId, sourceMode, apiKey, model, temperature, maxTokens, timeoutMs, systemPrompt, userMessage }) {

  try {
    const response = await executeOpenAIRequestWithAbortRetry(
        async (signal) => fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    }),
        {
          companyId,
          sourceMode,
        }
      );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error?.message || `OPENAI_HTTP_${response.status}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!normalizeText(content)) {
      throw new Error('OPENAI_EMPTY_PREVIEW_RESPONSE');
    }

    return content;
  } finally {
  }
}

function buildSystemPrompt(snapshot, sourceMode, message) {
  const intent = detectIntent(message);
  const faqParsed = safeJsonParse(snapshot.faqJson);
  const faqBlock = faqParsed ? JSON.stringify(faqParsed, null, 2) : normalizeText(snapshot.faqJson);
  const plans = buildPlansFacts();

  return `
Você é o motor de preview da AutoAtende AI.
Você deve obedecer a mesma verdade comercial publicada na Central do Assistente.

REGRAS:
- não invente fatos que não estejam no snapshot
- quando faltar informação específica, diga isso com segurança e clareza
- use linguagem natural, profissional, consultiva e pronta para WhatsApp
- não use markdown pesado
- não use listas numeradas
- não invente formas de pagamento, integrações, prazos ou garantias
- não use termos técnicos internos como utility/authentication ou add-on; prefira mensagens de serviço e autenticação e pacotes adicionais
- esta tela de preview não executa transferência, encaminhamento ou agendamento real; nunca afirme que realizou essas ações
- quando o cliente pedir atendimento humano, responda como ele receberia em produção: acolha, diga que vai direcionar a solicitação e peça brevemente o assunto
- não mencione tela de teste, Preview, Inbox, gatilhos internos ou disponibilidade da equipe na mensagem simulada ao cliente
- quando perguntarem sobre implantação, explique as etapas gerais e informe que prazo e sequência dependem do cenário, sem oferecer agendamento

MODO:
- sourceMode=${sourceMode}
- intent=${intent}

SNAPSHOT:
- companyName: ${snapshot.companyName || 'N/D'}
- targetAudience: ${snapshot.targetAudience || 'N/D'}
- toneOfVoice: ${snapshot.toneOfVoice || 'N/D'}
- companyContext: ${snapshot.companyContext || 'N/D'}
- guidance: ${snapshot.guidance || 'N/D'}

SERVIÇOS:
${snapshot.services.length ? snapshot.services.map(item => `- ${item}`).join('\n') : '- N/D'}

TÓPICOS PROIBIDOS:
${snapshot.forbiddenTopics.length ? snapshot.forbiddenTopics.map(item => `- ${item}`).join('\n') : '- N/D'}

FAQ:
${faqBlock || 'N/D'}

PLANOS OFICIAIS:
- Essencial: ${plans.essential.price} — ${plans.essential.agents}
- Profissional: ${plans.professional.price} — ${plans.professional.agents}
- Business: ${plans.business.price} — ${plans.business.agents}
- Templates Essencial: ${plans.essential.templates}
- Templates Profissional: ${plans.professional.templates}
- Templates Business: ${plans.business.templates}
- Add-on marketing: ${plans.addOns.marketing}
- Add-on utility/authentication: ${plans.addOns.utility}
- Conversas de atendimento são ilimitadas
- A franquia mensal vale para templates Meta, não para conversas
`.trim();
}

async function generatePreview({ companyId, sourceMode = 'published', message }) {
  const cleanMessage = normalizeText(message);
  if (!cleanMessage) {
    throw new Error('ASSISTANT_PREVIEW_MESSAGE_REQUIRED');
  }

  const state = assistantCentralService.getCompanyState(companyId);
  const mode = sourceMode === 'draft' ? 'draft' : 'published';
  const snapshot = buildCommercialSnapshotWithStructuredBehavior(state[mode] || {});
  const intent = detectIntent(cleanMessage);
  const systemPrompt = buildSystemPromptWithStructuredBehavior(snapshot, mode, cleanMessage);

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
  const temperature = Number(process.env.OPENAI_TEMPERATURE || 0.2);
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS || 650);
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 25000);
  const maxChars = Number(process.env.OPENAI_MAX_RESPONSE_CHARS || 2200);

  let responseText = '';
  let provider = 'single_truth_fallback';
  let usedFallback = false;
  let qualityGuardApplied = false;

  if (apiKey) {
    try {
      responseText = await callOpenAI({
        companyId,
        sourceMode: mode,
        apiKey,
        model,
        temperature,
        maxTokens,
        timeoutMs,
        systemPrompt,
        userMessage: cleanMessage
      });

      responseText = sanitizeOutput(responseText, maxChars);

      const requiresDeterministicPreviewContract =
        intent === 'implementation' ||
        intent === 'handoff';

      if (
        requiresDeterministicPreviewContract ||
        isWeakPreviewResponse(responseText, intent) ||
        (
          !topicIsGrounded(snapshot, intent, cleanMessage) &&
          intent !== 'pricing' &&
          intent !== 'how_it_works'
        )
      ) {
        qualityGuardApplied = true;
        responseText = deterministicSingleTruthPreview(snapshot, intent, cleanMessage);
        provider = 'openai_single_truth_guard';
      } else {
        provider = 'openai';
      }
    } catch (error) {
      usedFallback = true;
      responseText = deterministicSingleTruthPreview(snapshot, intent, cleanMessage);
      provider = 'single_truth_fallback';
      console.error('[ASSISTANT_CENTRAL_PREVIEW][OPENAI_ERROR]', error.message);
    }
  } else {
    usedFallback = true;
    responseText = deterministicSingleTruthPreview(snapshot, intent, cleanMessage);
    provider = 'single_truth_fallback';
  }

  responseText = sanitizeOutput(responseText, maxChars);

  return {
    marker: MARKER,
    provider,
    usedFallback,
    qualityGuardApplied,
    sourceMode: mode,
    response: responseText,
    handoffSimulation: intent === 'handoff'
      ? {
          active: true,
          actionExecuted: false,
          type: 'human_handoff',
          label: 'Simulação de transbordo',
          notice: 'Nenhuma ação real foi executada.'
        }
      : null,
    snapshotMeta: {
      companyName: snapshot.companyName || 'AutoAtende AI',
      hasUnpublishedChanges: Boolean(state.hasUnpublishedChanges),
      publishedVersion: Number(state?.meta?.lastPublishedVersion || 0),
      lastPublishedAt: state?.meta?.lastPublishedAt || null
    }
  };
}


/* __AUTOATENDE_C16N_C12D_DB_FIX2_SNAPSHOT_AUTHORITY_EXPORT__ */
async function buildSnapshotAuthority({ companyId, sourceMode = 'published', message = 'Quais são os planos da AutoAtende AI hoje?' }) {
  const cleanMessage = normalizeText(message) || 'Quais são os planos da AutoAtende AI hoje?';
  const state = assistantCentralService.getCompanyState(companyId);
  const mode = sourceMode === 'draft' ? 'draft' : 'published';
  const snapshot = buildCommercialSnapshotWithStructuredBehavior(state[mode] || {});
  const systemPrompt = buildSystemPromptWithStructuredBehavior(snapshot, mode, cleanMessage);

  return {
    marker: MARKER,
    sourceMode: mode,
    message: cleanMessage,
    snapshot_system_prompt: systemPrompt,
    snapshot_system_prompt_length: String(systemPrompt || '').length,
    snapshot_summary: {
      companyName: snapshot.companyName || 'AutoAtende AI',
      targetAudience: snapshot.targetAudience || '',
      toneOfVoice: snapshot.toneOfVoice || '',
      companyContext: snapshot.companyContext || '',
      guidance: snapshot.guidance || '',
      servicesCount: Array.isArray(snapshot.services) ? snapshot.services.length : 0,
      forbiddenTopicsCount: Array.isArray(snapshot.forbiddenTopics) ? snapshot.forbiddenTopics.length : 0,
      hasFaq: Boolean(normalizeText(snapshot.faqJson)),
      hasUnpublishedChanges: Boolean(state?.hasUnpublishedChanges),
      publishedVersion: Number(state?.meta?.lastPublishedVersion || 0),
      lastPublishedAt: state?.meta?.lastPublishedAt || null
    }
  };
}

/* __AUTOATENDE_C16N_C12F_B1_WIRING_STRUCTURED_BEHAVIOR_PREVIEW_RUNTIME__ PREVIEW_SERVICE */
function __aaC12fB1NormalizeListish(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,|;/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function __aaC12fB1DescribeQualificationMode(value) {
  switch (normalizeText(value)) {
    case 'always_qualify_first':
      return 'Antes de avançar para proposta, preço, orçamento ou encaminhamento, priorize coletar os dados de qualificação definidos.';
    case 'never_force_qualification':
      return 'Responda diretamente sem insistir em qualificação; só faça perguntas se isso for indispensável para não inventar informação.';
    case 'only_when_needed':
    default:
      return 'Responda diretamente quando houver base suficiente e só faça perguntas curtas de qualificação quando isso for necessário para avançar com segurança.';
  }
}

function __aaC12fB1DescribeResponsePolicy(value) {
  switch (normalizeText(value)) {
    case 'ask_brief_question_before_answering':
      return 'Se houver ambiguidade relevante, faça no máximo uma pergunta curta antes de responder.';
    case 'guide_to_human_when_risky':
      return 'Quando faltar segurança, houver sensibilidade comercial ou risco operacional, prefira orientar transbordo humano.';
    case 'answer_direct_when_confident':
    default:
      return 'Quando o contexto estiver bem ancorado, responda diretamente sem enrolação.';
  }
}

function buildCommercialSnapshotWithStructuredBehavior(profile = {}) {
  const base = buildCommercialSnapshot(profile || {});
  const qualificationMode =
    normalizeText(profile?.qualificationMode ?? profile?.qualification_mode) || 'only_when_needed';
  const responsePolicy =
    normalizeText(profile?.responsePolicy ?? profile?.response_policy) || 'answer_direct_when_confident';
  const qualificationFields = __aaC12fB1NormalizeListish(
    profile?.qualificationFields ??
    profile?.qualification_fields ??
    profile?.qualificationFieldsText ??
    profile?.qualification_fields_text
  );
  const handoffTriggers = __aaC12fB1NormalizeListish(
    profile?.handoffTriggers ??
    profile?.handoff_triggers ??
    profile?.handoffTriggersText ??
    profile?.handoff_triggers_text
  );

  return {
    ...base,
    qualificationMode,
    qualification_mode: qualificationMode,
    responsePolicy,
    response_policy: responsePolicy,
    qualificationFields,
    qualification_fields: qualificationFields,
    qualificationFieldsText: qualificationFields.join('\n'),
    qualification_fields_text: qualificationFields.join('\n'),
    handoffTriggers,
    handoff_triggers: handoffTriggers,
    handoffTriggersText: handoffTriggers.join('\n'),
    handoff_triggers_text: handoffTriggers.join('\n'),
  };
}

function __aaC12fB1BuildStructuredBehaviorBlock(snapshot = {}) {
  const qualificationMode =
    normalizeText(snapshot?.qualificationMode ?? snapshot?.qualification_mode) || 'only_when_needed';
  const responsePolicy =
    normalizeText(snapshot?.responsePolicy ?? snapshot?.response_policy) || 'answer_direct_when_confident';
  const qualificationFields = __aaC12fB1NormalizeListish(
    snapshot?.qualificationFields ??
    snapshot?.qualification_fields ??
    snapshot?.qualificationFieldsText ??
    snapshot?.qualification_fields_text
  );
  const handoffTriggers = __aaC12fB1NormalizeListish(
    snapshot?.handoffTriggers ??
    snapshot?.handoff_triggers ??
    snapshot?.handoffTriggersText ??
    snapshot?.handoff_triggers_text
  );

  const lines = [
    '[COMPORTAMENTO E QUALIFICAÇÃO ESTRUTURADA]',
    `- qualificationMode: ${qualificationMode}`,
    `- responsePolicy: ${responsePolicy}`,
    `- interpretação de qualificationMode: ${__aaC12fB1DescribeQualificationMode(qualificationMode)}`,
    `- interpretação de responsePolicy: ${__aaC12fB1DescribeResponsePolicy(responsePolicy)}`,
    '- regra operacional: se houver informação suficiente no contexto, responda direto; se faltar contexto relevante, faça a menor pergunta possível; se houver gatilho claro de transbordo, sinalize humano.',
    '- campos de qualificação prioritários:'
  ];

  if (qualificationFields.length) {
    qualificationFields.forEach((item) => lines.push(`  - ${item}`));
  } else {
    lines.push('  - nenhum campo explícito configurado');
  }

  lines.push('- gatilhos de transbordo humano:');
  if (handoffTriggers.length) {
    handoffTriggers.forEach((item) => lines.push(`  - ${item}`));
  } else {
    lines.push('  - nenhum gatilho explícito configurado');
  }

  return lines.join('\n');
}

function buildSystemPromptWithStructuredBehavior(snapshot, sourceMode, message) {
  const safeSnapshot = buildCommercialSnapshotWithStructuredBehavior(snapshot || {});
  const basePrompt = buildSystemPrompt(safeSnapshot, sourceMode, message);
  const structuredBlock = __aaC12fB1BuildStructuredBehaviorBlock(safeSnapshot);
  const cleanBase = String(basePrompt || '').trim();

  if (!structuredBlock) return cleanBase;
  if (cleanBase.includes('[COMPORTAMENTO E QUALIFICAÇÃO ESTRUTURADA]')) return cleanBase;

  return `${cleanBase}\n\n${structuredBlock}`.trim();
}

module.exports = {
  MARKER,
  generatePreview,
  buildSnapshotAuthority
};

module.exports.buildCommercialSnapshotWithStructuredBehavior = buildCommercialSnapshotWithStructuredBehavior;
module.exports.buildSystemPromptWithStructuredBehavior = buildSystemPromptWithStructuredBehavior;
