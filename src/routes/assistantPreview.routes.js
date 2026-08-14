// __AUTOATENDE_C6B_R1_ADMIN_SURFACE_HARDENING__
const express = require("express");
const router = express.Router();



/* __AUTOATENDE_C3FIX3_BIND_COMPANY_AFTER_AUTH__ */
/* __AUTOATENDE_ASSISTANT_CENTRAL_TENANT_AUTHORITY_V20_B1_R5__ */
function bindResolvedCompanyIdAfterAuth(req, res, next) {
  const normalizeCompanyId = (value) =>
    String(value || "").trim();

  const authenticatedCompanyId =
    normalizeCompanyId(
      req.company?.id ||
      req.companyId ||
      req.userProfile?.company_id ||
      req.user?.company_id ||
      req.user?.companyId
    );

  if (!authenticatedCompanyId) {
    return res.status(403).json({
      error: "AUTHENTICATED_COMPANY_REQUIRED",
      message:
        "Não foi possível resolver a empresa vinculada ao usuário autenticado."
    });
  }

  const requestedCompanyIds = [
    ...(Array.isArray(req.__aaAssistantRequestedCompanyIds)
      ? req.__aaAssistantRequestedCompanyIds
      : []),
    req.params?.companyId,
    req.params?.company_id,
    req.query?.companyId,
    req.query?.company_id,
    req.body?.companyId,
    req.body?.company_id,
    req.body?.data?.companyId,
    req.body?.data?.company_id,
    req.headers?.["x-company-id"]
  ]
    .map(normalizeCompanyId)
    .filter(Boolean);

  const mismatchedCompanyId =
    requestedCompanyIds.find(
      (companyId) =>
        companyId !== authenticatedCompanyId
    );

  if (mismatchedCompanyId) {
    return res.status(403).json({
      error: "CROSS_TENANT_COMPANY_ID_REJECTED",
      message:
        "A empresa informada não corresponde à empresa do usuário autenticado."
    });
  }

  req.companyId =
    authenticatedCompanyId;

  req.company_id =
    authenticatedCompanyId;

  req.resolvedCompanyId =
    authenticatedCompanyId;

  req.resolved_company_id =
    authenticatedCompanyId;

  req.query = {
    ...(req.query || {}),
    companyId: authenticatedCompanyId,
    company_id: authenticatedCompanyId
  };

  if (
    req.body &&
    typeof req.body === "object" &&
    !Array.isArray(req.body)
  ) {
    req.body.companyId =
      authenticatedCompanyId;

    req.body.company_id =
      authenticatedCompanyId;

    if (
      req.body.data &&
      typeof req.body.data === "object" &&
      !Array.isArray(req.body.data)
    ) {
      req.body.data.companyId =
        authenticatedCompanyId;

      req.body.data.company_id =
        authenticatedCompanyId;
    }
  }

  if (
    req.user &&
    typeof req.user === "object"
  ) {
    req.user.companyId =
      authenticatedCompanyId;

    req.user.company_id =
      authenticatedCompanyId;
  }

  if (
    req.auth &&
    typeof req.auth === "object"
  ) {
    req.auth.companyId =
      authenticatedCompanyId;

    req.auth.company_id =
      authenticatedCompanyId;
  }

  return next();
}

/* __AUTOATENDE_C3FIX2_PREVIEW_ROUTE_COMPANY_MIDDLEWARE__ */
/* __AUTOATENDE_ASSISTANT_CENTRAL_TENANT_AUTHORITY_V20_B1_R5__ */
router.use((req, _res, next) => {
  const normalizeCompanyId = (value) =>
    String(value || "").trim();

  req.__aaAssistantRequestedCompanyIds = [
    req.params?.companyId,
    req.params?.company_id,
    req.query?.companyId,
    req.query?.company_id,
    req.body?.companyId,
    req.body?.company_id,
    req.body?.data?.companyId,
    req.body?.data?.company_id,
    req.headers?.["x-company-id"]
  ]
    .map(normalizeCompanyId)
    .filter(Boolean);

  next();
});

const authMiddleware = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const { getCompanyCommercialProfile } = require("../services/companyCommercialProfile.service");
const aiService = require("../services/ai.service");
const runtimeAuthorityService = require('../services/whatsappMessageHandler.js');
const assistantCentralPreviewService = require('../services/assistantCentralPreview.service');


