/* __AUTOATENDE_P3_R6_R3A_FULL_WRITE_AUTH_IDEMPOTENT__ */
// __AUTOATENDE_C6B_R1_ADMIN_SURFACE_HARDENING__
const express = require("express");
const assistantCentralService = require('../services/assistantCentral.service');
const assistantCentralPreviewService = require('../services/assistantCentralPreview.service');
const router = express.Router();

/* __AUTOATENDE_V4_R28J_PATCH_ASSISTANT_CENTRAL_STATE_DB_FIRST_PROFILE__ */
function aaR28jText(value) {
  if (value === null || typeof value === 'undefined') return '';
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || typeof item === 'undefined') return '';
        if (typeof item === 'string') return item.trim();
        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function aaR28jList(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && typeof item !== 'undefined');
  if (value === null || typeof value === 'undefined') return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return trimmed.split(/\n|;|\|/).map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function aaR28jJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || typeof value === 'undefined') return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (_) {}
    return [{ question: trimmed, answer: '' }];
  }
  if (typeof value === 'object') return [value];
  return [];
}

function aaR28jGetPath(req) {
  return String((req && (req.path || req.url || req.originalUrl)) || '');
}

function aaR28jGetCompanyId(req, body) {
  return (
    body?.data?.companyId ||
    body?.data?.company_id ||
    body?.companyId ||
    body?.company_id ||
    req?.companyId ||
    req?.company_id ||
    req?.auth?.company_id ||
    req?.user?.company_id ||
    req?.user?.companyId ||
    req?.query?.company_id ||
    req?.query?.companyId ||
    req?.body?.company_id ||
    req?.body?.companyId ||
    ''
  );
}

function aaR28jBuildAssistantShape(profile) {
  if (!profile || typeof profile !== 'object') return null;

  const companyName = aaR28jText(profile.company_name || profile.companyName);
  const companyContext = aaR28jText(profile.company_context || profile.companyContext);
  const servicesText = aaR28jText(profile.services_text || profile.services);
  const targetAudience = aaR28jText(profile.target_audience || profile.targetAudience);
  const tone = aaR28jText(profile.tone_of_voice || profile.tone || profile.toneOfVoice);
  const guidance = aaR28jText(profile.assistant_guidance || profile.assistantGuidance || profile.guidance);
  const additionalGuidance = aaR28jText(profile.additional_guidance || profile.additionalGuidance);
  const forbiddenText = aaR28jText(profile.forbidden_topics_text || profile.forbidden_topics || profile.forbiddenTopics);
  const escalationRules = aaR28jText(profile.escalation_rules || profile.escalationRules);
  const faq = aaR28jJsonArray(profile.faq_base || profile.faqBase || profile.faq_json || profile.faqJson || profile.faqs);

  return {
    companyId: profile.company_id || profile.companyId || '',
    company_id: profile.company_id || profile.companyId || '',
    companyName,
    company_name: companyName,
    targetAudience,
    target_audience: targetAudience,
    toneOfVoice: tone,
    tone_of_voice: tone,
    companyContext,
    company_context: companyContext,
    guidance: guidance || additionalGuidance,
    assistantGuidance: guidance,
    assistant_guidance: guidance,
    additionalGuidance,
    additional_guidance: additionalGuidance,
    services: aaR28jList(profile.services || profile.services_text),
    services_text: servicesText,
    faqBase: faq,
    faq_base: faq,
    faqJson: aaR28jJsonArray(profile.faq_json || profile.faqJson || faq),
    faq_json: aaR28jJsonArray(profile.faq_json || profile.faqJson || faq),
    forbiddenTopics: aaR28jList(profile.forbidden_topics || profile.forbidden_topics_text),
    forbidden_topics: aaR28jList(profile.forbidden_topics || profile.forbidden_topics_text),
    forbidden_topics_text: forbiddenText,
    escalationRules,
    escalation_rules: escalationRules,
    onboardingCompleted: Boolean(profile.onboarding_completed),
    onboarding_completed: Boolean(profile.onboarding_completed),
    profileSource: profile.profile_source || profile.profileSource || 'company_commercial_profiles',
    profile_source: profile.profile_source || profile.profileSource || 'company_commercial_profiles',
    sourceMarker: profile.source_marker || profile.sourceMarker || '__AUTOATENDE_V4_R28H_R2_DB_FIRST_PERSISTENCE_NO_HOST_NODE__',
    source_marker: profile.source_marker || profile.sourceMarker || '__AUTOATENDE_V4_R28H_R2_DB_FIRST_PERSISTENCE_NO_HOST_NODE__',
    r28jStateProfileOverlay: true,
    r28j_marker: '__AUTOATENDE_V4_R28J_PATCH_ASSISTANT_CENTRAL_STATE_DB_FIRST_PROFILE__'
  };
}

