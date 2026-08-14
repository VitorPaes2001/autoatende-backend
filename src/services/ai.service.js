const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const logger = require("../../utils/logger");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS || 350);
const OPENAI_TEMPERATURE = Number(process.env.OPENAI_TEMPERATURE || 0.4);
const assistantCommercialFacts = require('../config/assistantCommercialFacts');

/* __AUTOATENDE_P3_R5_ASSISTANT_CENTRAL_AUTHORITY_RESTORE__ */
function __aaAssistantCentralAuthorityEnabled() {
  const raw = String(process.env.ASSISTANT_CENTRAL_AUTHORITY_ENABLED ?? "true").trim().toLowerCase();
  return !["false", "0", "off", "no"].includes(raw);
}

function __aaAllowDeterministicCommercialEnhancers() {
  const raw = String(process.env.ASSISTANT_DETERMINISTIC_COMMERCIAL_ENHANCERS ?? "false").trim().toLowerCase();
  return ["true", "1", "on", "yes"].includes(raw);
}

function __aaShouldForceStandardPlans(userIntent) {
  return userIntent === "plans" && (!__aaAssistantCentralAuthorityEnabled() || __aaAllowDeterministicCommercialEnhancers());
}

/* __AUTOATENDE_P3_R6_ASSISTANT_COMMERCIAL_FACTS__ */
/* __AUTOATENDE_P3_R5B_PLAN_RECOMMENDATION_REBALANCE__ */
function __aaP3r5bPlanRecommendationRebalanceEnabled() {
  const raw = String(process.env.ASSISTANT_PLAN_RECOMMENDATION_REBALANCE ?? "true").trim().toLowerCase();
  return !["false", "0", "off", "no"].includes(raw);
}

function __aaP3r5bExtractAgentNeed(question) {
  return assistantCommercialFacts.extractAgentNeed(question);
}

function __aaP3r5bLooksLikeRecommendationQuestion(question) {
  return assistantCommercialFacts.looksLikePlanRecommendationQuestion(question);
}

function __aaP3r5bHasExplicitRecommendation(text) {
  const s = String(text || "");
  return /(plano\s+(mais\s+)?(indicado|ideal|recomendado)|eu\s+indicaria\s+o|eu\s+recomendaria\s+o|faz\s+mais\s+sentido\s+(come[cç]ar\s+)?com\s+o)\s+\*?(Essencial|Profissional|Business)\b/i.test(s)
    || /\bpara\s+uma\s+equipe\s+com\s+\d+.*?\b(Essencial|Profissional|Business)\b/i.test(s);
}

function __aaP3r5bBuildRecommendationPrefix(agentNeed) {
  return assistantCommercialFacts.buildRecommendationPrefix(agentNeed, { includeGrowth: true });
}

function __aaP3r5bRebalanceRecommendation(question, text) {
  if (!__aaAssistantCentralAuthorityEnabled()) return text;
  if (__aaAllowDeterministicCommercialEnhancers()) return text;
  if (!__aaP3r5bPlanRecommendationRebalanceEnabled()) return text;
  if (!__aaP3r5bLooksLikeRecommendationQuestion(question)) return text;

  const agentNeed = __aaP3r5bExtractAgentNeed(question);
  if (!agentNeed) return text;

  const current = String(text || "").trim();
  if (!current) return current;
  if (__aaP3r5bHasExplicitRecommendation(current)) return current;

  const prefix = __aaP3r5bBuildRecommendationPrefix(agentNeed);
  if (!prefix) return current;

  try {
    logger.info("[AI Service] P3-R5B recommendation rebalance applied", { agentNeed });
  } catch (_) {}

  return `${prefix}\n\n${current}`.trim();
}

function ensureKey() {
  if (!OPENAI_API_KEY || !String(OPENAI_API_KEY).trim()) {
    throw new Error("OPENAI_API_KEY not set");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, label, attempts = 2) {
  let lastError = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || null;

      logger.warn(`[AI Service] ${label} failed on attempt ${i}/${attempts}`, {
        status,
        message: error?.message || String(error)
      });

      if (i < attempts) {
        await sleep(600 * i);
      }
    }
  }

  throw lastError;
}


// __AUTOATENDE_C3C6C_COMMERCIAL_STYLE_POLISH__
function __aa_c3c6c_norm(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function __aa_c3c6c_stripGreeting(text) {
  const clean = __aa_c3c6c_norm(text);
  if (!clean) return clean;

  const longEnough = clean.length > 180;
  if (!longEnough) return clean;

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

function __aa_c3c6c_applyCommercialStylePolish(text) {
  let clean = __aa_c3c6c_norm(text);
  if (!clean) return clean;

  clean = __aa_c3c6c_stripGreeting(clean);
  clean = __aa_c3c6c_flattenListyText(clean);

  return clean.trim();
}


function sanitizeText(value, maxLen = 1200) {
  value = __aa_c3c6c_applyCommercialStylePolish(value);
  const text = String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen).trim() : text;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((m) => m && ["system", "user", "assistant"].includes(m.role) && String(m.content || "").trim())
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: sanitizeText(m.content, 4000)
    }));
}

/**
 * Transcreve arquivo de áudio usando OpenAI
 */