const assistantCentralPreviewAuthorityService = require('../services/assistantCentralPreview.service');
/* __AUTOATENDE_C3FIX2_PREVIEW_ROUTE_COMPANY_RESOLVER__ */
const AUTOATENDE_DEFAULT_COMPANY_ID = String(process.env.AUTOATENDE_DEFAULT_COMPANY_ID || "").trim();

function pickCompanyIdDeep(obj) {
  if (!obj || typeof obj !== "object") return "";
  const directKeys = [
    "company_id",
    "companyId",
    "selected_company_id",
    "selectedCompanyId",
    "current_company_id",
    "currentCompanyId",
  ];

  for (const key of directKeys) {
    if (obj[key] && typeof obj[key] === "string") return obj[key];
  }

  const nestedCandidates = [
    obj.user,
    obj.profile,
    obj.session,
    obj.data,
    obj.user_metadata,
    obj.app_metadata,
  ];

  for (const candidate of nestedCandidates) {
    const found = pickCompanyIdDeep(candidate);
    if (found) return found;
  }

  return "";
}

function resolveRouteCompanyId(req = {}) {
  const directCandidates = [
    req.query?.company_id,
    req.query?.companyId,
    req.body?.company_id,
    req.body?.companyId,
    req.params?.company_id,
    req.params?.companyId,
    req.resolved_company_id,
    req.company_id,
    req.companyId,
  ].filter(Boolean);

  for (const value of directCandidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const deepCandidates = [
    req.user,
    req.auth,
    req.session,
    req.profile,
  ];

  for (const candidate of deepCandidates) {
    const found = pickCompanyIdDeep(candidate);
    if (found) return found;
  }

  /* __AUTOATENDE_ASSISTANT_CENTRAL_TENANT_AUTHORITY_V20_B1_R5__ authenticated requests do not fall back to a default company */

  return "";
}

/* __AUTOATENDE_C1E1_ASSISTANT_PREVIEW_ROUTES__ */

function extractUserCompanyId(req) {
  return (
    req?.user?.company_id ||
    req?.user?.companyId ||
    req?.user?.client?.company_id ||
    req?.profile?.company_id ||
    null
  );
}

function ensureCompanyScope(req, res, next) {
  const userCompanyId = extractUserCompanyId(req);
  if (!userCompanyId) {
    return res.status(400).json({
      success: false,
      error: "COMPANY_ID_REQUIRED"
    });
  }
  req.resolvedCompanyId = userCompanyId;
  return next();
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sourceToLabel(source) {
  if (!source) return "desconhecida";
  return source;
}

function buildSystemPrompt(profile = {}) {
  /* __AUTOATENDE_C16N_C12F_B1_WIRING_STRUCTURED_BEHAVIOR_PREVIEW_RUNTIME__ ROUTE_AUTHORITY */
  if (
    assistantCentralPreviewAuthorityService &&
    typeof assistantCentralPreviewAuthorityService.buildCommercialSnapshotWithStructuredBehavior === 'function' &&
    typeof assistantCentralPreviewAuthorityService.buildSystemPromptWithStructuredBehavior === 'function'
  ) {
    return assistantCentralPreviewAuthorityService.buildSystemPromptWithStructuredBehavior(
      assistantCentralPreviewAuthorityService.buildCommercialSnapshotWithStructuredBehavior(profile || {}),
      'snapshot',
      ''
    );
  }
  const services = Array.isArray(profile.services) ? profile.services.join(", ") : "";
  const forbidden = Array.isArray(profile.forbidden_topics) ? profile.forbidden_topics.join(", ") : "";
  const faq = Array.isArray(profile.faq_base) ? JSON.stringify(profile.faq_base) : "[]";

  return [
    `Você é o assistente comercial da empresa ${profile.company_name || "Empresa"}.`,
    `Contexto do negócio: ${profile.company_context || ""}`,
    `Serviços/produtos: ${services}`,
    `Público-alvo: ${profile.target_audience || ""}`,
    `Tom de voz: ${profile.tone || "profissional, claro e objetivo"}`,
    `Tópicos proibidos: ${forbidden}`,
    `FAQ base: ${faq}`,
    `Guidance adicional: ${profile.assistant_guidance || ""}`,
    "Responda em português do Brasil.",
    "Não use markdown, bullets nem títulos.",
    "Seja comercial, claro e útil.",
    "Se perguntarem sobre planos, respeite os planos oficiais já configurados pela empresa.",
  ].join("\n");
}

function buildDeterministicFallback(profile = {}, message = "") {
  const companyName = profile.company_name || "A empresa";
  const target = profile.target_audience || "empresas";
  const msg = normalizeText(message).toLowerCase();

  if (msg.includes("plano")) {
    return "Hoje a AutoAtende AI trabalha com três planos. Essencial: R$249,90 por mês para até 1 agente, com conversas ilimitadas e 100 templates de marketing + 600 templates utility/authentication por mês. Profissional: R$449,90 por mês para até 4 agentes, com conversas ilimitadas e 250 templates de marketing + 1.500 templates utility/authentication por mês. Business: R$699,90 por mês para até 8 agentes, com conversas ilimitadas e 500 templates de marketing + 3.000 templates utility/authentication por mês. Importante: as conversas de atendimento são ilimitadas; o que possui franquia mensal é apenas o envio de templates da Meta.";
  }

  if (msg.includes("humano")) {
    return `${companyName} pode alternar entre automação e atendimento humano. Quando necessário, um atendente assume a conversa sem perder o contexto, mantendo continuidade no atendimento.`;
  }

  return `Na prática, ${companyName} utiliza automação no WhatsApp para responder dúvidas frequentes, organizar conversas e qualificar leads com mais agilidade. A proposta atende especialmente ${target}, mantendo a possibilidade de transferência para um atendente humano quando necessário.`;
}

function resolveAiFunction() {
  const candidates = [];

  if (typeof aiService === "function") candidates.push(aiService);
  if (typeof aiService.generateResponse === "function") candidates.push(aiService.generateResponse);
  if (typeof aiService.generateAIResponse === "function") candidates.push(aiService.generateAIResponse);
  if (typeof aiService.chatCompletion === "function") candidates.push(aiService.chatCompletion);
  if (typeof aiService.getChatCompletion === "function") candidates.push(aiService.getChatCompletion);
  if (aiService && typeof aiService === "object") {
    for (const [key, value] of Object.entries(aiService)) {
      if (typeof value === "function" && /(generate|chat|reply|response)/i.test(key)) {
        candidates.push(value);
      }
    }
  }

  const unique = [];
  for (const fn of candidates) {
    if (typeof fn === "function" && !unique.includes(fn)) unique.push(fn);
  }
  return unique[0] || null;
}

function normalizeAiResult(result) {
  if (!result) return "";
  if (typeof result === "string") return normalizeText(result);
  if (typeof result?.text === "string") return normalizeText(result.text);
  if (typeof result?.content === "string") return normalizeText(result.content);
  if (typeof result?.message === "string") return normalizeText(result.message);
  if (typeof result?.response === "string") return normalizeText(result.response);
  if (typeof result?.reply === "string") return normalizeText(result.reply);
  if (Array.isArray(result?.choices) && result.choices[0]?.message?.content) {
    return normalizeText(result.choices[0].message.content);
  }
  return "";
}

async function tryGeneratePreviewWithAi(systemPrompt, message) {
  const fn = resolveAiFunction();
  if (!fn) {
    return { ok: false, reason: "AI_FUNCTION_NOT_FOUND", text: "" };
  }

  const attempts = [
    () => fn({
      systemPrompt,
      messages: [{ role: "user", content: message }]
    }),
    () => fn({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    }),
    () => fn(systemPrompt, [{ role: "user", content: message }]),
    () => fn([
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]),
    () => fn(message, systemPrompt),
  ];

  for (const run of attempts) {
    try {
      const result = await run();
      const text = normalizeAiResult(result);
      if (text) {
        return { ok: true, text };
      }
    } catch (_) {}
  }

  return { ok: false, reason: "AI_CALL_UNRESOLVED", text: "" };
}

router.post("/me", authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const message = normalizeText(req?.body?.message || "");
    if (!message) {
      return res.status(400).json({
        success: false,
        error: "MESSAGE_REQUIRED"
      });
    }

    const profile = await getCompanyCommercialProfile(req.resolvedCompanyId, { preferDb: true });
    const systemPrompt = buildSystemPrompt(profile);

    const aiPreview = await tryGeneratePreviewWithAi(systemPrompt, message);

    const reply = aiPreview.ok
      ? aiPreview.text
      : buildDeterministicFallback(profile, message);

    return res.status(200).json({
      success: true,
      reply,
      meta: {
        used_fallback: !aiPreview.ok,
        preview_mode: aiPreview.ok ? "live_ai" : "deterministic_fallback",
        source_profile: sourceToLabel(profile?.source),
        company_name: profile?.company_name || "",
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "ASSISTANT_PREVIEW_FAILED",
      message: String(error?.message || error)
    });
  }
});


/* __AUTOATENDE_C16N_C12C_R3_RUNTIME_AUTHORITY_ROUTE__ */
function aaC12cR3ResolveCompanyId(req) {
  // __AUTOATENDE_C16N_C12C_R4_COMPANY_RESOLUTION__
  const headerCompanyId =
    req?.headers?.['x-company-id'] ||
    req?.headers?.['X-Company-Id'] ||
    '';

  const queryCompanyId =
    req?.query?.company_id ||
    req?.query?.companyId ||
    '';

  const bodyCompanyId =
    req?.body?.company_id ||
    req?.body?.companyId ||
    '';

  const candidates = [
    queryCompanyId,
    headerCompanyId,
    bodyCompanyId,
    req?.companyId,
    req?.company_id,
    req?.company?.id,
    req?.company?.company_id,
    req?.user?.companyId,
    req?.user?.company_id,
    req?.user?.company?.id,
    req?.profile?.company_id,
    req?.auth?.companyId,
    req?.auth?.company_id,
    req?.tenant?.companyId,
    req?.tenant?.company_id
  ];

  for (const value of candidates) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }

  return '';
}