function aaR28jReplaceOldNameDeep(value, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return value;

  if (typeof value === 'string') {
    return value.split(oldName).join(newName);
  }

  if (Array.isArray(value)) {
    return value.map((item) => aaR28jReplaceOldNameDeep(item, oldName, newName));
  }

  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = aaR28jReplaceOldNameDeep(item, oldName, newName);
    }
    return next;
  }

  return value;
}

async function aaR28jLoadDbFirstCommercialProfile(companyId) {
  if (!companyId) return null;
  const svc = require('../services/companyCommercialProfile.service');
  if (!svc || typeof svc.getCompanyCommercialProfile !== 'function') return null;
  return await svc.getCompanyCommercialProfile(companyId);
}

async function aaR28jOverlayAssistantCentralState(req, body) {
  try {
    if (!body || typeof body !== 'object') return body;

    const companyId = aaR28jGetCompanyId(req, body);
    if (!companyId) return body;

    const profile = await aaR28jLoadDbFirstCommercialProfile(companyId);
    const shape = aaR28jBuildAssistantShape(profile);

    if (!shape || shape.source_marker !== '__AUTOATENDE_V4_R28H_R2_DB_FIRST_PERSISTENCE_NO_HOST_NODE__') {
      return body;
    }

    const data = body.data && typeof body.data === 'object' ? { ...body.data } : {};

    const nextData = {
      ...data,
      companyId: shape.companyId || data.companyId,
      company_id: shape.company_id || data.company_id,
      commercialProfile: shape,
      commercial_profile: shape,
      dbFirstCommercialProfile: shape,
      db_first_commercial_profile: shape,
      r28jStateConsumesDbFirstProfile: true,
      r28j_marker: '__AUTOATENDE_V4_R28J_PATCH_ASSISTANT_CENTRAL_STATE_DB_FIRST_PROFILE__'
    };

    for (const key of ['draft', 'published', 'snapshot', 'runtime', 'profile']) {
      if (nextData[key] && typeof nextData[key] === 'object') {
        nextData[key] = { ...nextData[key], ...shape };
      }
    }

    if (!nextData.draft || typeof nextData.draft !== 'object') nextData.draft = { ...shape };
    if (!nextData.published || typeof nextData.published !== 'object') nextData.published = { ...shape };

    let patched = {
      ...body,
      data: nextData,
      r28jStateConsumesDbFirstProfile: true,
      r28j_marker: '__AUTOATENDE_V4_R28J_PATCH_ASSISTANT_CENTRAL_STATE_DB_FIRST_PROFILE__'
    };

    patched = aaR28jReplaceOldNameDeep(patched, 'AutoAtende AI', shape.companyName);

    return patched;
  } catch (error) {
    console.error('[R28J] Assistant Central state DB-first overlay skipped', {
      marker: '__AUTOATENDE_V4_R28J_PATCH_ASSISTANT_CENTRAL_STATE_DB_FIRST_PROFILE__',
      error: error && error.message ? error.message : String(error)
    });
    return body;
  }
}