async function transcribeAudio(filePath) {
  ensureKey();

  try {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error("Audio file not found");
    }

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("model", TRANSCRIPTION_MODEL);

    const response = await withRetry(
      () =>
        axios.post("https://api.openai.com/v1/audio/transcriptions", form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${OPENAI_API_KEY}`
          },
          timeout: OPENAI_TIMEOUT_MS
        }),
      "audio.transcription",
      2
    );

    const text = sanitizeText(response?.data?.text || "", 4000);
    if (!text) throw new Error("Empty transcription");

    return text;
  } catch (error) {
    logger.error("[AI Service] Transcription failed", {
      message: error?.message || String(error),
      status: error?.response?.status || null,
      data: error?.response?.data || null
    });
    throw new Error("Failed to transcribe audio");
  }
}

/**
 * Gera resposta de chat usando OpenAI
 */

/* __AUTOATENDE_B69_RESPONSE_STYLE_FINISH__ */
function polishCommercialResponse(text) {
  let out = String(text || "").trim();
  if (!out) return "";

  out = out
    .replace(/\r/g, "")
    .replace(/\*\*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();

  const looksLikePracticalList =
    /aqui estão os principais pontos/i.test(out) ||
    /\b1\.\s*(respostas automáticas|organização do inbox|qualificação de leads|alternância entre bot e humano|planos mensais)/i.test(out) ||
    (/\b1\./.test(out) && /\b2\./.test(out));

  if (looksLikePracticalList) {
    const mentionsPlans = /\bplano|planos|agentes|mensagens/i.test(out);

    out =
      "Na prática, a AutoAtende AI centraliza o atendimento da empresa no WhatsApp. O bot responde dúvidas frequentes, organiza as conversas em uma inbox e ajuda a qualificar leads logo no primeiro contato. Quando necessário, um atendente humano pode assumir a conversa sem perder o contexto, mantendo velocidade no atendimento e controle da operação." +
      (mentionsPlans
        ? " A plataforma também pode ser configurada conforme o porte da equipe, com planos que variam em número de agentes e franquia de mensagens."
        : "") +
      " Se quiser, posso te mostrar qual plano faz mais sentido para o seu tipo de operação.";

    return out.trim();
  }

  out = out
    .replace(/Aqui estão os principais pontos[^:]*:\s*/gi, "")
    .replace(/\b\d+\.\s*/g, "")
    .replace(/\s*Se precisar de mais informações sobre os planos ou funcionalidades específicas, é só avisar!\s*$/i,
      " Se quiser, posso te mostrar qual plano faz mais sentido para o seu tipo de operação.")
    .replace(/\s*Se precisar de mais detalhes sobre os planos, estou à disposição!\s*$/i,
      " Se quiser, posso te mostrar qual plano faz mais sentido para o seu tipo de operação.")
    .trim();

  return out;
}


/* __AUTOATENDE_B9_AI_SERVICE_CLEANUP__ */
/*
  Helpers organizados nesta ordem:
  1) sanitize / utilitários básicos
  2) observabilidade e fallback (B7)
  3) inferência de intenção (B8R)
  4) geração principal de resposta
*/

/* __AUTOATENDE_B7_FALLBACK_OBSERVABILITY__ */
function logAiPipeline(event, data = {}) {
  try {
    const enabled = String(process.env.OPENAI_LOG_PIPELINE || "true").toLowerCase() !== "false";
    if (!enabled) return;
    console.info(`[AI_PIPELINE] ${event} ${JSON.stringify(data)}`);
  } catch (_) {}
}

function getLatestUserMessage(messages = []) {
  const arr = Array.isArray(messages) ? messages : [];
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const msg = arr[i] || {};
    if (String(msg.role || "").toLowerCase() === "user") {
      return sanitizeText(msg.content || "", 1000);
    }
  }
  return "";
}

/* __AUTOATENDE_B8R_INTENT_AWARE_GUARD__ */
function inferUserIntent(question = "") {
  const q = String(question || "").trim().toLowerCase();

  if (!q) return "empty";

  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|e aí|e ai)[!.? ]*$/i.test(q)) {
    return "greeting";
  }

  if (/^(obrigado|obrigada|valeu|agradeço|agradeco|show|perfeito)[!.? ]*$/i.test(q)) {
    return "thanks";
  }

  if (/^(sim|ok|okay|blz|beleza|certo|entendi|quero|pode ser)[!.? ]*$/i.test(q)) {
    return "affirmation";
  }

  if (/plano|planos|preço|precos|preços|valor|quanto custa|mensalidade/i.test(q)) {
    return "plans";
  }

  if (/humano|atendente|pessoa|falar com alguém|falar com alguem|suporte humano/i.test(q)) {
    return "human";
  }

  if (/como funciona|na prática|na pratica|funciona na prática|funciona na pratica/i.test(q)) {
    return "practical";
  }

  return "other";
}

function isWeakResponseForIntent(question = "", rawContent = "", minAcceptable = 80) {
  const content = sanitizeText(rawContent || "", 4000);
  const intent = inferUserIntent(question);

  if (!content) return true;

  if (intent === "greeting") {
    return content.length < 12;
  }

  if (intent === "thanks" || intent === "affirmation") {
    return content.length < 16;
  }

  return content.length < minAcceptable;
}

/* __AUTOATENDE_B9P_PLANS_ALIGNMENT__ */
/* __AUTOATENDE_B9PR_FORCE_STANDARD_PLANS__ */
function buildStandardPlansResponse() {
  return assistantCommercialFacts.buildStandardPlansResponse({ includeClosing: true });
}

function isPlansResponseAligned(text = "") {
  const t = String(text || "").toLowerCase();

  const hasEssencial = t.includes("essencial");
  const hasProfissional = t.includes("profissional");
  const hasBusiness = t.includes("business");

  const hasPrice1 = t.includes("249,90") || t.includes("249.90");
  const hasPrice2 = t.includes("449,90") || t.includes("449.90");
  const hasPrice3 = t.includes("699,90") || t.includes("699.90");

  const hasUnlimited = /conversas?.{0,25}ilimitad/i.test(t);
  const hasTemplates = t.includes("template");
  const hasMarketing = t.includes("marketing");
  const hasUtility = t.includes("utility") || t.includes("authentication") || t.includes("autentica");

  return Boolean(
    hasEssencial &&
    hasProfissional &&
    hasBusiness &&
    hasPrice1 &&
    hasPrice2 &&
    hasPrice3 &&
    hasUnlimited &&
    hasTemplates &&
    hasMarketing &&
    hasUtility
  );
}

function buildFallbackResponse({ messages, reason } = {}) {
  const question = getLatestUserMessage(messages);
  const q = String(question || "").toLowerCase();

  const asksPractical =
    /como funciona|na prática|na pratica|funciona na prática|funciona na pratica/.test(q);

  const asksPlans =
    /plano|planos|preço|precos|preços|valor|quanto custa|mensalidade/.test(q);

  const asksHuman =
    /humano|atendente|pessoa|falar com alguém|falar com alguem|suporte humano/.test(q);

  let out = "";

  if (inferUserIntent(question) === "greeting") {
    out = "Olá! Como posso ajudar você hoje?";
  } else if (asksPlans) {
    out = buildStandardPlansResponse();
  } else if (asksHuman) {
    out =
      "Posso seguir com o atendimento por aqui e, se você preferir, direcionar a conversa para um atendente humano quando necessário. Se quiser, me diga que eu priorizo esse encaminhamento.";
  } else if (asksPractical) {
    out =
      "Na prática, a AutoAtende AI centraliza o atendimento da empresa no WhatsApp. O bot responde dúvidas frequentes, organiza as conversas em uma inbox e ajuda a qualificar leads logo no primeiro contato. Quando necessário, um atendente humano pode assumir a conversa sem perder o contexto, mantendo velocidade no atendimento e controle da operação. A plataforma também pode ser configurada conforme o porte da equipe, com planos que variam em número de agentes e franquia de mensagens. Se quiser, posso te mostrar qual plano faz mais sentido para o seu tipo de operação.";
  } else {
    out =
      "A AutoAtende AI ajuda empresas a atender clientes pelo WhatsApp com mais rapidez, organização e controle operacional. O bot pode responder dúvidas frequentes, apoiar a qualificação de leads e permitir atendimento humano quando necessário. Se quiser, posso te explicar como isso se aplica ao seu tipo de operação.";
  }

  const final = sanitizeText(
    polishCommercialResponse(out),
    Number(process.env.OPENAI_MAX_RESPONSE_CHARS || 2200)
  );

  logAiPipeline("fallback_built", {
    reason: reason || null,
    question_preview: sanitizeText(question, 160),
    final_len: final.length
  });

  return final;
}

async function generateResponse(messages, systemPrompt) {
  ensureKey();

  try {
    const normalizedMessages = normalizeMessages(messages);

    const payload = {
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: sanitizeText(systemPrompt || "Você é um assistente virtual útil.", 8000)
        },
        ...normalizedMessages
      ],
      temperature: OPENAI_TEMPERATURE,
      max_tokens: OPENAI_MAX_TOKENS
    };

    const response = await withRetry(
      () =>
        axios.post("https://api.openai.com/v1/chat/completions", payload, {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: OPENAI_TIMEOUT_MS
        }),
      "chat.completion",
      2
    );

    const content = response?.data?.choices?.[0]?.message?.content || "";
    const latestUserMessage = getLatestUserMessage(messages);
    const userIntent = inferUserIntent(latestUserMessage);
    const rawContent = sanitizeText(content || "", 4000);
    const minAcceptable = Number(process.env.OPENAI_MIN_ACCEPTABLE_RESPONSE_CHARS || 80);
    const fallbackEnabled = String(process.env.OPENAI_FALLBACK_ENABLED || "true").toLowerCase() !== "false";
    const weakOrEmpty = isWeakResponseForIntent(latestUserMessage, rawContent, minAcceptable);
    const forceStandardPlans = __aaShouldForceStandardPlans(userIntent);
    const effectiveContent = forceStandardPlans
      ? buildStandardPlansResponse()
      : ((fallbackEnabled && weakOrEmpty)
          ? buildFallbackResponse({ messages, reason: !rawContent ? "empty_response" : "weak_response" })
          : rawContent);
    const polishedTextBase = forceStandardPlans ? effectiveContent : polishCommercialResponse(effectiveContent);
    const polishedText = __aaP3r5bRebalanceRecommendation(latestUserMessage, polishedTextBase);
    const finalText = sanitizeText(polishedText, Number(process.env.OPENAI_MAX_RESPONSE_CHARS || 2200));
    logAiPipeline("response_ready", {
      used_fallback: Boolean(fallbackEnabled && weakOrEmpty && !forceStandardPlans),
      used_plans_forced: Boolean(forceStandardPlans),
      reason: Boolean(fallbackEnabled && weakOrEmpty && !forceStandardPlans) ? (!rawContent ? "empty_response" : "weak_response") : null,
      intent: userIntent,
      question_preview: sanitizeText(latestUserMessage, 160),
      raw_len: rawContent.length,
      final_len: finalText.length,
      model: process.env.OPENAI_CHAT_MODEL || null
    });

    if (!finalText) {
      throw new Error("Empty AI response");
    }

    return finalText;
  } catch (error) {
    const fallbackEnabledOnError = String(process.env.OPENAI_FALLBACK_ENABLED || "true").toLowerCase() !== "false";
    if (fallbackEnabledOnError) {
      const fallbackText = buildFallbackResponse({
        messages,
        reason: error?.message || "provider_error"
      });
      logAiPipeline("provider_error_fallback", {
        error_message: String(error?.message || error),
        question_preview: sanitizeText(getLatestUserMessage(messages), 160),
        fallback_len: fallbackText.length,
        model: process.env.OPENAI_CHAT_MODEL || null
      });
      return fallbackText;
    }
    throw error;
  }
}

module.exports = {
  transcribeAudio,
  generateResponse
};


/* __AUTOATENDE_P3_R1_ASSISTANT_OUTPUT_GOVERNANCE__ */

function __aaP3r1HasEmoji(text) {
  return /[\u{1F300}-\u{1FAFF}]/u.test(String(text || ''));
}

function __aaP3r1NormalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function __aaP3r1StripMarkdown(text) {
  let s = String(text || '');

  s = s.replace(/```([\s\S]*?)```/g, (_, inner) => String(inner || '').trim());
  s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  s = s.replace(/(^|[\s(])\*\*([^*]+)\*\*(?=[\s).,!?]|$)/g, '$1$2');
  s = s.replace(/(^|[\s(])__([^_]+)__(?=[\s).,!?]|$)/g, '$1$2');
  s = s.replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,!?]|$)/g, '$1$2');
  s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?]|$)/g, '$1$2');
  s = s.replace(/^\s*[-*]\s+/gm, '• ');
  s = s.replace(/^\s*\d+\.\s+/gm, (m) => m.trim());

  return s;
}

function __aaP3r1SplitSentences(text) {
  const parts = String(text || '').match(/[^.!?]+[.!?]?/g);
  return Array.isArray(parts) ? parts.map((p) => p.trim()).filter(Boolean) : [String(text || '').trim()].filter(Boolean);
}

function __aaP3r1ChunkSentences(sentences, maxLen = 220) {
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;

    if (!current) {
      current = sentence;
      continue;
    }

    if ((current + ' ' + sentence).length <= maxLen) {
      current += ' ' + sentence;
    } else {
      chunks.push(current.trim());
      current = sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function __aaP3r1WrapLongParagraph(paragraph) {
  const p = String(paragraph || '').trim();
  if (!p) return '';

  if (p.length <= 260) return p;
  if (/^(•|\d+\.)\s/.test(p)) return p;

  const sentences = __aaP3r1SplitSentences(p);
  if (sentences.length <= 1) return p;

  return __aaP3r1ChunkSentences(sentences).join('\n\n');
}

function __aaP3r1LooksCommercial(text) {
  return /\b(plano|planos|preço|precos|valor|mensalidade|implantação|implantacao|whatsapp|atendimento|empresa|automação|automacao|lead|cliente)\b/i.test(String(text || ''));
}

function __aaP3r1ApplyPlanBreaks(text) {
  let s = String(text || '');

  const priceHits = (s.match(/R\$\s?\d/gi) || []).length;
  const planHits = (s.match(/\b(Essencial|Profissional|Business)\b/gi) || []).length;

  if (priceHits >= 2) {
    s = s.replace(/\s+(?=R\$\s?\d)/g, '\n');
  }

  if (planHits >= 2) {
    s = s.replace(/\s+(?=(Essencial|Profissional|Business)\b)/g, '\n');
  }

  return s;
}

function __aaP3r1ApplyGreetingPolish(text) {
  let s = String(text || '');
  const lines = s.split('\n');
  const first = String(lines[0] || '').trim();

  if (/^(ol[áa]|oi|bom dia|boa tarde|boa noite)/i.test(first) && !__aaP3r1HasEmoji(first)) {
    lines[0] = first + ' 👋';
    s = lines.join('\n');
  }

  return s;
}

function __aaP3r1ApplyCommercialClosing(text) {
  let s = String(text || '').trim();
  if (!s) return s;

  const alreadyHasClosing = /(posso te mostrar|posso te indicar|faz sentido para o seu cenário|se fizer sentido|quer que eu te mostre|qual plano)/i.test(s);
  const shouldClose =
    /\b(plano|planos|preço|precos|valor|mensalidade|implantação|implantacao)\b/i.test(s) &&
    s.length >= 140 &&
    !alreadyHasClosing;

  if (shouldClose) {
    s += '\n\nSe fizer sentido, posso te indicar o plano mais adequado para o seu cenário.';
  }

  return s;
}

function __aaP3r1FormatResponseText(raw) {
  let s = String(raw || '');
  if (!s.trim()) return s;

  s = __aaP3r1NormalizeWhitespace(s);
  s = __aaP3r1StripMarkdown(s);
  s = __aaP3r1NormalizeWhitespace(s);
  s = __aaP3r1ApplyPlanBreaks(s);

  const paragraphs = s
    .split(/\n{2,}/)
    .map((p) => __aaP3r1WrapLongParagraph(p))
    .filter(Boolean);

  s = paragraphs.join('\n\n');
  s = __aaP3r1NormalizeWhitespace(s);
  s = __aaP3r1ApplyGreetingPolish(s);

  if (__aaP3r1LooksCommercial(s)) {
    s = __aaP3r1ApplyCommercialClosing(s);
  }

  s = __aaP3r1NormalizeWhitespace(s);
  return s;
}

function __aaP3r1CloneObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice();
  return { ...obj };
}

function __aaP3r1FormatResult(result) {
  if (typeof result === 'string') {
    return __aaP3r1FormatResponseText(result);
  }

  if (!result || typeof result !== 'object') {
    return result;
  }

  const cloned = __aaP3r1CloneObject(result);
  const candidateKeys = ['response', 'text', 'content', 'message', 'reply', 'answer', 'output'];

  for (const key of candidateKeys) {
    if (typeof cloned[key] === 'string' && cloned[key].trim()) {
      cloned[key] = __aaP3r1FormatResponseText(cloned[key]);
    }
  }

  if (Array.isArray(cloned.choices)) {
    cloned.choices = cloned.choices.map((choice) => {
      if (!choice || typeof choice !== 'object') return choice;
      const nextChoice = { ...choice };

      if (typeof nextChoice.text === 'string' && nextChoice.text.trim()) {
        nextChoice.text = __aaP3r1FormatResponseText(nextChoice.text);
      }

      if (nextChoice.message && typeof nextChoice.message === 'object' && typeof nextChoice.message.content === 'string') {
        nextChoice.message = {
          ...nextChoice.message,
          content: __aaP3r1FormatResponseText(nextChoice.message.content),
        };
      }

      return nextChoice;
    });
  }

  return cloned;
}

function __aaP3r1WrapExportedFunction(fn, label) {
  if (typeof fn !== 'function') return fn;
  if (fn.__aaP3r1Wrapped) return fn;

  const wrapped = async function __aaP3r1WrappedFunction(...args) {
    const result = await fn.apply(this, args);
    return __aaP3r1FormatResult(result);
  };

  try {
    Object.defineProperty(wrapped, 'name', {
      value: fn.name || label || 'aaP3r1WrappedFunction',
      configurable: true,
    });
  } catch (_) {}

  wrapped.__aaP3r1Wrapped = true;
  wrapped.__aaP3r1Original = fn;
  return wrapped;
}

function __aaP3r1PatchExportsObject(exportsObj) {
  if (!exportsObj || typeof exportsObj !== 'object') return exportsObj;

  const next = exportsObj;
  const keys = Object.keys(next);

  let wrappedCount = 0;
  for (const key of keys) {
    if (typeof next[key] !== 'function') continue;
    if (!/(response|reply|message|completion|generate|chat|assistant|preview|ask)/i.test(key)) continue;

    next[key] = __aaP3r1WrapExportedFunction(next[key], key);
    wrappedCount += 1;
  }

  if (wrappedCount === 0) {
    for (const key of keys) {
      if (typeof next[key] !== 'function') continue;
      next[key] = __aaP3r1WrapExportedFunction(next[key], key);
    }
  }

  next.__aaP3r1FormatResponseText = __aaP3r1FormatResponseText;
  return next;
}

if (typeof module.exports === 'function') {
  module.exports = __aaP3r1WrapExportedFunction(module.exports, 'defaultExport');
  module.exports.__aaP3r1FormatResponseText = __aaP3r1FormatResponseText;
} else if (module.exports && typeof module.exports === 'object') {
  module.exports = __aaP3r1PatchExportsObject(module.exports);
}


/* __AUTOATENDE_P3_R2_ASSISTANT_BUSINESS_INTELLIGENCE__ */

function __aaP3r2NormalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function __aaP3r2IsPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function __aaP3r2SplitListFromString(value) {
  const normalized = __aaP3r2NormalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(/\n|;|,|\|/g)
    .map((item) => __aaP3r2NormalizeText(item))
    .filter(Boolean)
    .slice(0, 12);
}

function __aaP3r2NormalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return __aaP3r2NormalizeText(item);
        if (__aaP3r2IsPlainObject(item)) {
          return __aaP3r2NormalizeText(
            item.label ||
            item.title ||
            item.name ||
            item.value ||
            item.text ||
            item.description ||
            ''
          );
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof value === 'string') {
    return __aaP3r2SplitListFromString(value);
  }

  return [];
}

function __aaP3r2TakeText(obj, keys) {
  if (!__aaP3r2IsPlainObject(obj)) return '';
  for (const key of keys) {
    const value = obj[key];
    const normalized = __aaP3r2NormalizeText(value);
    if (normalized) return normalized;
  }
  return '';
}

function __aaP3r2TakeList(obj, keys) {
  if (!__aaP3r2IsPlainObject(obj)) return [];
  for (const key of keys) {
    const normalized = __aaP3r2NormalizeList(obj[key]);
    if (normalized.length) return normalized;
  }
  return [];
}

function __aaP3r2LooksLikeAssistantProfile(obj) {
  if (!__aaP3r2IsPlainObject(obj)) return false;

  const relevantKeys = [
    'companyName', 'company_name', 'businessName', 'business_name', 'segment', 'industry',
    'targetAudience', 'target_audience', 'idealCustomer', 'ideal_customer',
    'services', 'products', 'differentials', 'differentiators',
    'toneOfVoice', 'tone_of_voice', 'cta', 'ctaPrimary', 'cta_primary',
    'assistantRules', 'assistant_rules', 'forbiddenClaims', 'forbidden_claims',
    'objections', 'commonObjections', 'common_objections',
    'faq', 'faqs', 'frequentlyAskedQuestions', 'frequently_asked_questions',
    'published', 'draft', 'commercialProfile', 'commercial_profile',
    'assistantProfile', 'assistant_profile', 'profileSnapshot', 'profile_snapshot'
  ];

  return relevantKeys.some((key) => Object.prototype.hasOwnProperty.call(obj, key));
}

function __aaP3r2SnapshotScore(obj) {
  if (!__aaP3r2IsPlainObject(obj)) return 0;

  const fields = [
    __aaP3r2TakeText(obj, ['companyName', 'company_name', 'businessName', 'business_name', 'name']),
    __aaP3r2TakeText(obj, ['segment', 'industry', 'businessSegment', 'business_segment']),
    __aaP3r2TakeText(obj, ['targetAudience', 'target_audience', 'idealCustomer', 'ideal_customer']),
    __aaP3r2TakeText(obj, ['toneOfVoice', 'tone_of_voice', 'tone', 'voice']),
    __aaP3r2TakeText(obj, ['cta', 'ctaPrimary', 'cta_primary']),
  ];

  const lists = [
    __aaP3r2TakeList(obj, ['services', 'serviceList', 'service_list', 'products', 'offerings']),
    __aaP3r2TakeList(obj, ['differentials', 'differentiators', 'competitiveAdvantages', 'competitive_advantages']),
    __aaP3r2TakeList(obj, ['assistantRules', 'assistant_rules', 'rules', 'forbiddenClaims', 'forbidden_claims']),
    __aaP3r2TakeList(obj, ['objections', 'commonObjections', 'common_objections']),
    __aaP3r2TakeList(obj, ['faq', 'faqs', 'frequentlyAskedQuestions', 'frequently_asked_questions']),
  ];

  return fields.filter(Boolean).length + lists.filter((list) => list.length > 0).length;
}

function __aaP3r2ChooseBestSnapshot(candidates) {
  const valid = (Array.isArray(candidates) ? candidates : []).filter(__aaP3r2IsPlainObject);
  if (!valid.length) return null;

  valid.sort((a, b) => __aaP3r2SnapshotScore(b) - __aaP3r2SnapshotScore(a));
  return valid[0] || null;
}

function __aaP3r2ExtractSnapshotFromObject(obj) {
  if (!__aaP3r2IsPlainObject(obj)) return null;

  const directCandidates = [
    obj,
    obj.draft,
    obj.published,
    obj.profile,
    obj.profileSnapshot,
    obj.profile_snapshot,
    obj.commercialProfile,
    obj.commercial_profile,
    obj.assistantProfile,
    obj.assistant_profile,
    obj.companyCommercialProfile,
    obj.company_commercial_profile,
    obj.onboardingProfile,
    obj.onboarding_profile,
    obj.state,
    obj.data,
  ].filter(__aaP3r2IsPlainObject);

  const direct = __aaP3r2ChooseBestSnapshot(directCandidates);
  if (direct && __aaP3r2SnapshotScore(direct) >= 2) return direct;

  return null;
}

function __aaP3r2FindSnapshot(value, depth = 0, seen = new Set()) {
  if (depth > 5 || value === null || value === undefined) return null;

  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
  }

  if (__aaP3r2IsPlainObject(value)) {
    const extracted = __aaP3r2ExtractSnapshotFromObject(value);
    if (extracted) return extracted;

    const nestedValues = Object.values(value).slice(0, 30);
    const nestedCandidates = [];

    for (const nested of nestedValues) {
      const candidate = __aaP3r2FindSnapshot(nested, depth + 1, seen);
      if (candidate) nestedCandidates.push(candidate);
    }

    return __aaP3r2ChooseBestSnapshot(nestedCandidates);
  }

  if (Array.isArray(value)) {
    const nestedCandidates = [];
    for (const item of value.slice(0, 20)) {
      const candidate = __aaP3r2FindSnapshot(item, depth + 1, seen);
      if (candidate) nestedCandidates.push(candidate);
    }
    return __aaP3r2ChooseBestSnapshot(nestedCandidates);
  }

  return null;
}

function __aaP3r2BuildCompactBullets(items) {
  const list = (Array.isArray(items) ? items : []).map(__aaP3r2NormalizeText).filter(Boolean).slice(0, 6);
  return list.map((item) => `- ${item}`).join('\n');
}

function __aaP3r2BuildBusinessContext(snapshot) {
  if (!__aaP3r2IsPlainObject(snapshot)) return '';

  const companyName = __aaP3r2TakeText(snapshot, ['companyName', 'company_name', 'businessName', 'business_name', 'name']);
  const segment = __aaP3r2TakeText(snapshot, ['segment', 'industry', 'businessSegment', 'business_segment', 'niche']);
  const targetAudience = __aaP3r2TakeText(snapshot, ['targetAudience', 'target_audience', 'idealCustomer', 'ideal_customer', 'customerProfile', 'customer_profile']);
  const businessSummary = __aaP3r2TakeText(snapshot, ['businessSummary', 'business_summary', 'companyDescription', 'company_description', 'about', 'description']);
  const tone = __aaP3r2TakeText(snapshot, ['toneOfVoice', 'tone_of_voice', 'tone', 'voice', 'communicationStyle', 'communication_style']);
  const cta = __aaP3r2TakeText(snapshot, ['cta', 'ctaPrimary', 'cta_primary', 'primaryCallToAction', 'primary_call_to_action']);
  const location = __aaP3r2TakeText(snapshot, ['serviceArea', 'service_area', 'location', 'coverageArea', 'coverage_area']);
  const hours = __aaP3r2TakeText(snapshot, ['businessHours', 'business_hours', 'hours', 'openingHours', 'opening_hours']);

  const services = __aaP3r2TakeList(snapshot, ['services', 'serviceList', 'service_list', 'products', 'offerings']);
  const differentiators = __aaP3r2TakeList(snapshot, ['differentials', 'differentiators', 'competitiveAdvantages', 'competitive_advantages', 'strengths']);
  const rules = __aaP3r2TakeList(snapshot, ['assistantRules', 'assistant_rules', 'rules', 'forbiddenClaims', 'forbidden_claims', 'restrictions']);
  const objections = __aaP3r2TakeList(snapshot, ['objections', 'commonObjections', 'common_objections']);
  const faqs = __aaP3r2TakeList(snapshot, ['faq', 'faqs', 'frequentlyAskedQuestions', 'frequently_asked_questions']);
  const goals = __aaP3r2TakeList(snapshot, ['goals', 'assistantGoals', 'assistant_goals', 'objectives']);
  const responseStyle = __aaP3r2TakeList(snapshot, ['responseStyle', 'response_style', 'formatRules', 'format_rules']);

  const sections = [];
  sections.push('[AUTOATENDE BUSINESS CONTEXT]');
  sections.push('Você está respondendo como um assistente comercial e operacional da empresa do cliente, com foco real em atendimento útil, qualificação e conversão sem prometer o que não foi configurado.');

  if (companyName || segment || businessSummary) {
    const identityParts = [];
    if (companyName) identityParts.push(`Empresa: ${companyName}.`);
    if (segment) identityParts.push(`Segmento: ${segment}.`);
    if (businessSummary) identityParts.push(`Resumo do negócio: ${businessSummary}.`);
    sections.push(identityParts.join(' '));
  }

  if (targetAudience) {
    sections.push(`Público prioritário: ${targetAudience}.`);
  }

  if (services.length) {
    sections.push('Ofertas principais:\n' + __aaP3r2BuildCompactBullets(services));
  }

  if (differentiators.length) {
    sections.push('Diferenciais competitivos:\n' + __aaP3r2BuildCompactBullets(differentiators));
  }

  if (goals.length) {
    sections.push('Objetivos prioritários da resposta:\n' + __aaP3r2BuildCompactBullets(goals));
  }

  if (objections.length) {
    sections.push('Objeções que você deve saber contornar com clareza e segurança:\n' + __aaP3r2BuildCompactBullets(objections));
  }

  if (faqs.length) {
    sections.push('Perguntas recorrentes que merecem resposta objetiva:\n' + __aaP3r2BuildCompactBullets(faqs));
  }

  if (location || hours) {
    const opsParts = [];
    if (location) opsParts.push(`Área/local de atuação: ${location}.`);
    if (hours) opsParts.push(`Horários ou janela operacional: ${hours}.`);
    sections.push(opsParts.join(' '));
  }

  if (tone || responseStyle.length) {
    const styleParts = [];
    if (tone) styleParts.push(`Tom de voz desejado: ${tone}.`);
    if (responseStyle.length) styleParts.push(`Estilo de resposta: ${responseStyle.join('; ')}.`);
    sections.push(styleParts.join(' '));
  }

  if (rules.length) {
    sections.push('Regras e limites obrigatórios:\n' + __aaP3r2BuildCompactBullets(rules));
  }

  if (cta) {
    sections.push(`CTA preferencial quando fizer sentido: ${cta}.`);
  }

  sections.push(
    [
      'Padrão de resposta obrigatório:',
      '- Responder com clareza comercial e linguagem natural.',
      '- Usar parágrafos curtos e leitura leve.',
      '- Quando natural, usar poucos emojis para humanizar, sem exagero.',
      '- Não soar robótico, não despejar bloco único de texto.',
      '- Não inventar preço, prazo, integração, regra ou funcionalidade não confirmada.',
      '- Quando faltar dado crítico, conduzir com pergunta útil em vez de assumir.',
      '- Sempre que fizer sentido, orientar o lead para próximo passo concreto.'
    ].join('\n')
  );

  const finalText = __aaP3r2NormalizeText(sections.join('\n\n'));
  return finalText.length >= 80 ? finalText : '';
}

function __aaP3r2MergeSystemText(existing, businessContext) {
  const base = __aaP3r2NormalizeText(existing);
  const ctx = __aaP3r2NormalizeText(businessContext);
  if (!ctx) return existing;
  if (base.includes('[AUTOATENDE BUSINESS CONTEXT]')) return existing;
  if (!base) return ctx;
  return `${ctx}\n\n${base}`;
}

function __aaP3r2AugmentMessages(messages, businessContext) {
  if (!Array.isArray(messages) || !businessContext) return messages;

  const nextMessages = messages.map((message) => {
    if (!__aaP3r2IsPlainObject(message)) return message;
    return { ...message };
  });

  if (!nextMessages.length) {
    return [{ role: 'system', content: businessContext }];
  }

  const first = nextMessages[0];
  if (__aaP3r2IsPlainObject(first) && String(first.role || '').toLowerCase() === 'system') {
    first.content = __aaP3r2MergeSystemText(first.content, businessContext);
    return nextMessages;
  }

  nextMessages.unshift({ role: 'system', content: businessContext });
  return nextMessages;
}

function __aaP3r2EnrichArgObject(arg, businessContext) {
  if (!__aaP3r2IsPlainObject(arg) || !businessContext) return arg;

  const cloned = { ...arg };

  const systemKeys = [
    'systemPrompt',
    'system_prompt',
    'assistantInstructions',
    'assistant_instructions',
    'instructions',
    'contextPrompt',
    'context_prompt',
    'businessContext',
    'business_context'
  ];

  for (const key of systemKeys) {
    if (typeof cloned[key] === 'string' || cloned[key] === undefined || cloned[key] === null) {
      cloned[key] = __aaP3r2MergeSystemText(cloned[key], businessContext);
    }
  }

  if (Array.isArray(cloned.messages)) {
    cloned.messages = __aaP3r2AugmentMessages(cloned.messages, businessContext);
  }

  if (__aaP3r2IsPlainObject(cloned.context)) {
    cloned.context = {
      ...cloned.context,
      assistantBusinessContext: businessContext,
    };
  }

  if (!cloned.assistantBusinessContext) {
    cloned.assistantBusinessContext = businessContext;
  }

  return cloned;
}

function __aaP3r2EnrichArgs(args, businessContext) {
  if (!businessContext || !Array.isArray(args)) return args;
  return args.map((arg) => {
    if (__aaP3r2IsPlainObject(arg)) return __aaP3r2EnrichArgObject(arg, businessContext);
    if (Array.isArray(arg) && arg.every((item) => __aaP3r2IsPlainObject(item) && ('role' in item || 'content' in item))) {
      return __aaP3r2AugmentMessages(arg, businessContext);
    }
    return arg;
  });
}

function __aaP3r2LogContextApplied(label, snapshot, businessContext) {
  try {
    if (String(process.env.OPENAI_LOG_PIPELINE || '').toLowerCase() !== 'true') return;
    const companyName = __aaP3r2TakeText(snapshot || {}, ['companyName', 'company_name', 'businessName', 'business_name', 'name']);
    const segment = __aaP3r2TakeText(snapshot || {}, ['segment', 'industry', 'businessSegment', 'business_segment']);
    console.info('[AI_PIPELINE] p3_r2_business_context_applied', JSON.stringify({
      fn: label || 'unknown',
      companyName: companyName || null,
      segment: segment || null,
      contextLength: businessContext ? String(businessContext).length : 0,
    }));
  } catch (_) {}
}

function __aaP3r2WrapExportedFunction(fn, label) {
  if (typeof fn !== 'function') return fn;
  if (fn.__aaP3r2Wrapped) return fn;

  const wrapped = async function __aaP3r2WrappedFunction(...args) {
    const snapshot = __aaP3r2FindSnapshot(args);
    const businessContext = __aaP3r2BuildBusinessContext(snapshot);
    const enrichedArgs = businessContext ? __aaP3r2EnrichArgs(args, businessContext) : args;

    if (businessContext) {
      __aaP3r2LogContextApplied(label || fn.name || 'unknown', snapshot, businessContext);
    }

    const result = await fn.apply(this, enrichedArgs);

    if (__aaP3r2IsPlainObject(result) && businessContext) {
      return {
        ...result,
        __aaP3r2BusinessContextApplied: true,
      };
    }

    return result;
  };

  try {
    Object.defineProperty(wrapped, 'name', {
      value: fn.name || label || 'aaP3r2WrappedFunction',
      configurable: true,
    });
  } catch (_) {}

  wrapped.__aaP3r2Wrapped = true;
  wrapped.__aaP3r2Original = fn;
  return wrapped;
}

function __aaP3r2PatchExportsObject(exportsObj) {
  if (!exportsObj || typeof exportsObj !== 'object') return exportsObj;

  const next = exportsObj;
  const keys = Object.keys(next);
  let wrappedCount = 0;

  for (const key of keys) {
    if (typeof next[key] !== 'function') continue;
    if (!/(response|reply|message|completion|generate|chat|assistant|preview|ask)/i.test(key)) continue;
    next[key] = __aaP3r2WrapExportedFunction(next[key], key);
    wrappedCount += 1;
  }

  if (wrappedCount === 0) {
    for (const key of keys) {
      if (typeof next[key] !== 'function') continue;
      next[key] = __aaP3r2WrapExportedFunction(next[key], key);
    }
  }

  next.__aaP3r2BuildBusinessContext = __aaP3r2BuildBusinessContext;
  next.__aaP3r2FindSnapshot = __aaP3r2FindSnapshot;
  return next;
}

if (typeof module.exports === 'function') {
  module.exports = __aaP3r2WrapExportedFunction(module.exports, 'defaultExport');
  module.exports.__aaP3r2BuildBusinessContext = __aaP3r2BuildBusinessContext;
  module.exports.__aaP3r2FindSnapshot = __aaP3r2FindSnapshot;
} else if (module.exports && typeof module.exports === 'object') {
  module.exports = __aaP3r2PatchExportsObject(module.exports);
}


/* __AUTOATENDE_P3_R3_COMMERCIAL_RESPONSE_COMPOSER__ */
function __aaP3r3NormalizeText(raw) {
  if (raw == null) return '';
  let text = String(raw)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return text;
}

function __aaP3r3LooksTooShort(text) {
  return !text || text.length < 140;
}

function __aaP3r3HasRichFormatting(text) {
  return /(?:\n•\s|\*Planos atuais:\*|📌|👋|🙂)/u.test(text || '');
}

function __aaP3r3SplitSentences(text) {
  if (!text) return [];
  return String(text)
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú0-9*])/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function __aaP3r3CompactParagraphs(text) {
  const blocks = String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const result = [];

  for (const block of blocks) {
    if (!block) continue;

    if (/^\*Planos atuais:\*/u.test(block) || /^📌/u.test(block)) {
      result.push(block);
      continue;
    }

    const sentences = __aaP3r3SplitSentences(block);
    if (sentences.length <= 2) {
      result.push(block);
      continue;
    }

    for (let i = 0; i < sentences.length; i += 2) {
      result.push(sentences.slice(i, i + 2).join(' ').trim());
    }
  }

  return result.filter(Boolean);
}

function __aaP3r3ExtractPlanLines(text) {
  const normalized = String(text || '');
  const planRegex = /(Essencial|Profissional|Business)\s*,?\s*por\s*(R\$\s?[\d.,]+\/mês)\s*,?\s*para\s*(?:até\s*)?(\d+)\s*agentes?([^.\n]*)(?:\.)?/giu;
  const planLines = [];
  const consumed = [];
  let match;

  while ((match = planRegex.exec(normalized)) !== null) {
    const plan = (match[1] || '').trim();
    const price = (match[2] || '').replace(/\s+/g, ' ').trim();
    const agents = (match[3] || '').trim();
    const tail = (match[4] || '').replace(/\s+/g, ' ').trim();

    let details = `${agents} agente${agents === '1' ? '' : 's'}`;

    const marketingMatch = tail.match(/([\d.,]+)\s*(?:templates?\s+de\s+)?marketing/iu);
    const utilityMatch =
      tail.match(/([\d.,]+)\s*(?:de\s*)?utility\/authentication/iu) ||
      tail.match(/([\d.,]+)\s*(?:de\s*)?utilit(?:y|ário|arios|ários)/iu);

    const marketing = marketingMatch ? marketingMatch[1] : '';
    const utility = utilityMatch ? utilityMatch[1] : '';

    if (marketing || utility) {
      details += ` | ${marketing || '—'} marketing + ${utility || '—'} utility/authentication`;
    } else if (tail) {
      details += ` | ${tail.replace(/^,\s*/, '').trim()}`;
    }

    planLines.push(`• *${plan}* — ${price} | ${details}`);
    consumed.push(match[0]);
  }

  return { planLines, consumed };
}

function __aaP3r3RemoveConsumedChunks(text, consumedChunks) {
  let next = String(text || '');
  for (const chunk of consumedChunks || []) {
    if (!chunk) continue;
    next = next.replace(chunk, ' ');
  }

  next = next
    .replace(/\s+\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return next;
}

function __aaP3r3EnsureGreeting(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return trimmed;

  if (/^(olá|oi|opa|claro|perfeito|sem problema|com certeza)/iu.test(trimmed)) {
    return trimmed;
  }

  return `Claro! 👋\n\n${trimmed}`;
}

function __aaP3r3EnsureImportantPrefix(block) {
  const text = String(block || '').trim();
  if (!text) return text;

  if (/^📌/u.test(text)) return text;

  if (
    /(?:conversas?.*ilimitad|franquia.*template|janela padrão|mensagens? enviadas fora da janela)/iu.test(text)
  ) {
    return `📌 Importante: ${text.replace(/^Importante(?: destacar)? que[: ]*/iu, '').trim()}`;
  }

  return text.replace(/^Importante(?: destacar)? que[: ]*/iu, '📌 Importante: ');
}

function __aaP3r3NeedsCommercialCTA(text) {
  const value = String(text || '');
  if (!value) return false;
  if (/[?]\s*$/u.test(value)) return false;
  if (/Se quiser[, ]/iu.test(value) || /me diga.*cenário/iu.test(value)) return false;
  return /(whatsapp|atendimento|planos?|empresa|automação|leads?)/iu.test(value);
}

function __aaP3r3ComposeCommercialResponse(raw) {
  if (__aaAssistantCentralAuthorityEnabled() && !__aaAllowDeterministicCommercialEnhancers()) {
    return raw;
  }
  let text = __aaP3r3NormalizeText(raw);

  if (!text || __aaP3r3LooksTooShort(text)) {
    return text;
  }

  text = text
    .replace(/Sobre os planos[^:\n]*:/iu, '*Planos atuais:*')
    .replace(/Importante(?: destacar)? que[: ]*/iu, '📌 Importante: ')
    .replace(/\n\*Planos atuais:\*\n*/gu, '\n\n*Planos atuais:*\n');

  const { planLines, consumed } = __aaP3r3ExtractPlanLines(text);
  let baseText = __aaP3r3RemoveConsumedChunks(text, consumed);

  const paragraphs = __aaP3r3CompactParagraphs(baseText);
  const finalBlocks = [];

  for (const block of paragraphs) {
    if (!block) continue;

    if (/^\*Planos atuais:\*/u.test(block)) {
      continue;
    }

    if (/^📌/u.test(block) || /(?:conversas?.*ilimitad|franquia.*template|janela padrão)/iu.test(block)) {
      finalBlocks.push(__aaP3r3EnsureImportantPrefix(block));
      continue;
    }

    finalBlocks.push(block);
  }

  if (planLines.length > 0) {
    let inserted = false;
    const rebuilt = [];

    for (const block of finalBlocks) {
      rebuilt.push(block);

      if (!inserted && /(planos?|opções|valores|preço)/iu.test(block)) {
        rebuilt.push('*Planos atuais:*');
        rebuilt.push(planLines.join('\n'));
        inserted = true;
      }
    }

    if (!inserted) {
      rebuilt.push('*Planos atuais:*');
      rebuilt.push(planLines.join('\n'));
    }

    finalBlocks.length = 0;
    finalBlocks.push(...rebuilt.filter(Boolean));
  }

  let result = finalBlocks
    .map((block) => String(block || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  result = __aaP3r3EnsureGreeting(result);

  if (__aaP3r3NeedsCommercialCTA(result)) {
    result += '\n\nSe quiser, me diga um pouco do seu cenário e eu te indico o melhor caminho. 🙂';
  }

  if (__aaP3r3HasRichFormatting(result)) {
    result = result
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  return result;
}

function __aaP3r3ApplyToPayload(payload, depth = 0) {
  if (depth > 2) return payload;

  if (typeof payload === 'string') {
    return __aaP3r3ComposeCommercialResponse(payload);
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => __aaP3r3ApplyToPayload(item, depth + 1));
  }

  const clone = { ...payload };
  const directKeys = [
    'response',
    'answer',
    'text',
    'content',
    'message',
    'assistantResponse',
    'finalAnswer',
    'reply',
  ];

  for (const key of directKeys) {
    if (typeof clone[key] === 'string') {
      clone[key] = __aaP3r3ComposeCommercialResponse(clone[key]);
    }
  }

  for (const nestedKey of ['data', 'result', 'payload']) {
    if (clone[nestedKey] && typeof clone[nestedKey] === 'object') {
      clone[nestedKey] = __aaP3r3ApplyToPayload(clone[nestedKey], depth + 1);
    }
  }

  return clone;
}

function __aaP3r3WrapExportedFunction(fn, label) {
  if (typeof fn !== 'function') return fn;
  if (fn.__aaP3r3Wrapped) return fn;

  const wrapped = function (...args) {
    const result = fn.apply(this, args);

    if (result && typeof result.then === 'function') {
      return result.then((value) => __aaP3r3ApplyToPayload(value));
    }

    return __aaP3r3ApplyToPayload(result);
  };

  try {
    Object.defineProperty(wrapped, 'name', {
      value: fn.name || label || 'aaP3r3Wrapped',
      configurable: true,
    });
  } catch (_) {}

  wrapped.__aaP3r3Wrapped = true;
  wrapped.__aaP3r3Original = fn;
  return wrapped;
}

(function __aaP3r3PatchModuleExports() {
  const next = module.exports;
  if (!next) return;

  if (typeof next === 'function') {
    module.exports = __aaP3r3WrapExportedFunction(next, 'module.exports');
    module.exports.__aaP3r3ComposeCommercialResponse = __aaP3r3ComposeCommercialResponse;
    return;
  }

  if (typeof next === 'object') {
    for (const key of Object.keys(next)) {
      if (typeof next[key] === 'function') {
        next[key] = __aaP3r3WrapExportedFunction(next[key], key);
      }
    }

    next.__aaP3r3ComposeCommercialResponse = __aaP3r3ComposeCommercialResponse;
    next.__aaP3r3ApplyToPayload = __aaP3r3ApplyToPayload;
  }
})();


/* __AUTOATENDE_P3_R4_WHATSAPP_PRESENTATION_AND_PLAN_RECOMMENDER__ */
const __aaP3r4PlanCatalog = [
  {
    id: 'essencial',
    name: 'Essencial',
    price: 'R$249,90',
    agents: 1,
    marketing: 100,
    utility: 600,
  },
  {
    id: 'profissional',
    name: 'Profissional',
    price: 'R$449,90',
    agents: 4,
    marketing: 250,
    utility: 1500,
  },
  {
    id: 'business',
    name: 'Business',
    price: 'R$699,90',
    agents: 8,
    marketing: 500,
    utility: 3000,
  },
];

const __aaP3r4Addons = [
  { label: '200 marketing', price: 'R$119' },
  { label: '1.000 utility/authentication', price: 'R$99' },
];

function __aaP3r4NormalizeText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function __aaP3r4FormatPlanLine(plan) {
  if (!plan) return '';
  const agentLabel = plan.agents === 1 ? 'agente' : 'agentes';
  return `*${plan.name}* — ${plan.price}/mês · até ${plan.agents} ${agentLabel} · ${plan.marketing} marketing + ${plan.utility} utility/authentication`;
}

function __aaP3r4FormatAddons() {
  return __aaP3r4Addons
    .map((item) => `• ${item.label} por ${item.price}`)
    .join('\n');
}

function __aaP3r4ExtractQuestionNode(node, depth = 0) {
  if (!node || depth > 5) return '';

  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (!trimmed) return '';
    if (trimmed.length > 800) return '';
    if (/\?/.test(trimmed) || /plano|planos|whatsapp|empresa|conversa|atendimento|marketing|agente/i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = __aaP3r4ExtractQuestionNode(item, depth + 1);
      if (found) return found;
    }
    return '';
  }

  if (typeof node === 'object') {
    const priorityKeys = [
      'question',
      'prompt',
      'message',
      'text',
      'content',
      'userMessage',
      'lastUserMessage',
      'input',
      'query',
      'body',
    ];

    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const found = __aaP3r4ExtractQuestionNode(node[key], depth + 1);
        if (found) return found;
      }
    }

    for (const value of Object.values(node)) {
      const found = __aaP3r4ExtractQuestionNode(value, depth + 1);
      if (found) return found;
    }
  }

  return '';
}

function __aaP3r4ExtractQuestionFromArgs(args) {
  if (!Array.isArray(args)) return '';
  for (const arg of args) {
    const found = __aaP3r4ExtractQuestionNode(arg, 0);
    if (found) return found;
  }
  return '';
}

function __aaP3r4InferAgentNeed(question) {
  const text = String(question || '');
  const match = text.match(/([0-9]{1,2})\s*(pessoas|pessoa|atendentes?|agentes?|usuarios?|usuários?)/i);
  if (!match) return null;

  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  return count;
}

function __aaP3r4ChoosePlan(agentNeed) {
  if (!agentNeed) return null;
  for (const plan of __aaP3r4PlanCatalog) {
    if (agentNeed <= plan.agents) return plan;
  }
  return null;
}

function __aaP3r4IsLimitQuestion(question) {
  const text = String(question || '');
  return /conversas?\s+s[aã]o\s+limitadas|conversas?.*limitad|franquia.*conversas|limite.*conversas/i.test(text);
}

function __aaP3r4IsPlanRecommendationQuestion(question) {
  const text = String(question || '');
  return /qual\s+plano|plano\s+voc[eê]\s+indica|opera[cç][aã]o\s+com|time\s+com|equipe\s+com/i.test(text);
}

function __aaP3r4IsPlanCatalogQuestion(question) {
  const text = String(question || '');
  return /planos?|pre[cç]os?|valores?|quanto\s+custa|custam|mensalidade|mensalidades/i.test(text);
}

function __aaP3r4IsHowItWorksQuestion(question) {
  const text = String(question || '');
  return /como\s+funciona|como\s+voc[eê]s\s+ajudam|serve\s+para\s+minha\s+empresa|vende\s+pelo\s+whatsapp|ajuda\s+minha\s+empresa|como\s+ajuda/i.test(text);
}

function __aaP3r4ComposeLimitAnswer() {
  return __aaP3r4NormalizeText(
`✅ *Não.* As conversas de atendimento são ilimitadas em todos os planos.

💬 A franquia mensal vale para *templates da Meta* usados em mensagens específicas fora da janela padrão de atendimento.

📦 Hoje funciona assim:
${__aaP3r4PlanCatalog.map(__aaP3r4FormatPlanLine).join('\n')}

➕ Add-ons padronizados:
${__aaP3r4FormatAddons()}

Se quiser, posso te indicar qual plano faz mais sentido para a sua operação.`
  );
}

function __aaP3r4ComposePlanCatalogAnswer() {
  return __aaP3r4NormalizeText(
`💳 Hoje a AutoAtende AI trabalha com 3 planos mensais:

${__aaP3r4PlanCatalog.map(__aaP3r4FormatPlanLine).join('\n')}

💬 As conversas de atendimento são *ilimitadas* em todos os planos.
A franquia mensal vale para os *templates da Meta*.

➕ Add-ons padronizados:
${__aaP3r4FormatAddons()}

Se quiser, eu também posso te dizer qual desses planos encaixa melhor no teu cenário.`
  );
}

function __aaP3r4ComposePlanRecommendation(agentNeed) {
  const plan = __aaP3r4ChoosePlan(agentNeed);

  if (!plan) {
    return __aaP3r4NormalizeText(
`✅ Para uma operação com *${agentNeed} pessoas*, o ideal é tratar como cenário acima do plano padrão.

👥 Hoje a grade pública cobre:
${__aaP3r4PlanCatalog.map(__aaP3r4FormatPlanLine).join('\n')}

Se quiser, posso te orientar qual estrutura faz mais sentido para esse volume de operação.`
    );
  }

  const nextPlan = __aaP3r4PlanCatalog.find((item) => item.agents > plan.agents) || null;

  return __aaP3r4NormalizeText(
`✅ Para uma operação com *${agentNeed} ${agentNeed === 1 ? 'pessoa' : 'pessoas'}*, o plano mais indicado hoje é o *${plan.name}*.

👥 Ele atende até *${plan.agents} ${plan.agents === 1 ? 'agente' : 'agentes'}*.
💬 As conversas de atendimento são *ilimitadas*.
📨 A franquia mensal fica em *${plan.marketing} marketing + ${plan.utility} utility/authentication*.
💳 Valor do plano: *${plan.price}/mês*.

${nextPlan ? `📈 Se você já espera crescer rápido, o próximo degrau natural é o *${nextPlan.name}*.\n` : ''}➕ Add-ons padronizados:
${__aaP3r4FormatAddons()}

Se quiser, eu posso te dizer também se vale começar nesse plano ou já subir um nível pensando em crescimento.`
  );
}

function __aaP3r4ComposeHowItWorksAnswer(question) {
  const includePlans = /plano|planos|custa|custam|valor|valores/i.test(String(question || ''));

  const base = __aaP3r4NormalizeText(
`✨ A AutoAtende AI organiza e automatiza o atendimento da sua empresa no WhatsApp para responder com mais rapidez, padronização e contexto.

🤖 O bot atende dúvidas frequentes, qualifica leads e mantém a conversa organizada sem perder o histórico.

👥 Quando a conversa exige negociação, decisão comercial ou atendimento específico, um humano pode assumir sem perder o contexto anterior.

📈 Para empresas que vendem pelo WhatsApp, isso ajuda a ganhar velocidade no atendimento e melhora o controle da operação.`
  );

  if (!includePlans) {
    return `${base}\n\nSe quiser, posso te mostrar como isso funciona na prática no teu tipo de operação.`;
  }

  return __aaP3r4NormalizeText(
`${base}

💳 Sobre os planos:
${__aaP3r4PlanCatalog.map(__aaP3r4FormatPlanLine).join('\n')}

Se quiser, posso te indicar qual plano faz mais sentido para a tua empresa.`
  );
}

function __aaP3r4ComposeSmartResponse(raw, question) {
  const normalizedRaw = __aaP3r4NormalizeText(raw);
  const normalizedQuestion = __aaP3r4NormalizeText(question);

  if (!normalizedRaw) return raw;
  if (!normalizedQuestion) return normalizedRaw;

  const agentNeed = __aaP3r4InferAgentNeed(normalizedQuestion);

  if (__aaP3r4IsLimitQuestion(normalizedQuestion)) {
    return __aaP3r4ComposeLimitAnswer();
  }

  if (agentNeed && __aaP3r4IsPlanRecommendationQuestion(normalizedQuestion)) {
    return __aaP3r4ComposePlanRecommendation(agentNeed);
  }

  if (__aaP3r4IsPlanCatalogQuestion(normalizedQuestion) && !__aaP3r4IsHowItWorksQuestion(normalizedQuestion)) {
    return __aaP3r4ComposePlanCatalogAnswer();
  }

  if (__aaP3r4IsHowItWorksQuestion(normalizedQuestion)) {
    return __aaP3r4ComposeHowItWorksAnswer(normalizedQuestion);
  }

  return normalizedRaw;
}

function __aaP3r4ApplyComposer(payload, question) {
  if (!question) return payload;

  if (typeof payload === 'string') {
    return __aaP3r4ComposeSmartResponse(payload, question);
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const clone = Array.isArray(payload) ? payload.slice() : { ...payload };
  const candidateKeys = ['response', 'text', 'message', 'content', 'answer', 'body'];

  for (const key of candidateKeys) {
    if (typeof clone[key] === 'string') {
      clone[key] = __aaP3r4ComposeSmartResponse(clone[key], question);
    }
  }

  return clone;
}

(function __aaP3r4AttachComposer() {
  if (__aaAssistantCentralAuthorityEnabled() && !__aaAllowDeterministicCommercialEnhancers()) {
    return;
  }
  try {
    if (typeof module === 'undefined' || !module.exports) return;

    const next = module.exports;
    if (next.__aaP3r4Wrapped) return;

    for (const key of Object.keys(next)) {
      if (typeof next[key] !== 'function') continue;
      if (next[key] && next[key].__aaP3r4Wrapped) continue;

      const original = next[key];

      const wrapped = function (...args) {
        const question = __aaP3r4ExtractQuestionFromArgs(args);

        const result = original.apply(this, args);

        if (result && typeof result.then === 'function') {
          return result.then((resolved) => __aaP3r4ApplyComposer(resolved, question));
        }

        return __aaP3r4ApplyComposer(result, question);
      };

      wrapped.__aaP3r4Wrapped = true;
      wrapped.__aaP3r4Original = original;
      next[key] = wrapped;
    }

    next.__aaP3r4Wrapped = true;
    next.__aaP3r4ComposeSmartResponse = __aaP3r4ComposeSmartResponse;
    next.__aaP3r4ApplyComposer = __aaP3r4ApplyComposer;
  } catch (error) {
    console.error('[AUTOATENDE P3-R4] attach error', error);
  }
})();

/* __AUTOATENDE_P3_R4B_DETERMINISTIC_COMMERCIAL_OVERRIDE_FINAL__ */
const __aaP3r4bCatalog = [
  {
    id: 'essencial',
    name: 'Essencial',
    price: 'R$249,90',
    agents: 1,
    marketing: 100,
    utility: 600,
  },
  {
    id: 'profissional',
    name: 'Profissional',
    price: 'R$449,90',
    agents: 4,
    marketing: 250,
    utility: 1500,
  },
  {
    id: 'business',
    name: 'Business',
    price: 'R$699,90',
    agents: 8,
    marketing: 500,
    utility: 3000,
  },
];

const __aaP3r4bAddons = [
  { label: '200 marketing', price: 'R$119' },
  { label: '1.000 utility/authentication', price: 'R$99' },
];

function __aaP3r4bNorm(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function __aaP3r4bExtractQuestionDeep(node, depth = 0) {
  if (!node || depth > 6) return '';

  if (typeof node === 'string') {
    const text = node.trim();
    if (!text) return '';
    if (text.length > 1200) return '';
    if (/[?]/.test(text) || /plano|planos|empresa|whatsapp|conversa|conversas|atendimento|marketing|agente|opera[cç][aã]o|ajudam|ajuda|funciona/i.test(text)) {
      return text;
    }
    return '';
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = __aaP3r4bExtractQuestionDeep(item, depth + 1);
      if (found) return found;
    }
    return '';
  }

  if (typeof node === 'object') {
    const priorityKeys = [
      'question',
      'prompt',
      'message',
      'text',
      'content',
      'userMessage',
      'lastUserMessage',
      'input',
      'query',
      'body',
      'previewMessage',
      'originalMessage',
    ];

    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const found = __aaP3r4bExtractQuestionDeep(node[key], depth + 1);
        if (found) return found;
      }
    }

    for (const value of Object.values(node)) {
      const found = __aaP3r4bExtractQuestionDeep(value, depth + 1);
      if (found) return found;
    }
  }

  return '';
}

function __aaP3r4bExtractQuestion(args, payload) {
  const fromArgs = __aaP3r4bExtractQuestionDeep(args, 0);
  if (fromArgs) return fromArgs;

  const fromPayload = __aaP3r4bExtractQuestionDeep(payload, 0);
  if (fromPayload) return fromPayload;

  return '';
}

function __aaP3r4bInferAgentNeed(question) {
  const text = String(question || '');
  const match = text.match(/([0-9]{1,2})\s*(pessoas|pessoa|agentes|agente|atendentes|atendente|usuarios|usuários|user|users)/i);
  if (!match) return null;

  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  return count;
}

function __aaP3r4bChoosePlan(agentNeed) {
  if (!agentNeed) return null;
  for (const plan of __aaP3r4bCatalog) {
    if (agentNeed <= plan.agents) return plan;
  }
  return null;
}

function __aaP3r4bPlanLine(plan) {
  if (!plan) return '';
  const agentLabel = plan.agents === 1 ? 'agente' : 'agentes';
  return `• *${plan.name}* — ${plan.price}/mês · até ${plan.agents} ${agentLabel} · ${plan.marketing} marketing + ${plan.utility} utility/authentication`;
}

function __aaP3r4bAddonLines() {
  return __aaP3r4bAddons.map((item) => `• ${item.label} por ${item.price}`).join('\n');
}

function __aaP3r4bIsLimitQuestion(question) {
  const text = String(question || '');
  return /conversas?\s+s[aã]o\s+limitadas|conversas?.*limitad|limite.*conversas|franquia.*conversas/i.test(text);
}

function __aaP3r4bIsPlanRecommendationQuestion(question) {
  const text = String(question || '');
  return /qual\s+plano|plano\s+voc[eê]\s+indica|opera[cç][aã]o\s+com|time\s+com|equipe\s+com|cen[aá]rio\s+com/i.test(text);
}

function __aaP3r4bIsPlanCatalogQuestion(question) {
  const text = String(question || '');
  return /planos?|pre[cç]os?|valores?|quanto\s+custa|custam|mensalidade|mensalidades/i.test(text);
}

function __aaP3r4bIsHowItWorksQuestion(question) {
  const text = String(question || '');
  return /como\s+funciona|como\s+voc[eê]s\s+ajudam|serve\s+para\s+minha\s+empresa|vende\s+pelo\s+whatsapp|ajuda\s+minha\s+empresa|como\s+ajuda/i.test(text);
}

function __aaP3r4bReplyLimit() {
  return __aaP3r4bNorm(
`*Não.* As conversas de atendimento são ilimitadas em todos os planos.

A franquia mensal vale para *templates da Meta* usados em mensagens específicas fora da janela padrão de atendimento.

Hoje funciona assim:
${__aaP3r4bCatalog.map(__aaP3r4bPlanLine).join('\n')}

Add-ons padronizados:
${__aaP3r4bAddonLines()}

Se quiser, eu posso te indicar qual plano faz mais sentido para a tua operação.`
  );
}

function __aaP3r4bReplyPlanCatalog() {
  return __aaP3r4bNorm(
`Hoje a AutoAtende AI trabalha com 3 planos mensais:

${__aaP3r4bCatalog.map(__aaP3r4bPlanLine).join('\n')}

As conversas de atendimento são *ilimitadas* em todos os planos.
A franquia mensal vale para os *templates da Meta*.

Add-ons padronizados:
${__aaP3r4bAddonLines()}

Se quiser, eu também posso te dizer qual deles encaixa melhor no teu cenário.`
  );
}

function __aaP3r4bReplyPlanRecommendation(agentNeed) {
  const plan = __aaP3r4bChoosePlan(agentNeed);

  if (!plan) {
    return __aaP3r4bNorm(
`Para uma operação com *${agentNeed} pessoas*, eu trataria como cenário acima da grade padrão.

Hoje a grade pública é:
${__aaP3r4bCatalog.map(__aaP3r4bPlanLine).join('\n')}

Se quiser, eu posso te orientar qual estrutura faz mais sentido para esse volume.`
    );
  }

  const nextPlan = __aaP3r4bCatalog.find((item) => item.agents > plan.agents) || null;

  return __aaP3r4bNorm(
`*Para uma operação com ${agentNeed} pessoas, eu indicaria o ${plan.name}.*

Ele atende até *${plan.agents} ${plan.agents === 1 ? 'agente' : 'agentes'}* e custa *${plan.price}/mês*.

Nesse plano, você tem:
• conversas de atendimento ilimitadas
• ${plan.marketing} templates de marketing
• ${plan.utility} utility/authentication

${nextPlan ? `Se você já espera crescer rápido, o próximo degrau natural é o *${nextPlan.name}*.\n\n` : ''}Add-ons padronizados:
${__aaP3r4bAddonLines()}

Se quiser, eu também posso te dizer se vale começar nesse plano ou já subir um nível pensando em crescimento.`
  );
}

function __aaP3r4bReplyHowItWorks(question) {
  const includePlans = /plano|planos|valor|valores|pre[cç]o|pre[cç]os|custa|custam/i.test(String(question || ''));

  const base = __aaP3r4bNorm(
`A AutoAtende AI ajuda sua empresa a atender e vender pelo WhatsApp com mais velocidade e organização.

Ela pode:
• responder dúvidas frequentes
• qualificar leads
• manter o contexto da conversa
• transferir para humano quando necessário

Assim, sua equipe ganha agilidade sem perder o toque humano.`
  );

  if (!includePlans) {
    return `${base}\n\nSe quiser, eu posso te mostrar como isso funciona na prática no teu tipo de operação.`;
  }

  return __aaP3r4bNorm(
`${base}

Hoje temos 3 planos:
${__aaP3r4bCatalog.map(__aaP3r4bPlanLine).join('\n')}

Se quiser, eu posso te indicar qual plano faz mais sentido para a tua empresa.`
  );
}

function __aaP3r4bCompose(question, currentText) {
  const q = __aaP3r4bNorm(question);
  const current = __aaP3r4bNorm(currentText);

  if (!q) return current || currentText;

  const agentNeed = __aaP3r4bInferAgentNeed(q);

  if (__aaP3r4bIsLimitQuestion(q)) {
    return __aaP3r4bReplyLimit();
  }

  if (agentNeed && __aaP3r4bIsPlanRecommendationQuestion(q)) {
    return __aaP3r4bReplyPlanRecommendation(agentNeed);
  }

  if (__aaP3r4bIsPlanCatalogQuestion(q) && !__aaP3r4bIsHowItWorksQuestion(q)) {
    return __aaP3r4bReplyPlanCatalog();
  }

  if (__aaP3r4bIsHowItWorksQuestion(q)) {
    return __aaP3r4bReplyHowItWorks(q);
  }

  return current || currentText;
}

function __aaP3r4bApply(payload, question) {
  if (!question) return payload;

  if (typeof payload === 'string') {
    return __aaP3r4bCompose(question, payload);
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const clone = Array.isArray(payload) ? payload.slice() : { ...payload };
  const candidateKeys = ['response', 'text', 'message', 'content', 'answer', 'body'];

  for (const key of candidateKeys) {
    if (typeof clone[key] === 'string') {
      clone[key] = __aaP3r4bCompose(question, clone[key]);
    }
  }

  return clone;
}

(function __aaP3r4bAttachFinalOverride() {
  if (__aaAssistantCentralAuthorityEnabled() && !__aaAllowDeterministicCommercialEnhancers()) {
    return;
  }
  try {
    if (typeof module === 'undefined' || !module.exports) return;

    const next = module.exports;
    if (next.__aaP3r4bWrapped) return;

    for (const key of Object.keys(next)) {
      if (typeof next[key] !== 'function') continue;
      if (next[key] && next[key].__aaP3r4bWrapped) continue;

      const original = next[key];

      const wrapped = function (...args) {
        const result = original.apply(this, args);

        if (result && typeof result.then === 'function') {
          return result.then((resolved) => {
            const question = __aaP3r4bExtractQuestion(args, resolved);
            return __aaP3r4bApply(resolved, question);
          });
        }

        const question = __aaP3r4bExtractQuestion(args, result);
        return __aaP3r4bApply(result, question);
      };

      wrapped.__aaP3r4bWrapped = true;
      wrapped.__aaP3r4bOriginal = original;
      next[key] = wrapped;
    }

    next.__aaP3r4bWrapped = true;
    next.__aaP3r4bCompose = __aaP3r4bCompose;
    next.__aaP3r4bApply = __aaP3r4bApply;
  } catch (error) {
    console.error('[AUTOATENDE P3-R4B] attach error', error);
  }
})();