router.get('/runtime-authority', authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const companyId = aaC12cR3ResolveCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error: 'COMPANY_ID_NOT_RESOLVED'
      });
    }

    const authorityEnabled =
      typeof process.env.ASSISTANT_CENTRAL_AUTHORITY_ENABLED === 'undefined'
        ? true
        : !['false', '0', 'off', 'no'].includes(String(process.env.ASSISTANT_CENTRAL_AUTHORITY_ENABLED).trim().toLowerCase());

    const runtimeSystemPrompt =
      typeof runtimeAuthorityService?.__buildLiveSystemPromptForCompany === 'function'
        ? await runtimeAuthorityService.__buildLiveSystemPromptForCompany(companyId)
        : '';

    return res.json({
      ok: true,
      data: {
        company_id: companyId,
        authority_enabled: authorityEnabled,
        authority_source: 'runtimeAuthorityService.__buildLiveSystemPromptForCompany',
        runtime_helper_file: 'whatsappMessageHandler.js',
        runtime_system_prompt: String(runtimeSystemPrompt || ''),
        runtime_system_prompt_length: String(runtimeSystemPrompt || '').length,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'RUNTIME_AUTHORITY_BUILD_FAILED',
      message: error?.message || String(error)
    });
  }
});



/* __AUTOATENDE_C16N_C12D_DB_FIX2_SNAPSHOT_AUTHORITY_ROUTE__ */
router.get('/snapshot-authority', authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const companyId =
      (typeof aaC12cR3ResolveCompanyId === 'function' ? aaC12cR3ResolveCompanyId(req) : '') ||
      String(
        req?.query?.company_id ||
        req?.query?.companyId ||
        req?.headers?.['x-company-id'] ||
        req?.headers?.['X-Company-Id'] ||
        ''
      ).trim();

    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error: 'COMPANY_ID_NOT_RESOLVED'
      });
    }

    const sourceMode =
      String(req?.query?.sourceMode || 'published').trim().toLowerCase() === 'draft'
        ? 'draft'
        : 'published';

    const message =
      String(req?.query?.message || '').trim() ||
      'Quais são os planos da AutoAtende AI hoje?';

    const authority =
      typeof assistantCentralPreviewService?.buildSnapshotAuthority === 'function'
        ? await assistantCentralPreviewService.buildSnapshotAuthority({
            companyId,
            sourceMode,
            message
          })
        : null;

    return res.json({
      ok: true,
      data: authority
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'SNAPSHOT_AUTHORITY_BUILD_FAILED',
      message: error?.message || String(error)
    });
  }
});


module.exports = router;