router.use(function aaR28jAssistantCentralStateDbFirstOverlayMiddleware(req, res, next) {
  const path = aaR28jGetPath(req);
  if (req.method !== 'GET' || !path.includes('/assistant-central/state')) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function aaR28jPatchedStateJson(body) {
    Promise.resolve(aaR28jOverlayAssistantCentralState(req, body))
      .then((patchedBody) => originalJson(patchedBody))
      .catch((error) => {
        console.error('[R28J] Assistant Central state response overlay failed', {
          marker: '__AUTOATENDE_V4_R28J_PATCH_ASSISTANT_CENTRAL_STATE_DB_FIRST_PROFILE__',
          error: error && error.message ? error.message : String(error)
        });
        originalJson(body);
      });

    return res;
  };

  return next();
});




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

/* __AUTOATENDE_C3FIX2_PROFILE_ROUTE_COMPANY_MIDDLEWARE__ */
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

/* __AUTOATENDE_C3FIX2_PROFILE_ROUTE_COMPANY_RESOLVER__ */
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

const {
  getCompanyCommercialProfile,
  upsertCompanyCommercialProfile,
} = require("../services/companyCommercialProfile.service");

/* __AUTOATENDE_C1C_COMPANY_COMMERCIAL_PROFILE_ROUTES__ */

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
  const paramCompanyId = req.params.companyId && req.params.companyId !== "me"
    ? String(req.params.companyId)
    : null;

  const userCompanyId = extractUserCompanyId(req);
  const resolvedCompanyId = paramCompanyId || userCompanyId;

  if (!resolvedCompanyId) {
    return res.status(400).json({
      success: false,
      error: "COMPANY_ID_REQUIRED"
    });
  }

  if (paramCompanyId && userCompanyId && paramCompanyId !== userCompanyId) {
    return res.status(403).json({
      success: false,
      error: "COMPANY_SCOPE_FORBIDDEN"
    });
  }

  req.resolvedCompanyId = resolvedCompanyId;
  return next();
}

async function handleGet(req, res) {
  try {
    const profile = await getCompanyCommercialProfile(req.resolvedCompanyId, { preferDb: true });
    return res.status(200).json({
      success: true,
      profile
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "COMPANY_COMMERCIAL_PROFILE_READ_FAILED",
      message: String(error?.message || error)
    });
  }
}

async function handleUpsert(req, res) {
  try {
    const profile = await upsertCompanyCommercialProfile(req.resolvedCompanyId, req.body || {}, { preferDb: true });
    return res.status(200).json({
      success: true,
      profile
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "COMPANY_COMMERCIAL_PROFILE_UPSERT_FAILED",
      message: String(error?.message || error)
    });
  }
}

router.get("/me", authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, handleGet);
router.get("/:companyId", authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, handleGet);
router.put("/me", authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, handleUpsert);
router.put("/:companyId", authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, handleUpsert);
router.patch("/me", authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, handleUpsert);
router.patch("/:companyId", authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, handleUpsert);


// __AUTOATENDE_C3C1_ASSISTANT_CENTRAL_PUBLISH_LAYER__
function resolveAssistantCentralCompanyId(req) {
  return (
    req.companyId ||
    req.resolvedCompanyId ||
    req.context?.companyId ||
    req.user?.company_id ||
    req.user?.companyId ||
    req.auth?.companyId ||
    process.env.AUTOATENDE_DEFAULT_COMPANY_ID ||
    null
  );
}

function resolveAssistantCentralActor(req) {
  return (
    req.user?.email ||
    req.user?.id ||
    req.auth?.email ||
    req.auth?.sub ||
    'panel'
  );
}

router.get('/assistant-central/state', authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const companyId = resolveAssistantCentralCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: 'ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED' });
    }

    const data = assistantCentralService.getCompanyState(companyId);
    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[ASSISTANT_CENTRAL][STATE]', error);
    return res.status(500).json({
      error: 'ASSISTANT_CENTRAL_STATE_FAILED',
      message: error.message
    });
  }
});

router.put('/assistant-central/draft', authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const companyId = resolveAssistantCentralCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: 'ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED' });
    }

    const actor = resolveAssistantCentralActor(req);
    const data = assistantCentralService.saveDraft(companyId, req.body || {}, actor);
    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[ASSISTANT_CENTRAL][SAVE_DRAFT]', error);
    return res.status(500).json({
      error: 'ASSISTANT_CENTRAL_SAVE_DRAFT_FAILED',
      message: error.message
    });
  }
});

router.post('/assistant-central/publish', authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const companyId = resolveAssistantCentralCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: 'ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED' });
    }

    const actor = resolveAssistantCentralActor(req);
    const data = assistantCentralService.publish(companyId, actor);
    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[ASSISTANT_CENTRAL][PUBLISH]', error);
    const status = error.message === 'ASSISTANT_CENTRAL_DRAFT_EMPTY' ? 400 : 500;
    return res.status(status).json({
      error: 'ASSISTANT_CENTRAL_PUBLISH_FAILED',
      message: error.message
    });
  }
});

router.post('/assistant-central/discard-draft', authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const companyId = resolveAssistantCentralCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: 'ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED' });
    }

    const actor = resolveAssistantCentralActor(req);
    const data = assistantCentralService.discardDraft(companyId, actor);
    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[ASSISTANT_CENTRAL][DISCARD_DRAFT]', error);
    return res.status(500).json({
      error: 'ASSISTANT_CENTRAL_DISCARD_DRAFT_FAILED',
      message: error.message
    });
  }
});

/* __AUTOATENDE_ASSISTANT_ACTIVATION_RUNTIME_CONTRACT_V20_B2_R4__ */
router.patch(
  '/assistant-central/activation',
  authMiddleware,
  requireRole(['company', 'admin']),
  bindResolvedCompanyIdAfterAuth,
  ensureCompanyScope,
  async (req, res) => {
    try {
      const companyId =
        resolveAssistantCentralCompanyId(req);

      if (!companyId) {
        return res.status(400).json({
          error:
            'ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED'
        });
      }

      if (
        typeof req.body?.enabled !== 'boolean'
      ) {
        return res.status(400).json({
          error:
            'ASSISTANT_CENTRAL_ENABLED_BOOLEAN_REQUIRED',
          message:
            'O campo enabled deve ser booleano.'
        });
      }

      const actor =
        resolveAssistantCentralActor(req);

      const data =
        assistantCentralService
          .setAssistantEnabled(
            companyId,
            req.body.enabled,
            actor
          );

      return res.json({
        ok: true,
        data
      });
    } catch (error) {
      console.error(
        '[ASSISTANT_CENTRAL][ACTIVATION]',
        error
      );

      const status =
        error.message ===
        'ASSISTANT_CENTRAL_PUBLISHED_REQUIRED'
          ? 409
          : error.message ===
            'ASSISTANT_CENTRAL_ENABLED_BOOLEAN_REQUIRED'
            ? 400
            : 500;

      return res.status(status).json({
        error:
          'ASSISTANT_CENTRAL_ACTIVATION_FAILED',
        message: error.message
      });
    }
  }
);




/* __AUTOATENDE_P3_R6_ASSISTANT_CENTRAL_BACKEND_AUTH_HARDENING__ */
// __AUTOATENDE_C3C3B2_REAL_SNAPSHOT_PREVIEW_ROUTE__
router.post('/assistant-central/preview', authMiddleware, requireRole(['company','admin']), bindResolvedCompanyIdAfterAuth, ensureCompanyScope, async (req, res) => {
  try {
    const companyId = resolveAssistantCentralCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: 'ASSISTANT_CENTRAL_COMPANY_ID_REQUIRED' });
    }

    const message =
      req.body?.message ||
      req.body?.prompt ||
      req.body?.question ||
      '';

    const sourceMode = req.body?.sourceMode || 'published';

    const data = await assistantCentralPreviewService.generatePreview({
      companyId,
      sourceMode,
      message
    });

    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[ASSISTANT_CENTRAL][PREVIEW]', error);
    const status = error.message === 'ASSISTANT_PREVIEW_MESSAGE_REQUIRED' ? 400 : 500;
    return res.status(status).json({
      error: 'ASSISTANT_CENTRAL_PREVIEW_FAILED',
      message: error.message
    });
  }
});


module.exports = router;
